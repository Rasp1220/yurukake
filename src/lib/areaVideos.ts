import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { VideoResult } from "./types";
import type { Prefecture } from "./prefectures";

/**
 * 都道府県ごとの動画プール（サーバー専用）。
 *
 * このアプリはリクエスト時にYouTube APIを呼ばない。YouTube Data API v3を
 * 呼ぶのはバッチ（`/api/cron/fetch-area-videos`）だけで、事前に
 * `area_videos` テーブルへ貯めておいた動画を、サイト側は
 * `search_area_videos` 関数経由で読むだけになる。
 */

const TABLE = "area_videos";

let cachedClient: SupabaseClient | null | undefined;

export function getAreaVideosClient(): SupabaseClient | null {
  if (cachedClient !== undefined) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  cachedClient =
    url && key
      ? createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
          },
        })
      : null;

  return cachedClient;
}

interface AreaVideoRow {
  video_id: string;
  title: string;
  channel_title: string;
  thumbnail_url: string;
  description: string;
  published_at: string | null;
}

function toVideoResult(row: AreaVideoRow): VideoResult {
  return {
    videoId: row.video_id,
    title: row.title,
    channelTitle: row.channel_title,
    thumbnailUrl: row.thumbnail_url,
    publishedAt: row.published_at ?? "",
    description: row.description,
  };
}

/**
 * 都道府県名と完全一致すればその都道府県に絞り込み、一致しなければ
 * タイトル・説明文をあいまい検索する（`supabase/schema.sql` の
 * `search_area_videos` 関数）。ジャンルが指定されていれば、それも同様に
 * タイトル・説明文で絞り込む。
 *
 * ジャンルで絞り込んだ結果が0件の場合、ジャンル無しで再検索して
 * 「何も出ない」より「ジャンルは外れるが候補は出す」を優先する。
 */
export async function searchAreaVideos(
  query: string,
  genre: string | null,
  maxResults: number,
): Promise<VideoResult[]> {
  const supabase = getAreaVideosClient();
  if (!supabase) {
    throw new Error("サーバーにSupabaseの接続情報が設定されていません");
  }

  const trimmedQuery = query.trim();
  const trimmedGenre = genre?.trim() || null;

  const { data, error } = await supabase.rpc("search_area_videos", {
    search_query: trimmedQuery,
    search_genre: trimmedGenre,
    result_limit: maxResults,
  });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as AreaVideoRow[];
  if (rows.length > 0 || !trimmedGenre) {
    return rows.map(toVideoResult);
  }

  // ジャンル込みで0件だった場合のフォールバック。
  const { data: fallbackData, error: fallbackError } = await supabase.rpc(
    "search_area_videos",
    {
      search_query: trimmedQuery,
      search_genre: null,
      result_limit: maxResults,
    },
  );
  if (fallbackError) throw new Error(fallbackError.message);
  return ((fallbackData ?? []) as AreaVideoRow[]).map(toVideoResult);
}

export interface FetchProgress {
  prefecture: Prefecture;
  lastFetchedAt: string | null;
  videoCount: number;
}

/** 最終更新が古い順（未更新は最優先）に都道府県を並べて返す。 */
export async function getFetchProgressOrderedByStaleness(
  prefectures: readonly Prefecture[],
): Promise<FetchProgress[]> {
  const supabase = getAreaVideosClient();
  if (!supabase) throw new Error("サーバーにSupabaseの接続情報が設定されていません");

  const { data, error } = await supabase
    .from("area_fetch_progress")
    .select("prefecture, last_fetched_at, video_count");
  if (error) throw new Error(error.message);

  const byPrefecture = new Map(
    (data ?? []).map((row) => [
      row.prefecture as string,
      { lastFetchedAt: row.last_fetched_at as string | null, videoCount: row.video_count as number },
    ]),
  );

  return [...prefectures]
    .map((prefecture) => ({
      prefecture,
      lastFetchedAt: byPrefecture.get(prefecture)?.lastFetchedAt ?? null,
      videoCount: byPrefecture.get(prefecture)?.videoCount ?? 0,
    }))
    .sort((a, b) => {
      if (!a.lastFetchedAt && !b.lastFetchedAt) return 0;
      if (!a.lastFetchedAt) return -1;
      if (!b.lastFetchedAt) return 1;
      return a.lastFetchedAt.localeCompare(b.lastFetchedAt);
    });
}

export async function upsertAreaVideos(
  prefecture: Prefecture,
  videos: VideoResult[],
): Promise<void> {
  if (videos.length === 0) return;
  const supabase = getAreaVideosClient();
  if (!supabase) throw new Error("サーバーにSupabaseの接続情報が設定されていません");

  const { error } = await supabase.from(TABLE).upsert(
    videos.map((video) => ({
      video_id: video.videoId,
      prefecture,
      title: video.title,
      channel_title: video.channelTitle,
      thumbnail_url: video.thumbnailUrl,
      description: video.description,
      published_at: video.publishedAt || null,
      fetched_at: new Date().toISOString(),
    })),
    { onConflict: "video_id" },
  );
  if (error) throw new Error(error.message);
}

export async function recordFetchProgress(prefecture: Prefecture): Promise<void> {
  const supabase = getAreaVideosClient();
  if (!supabase) throw new Error("サーバーにSupabaseの接続情報が設定されていません");

  const { count, error: countError } = await supabase
    .from(TABLE)
    .select("video_id", { count: "exact", head: true })
    .eq("prefecture", prefecture);
  if (countError) throw new Error(countError.message);

  const { error } = await supabase.from("area_fetch_progress").upsert(
    {
      prefecture,
      last_fetched_at: new Date().toISOString(),
      video_count: count ?? 0,
    },
    { onConflict: "prefecture" },
  );
  if (error) throw new Error(error.message);
}
