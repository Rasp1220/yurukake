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
  view_count: number;
}

function toVideoResult(row: AreaVideoRow): VideoResult {
  return {
    videoId: row.video_id,
    title: row.title,
    channelTitle: row.channel_title,
    thumbnailUrl: row.thumbnail_url,
    publishedAt: row.published_at ?? "",
    description: row.description,
    viewCount: row.view_count,
  };
}

export type AreaVideoSort = "random" | "view_count" | "published_at";

/**
 * 都道府県名、または主要都市・エリア名（「札幌」「名古屋」など。
 * `resolve_prefecture_query`／`supabase/schema.sql`）に一致すればその
 * 都道府県に絞り込み、どちらにも一致しなければタイトル・説明文をあいまい
 * 検索する（`search_area_videos` 関数）。ジャンルが指定されていれば、
 * それも同様にタイトル・説明文で絞り込む。
 *
 * ジャンルで絞り込んだ結果が0件の場合、ジャンル無しで再検索して
 * 「何も出ない」より「ジャンルは外れるが候補は出す」を優先する。
 */
export async function searchAreaVideos(
  query: string,
  genre: string | null,
  maxResults: number,
  offset = 0,
  sortBy: AreaVideoSort = "random",
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
    result_offset: offset,
    sort_by: sortBy,
  });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as AreaVideoRow[];
  // ジャンル込みで「1件も無い」ときだけフォールバックする。2ページ目以降が
  // 空なのは単に最終ページを過ぎただけなので、ここでジャンル無しの結果に
  // 差し替えると、ページを送った先に無関係な動画が現れてしまう。
  if (rows.length > 0 || !trimmedGenre || offset > 0) {
    return rows.map(toVideoResult);
  }

  // ジャンル込みで0件だった場合のフォールバック。
  const { data: fallbackData, error: fallbackError } = await supabase.rpc(
    "search_area_videos",
    {
      search_query: trimmedQuery,
      search_genre: null,
      result_limit: maxResults,
      result_offset: offset,
      sort_by: sortBy,
    },
  );
  if (fallbackError) throw new Error(fallbackError.message);
  return ((fallbackData ?? []) as AreaVideoRow[]).map(toVideoResult);
}

/**
 * もっと見るページのページング用の総件数。ジャンル指定で0件のときに
 * ジャンル無しへフォールバックする挙動は `searchAreaVideos` と揃える
 * （フォールバック後の一覧と件数の不整合を避けるため）。
 */
export async function countAreaVideos(
  query: string,
  genre: string | null,
): Promise<number> {
  const supabase = getAreaVideosClient();
  if (!supabase) {
    throw new Error("サーバーにSupabaseの接続情報が設定されていません");
  }

  const trimmedQuery = query.trim();
  const trimmedGenre = genre?.trim() || null;

  const { data, error } = await supabase.rpc("count_area_videos", {
    search_query: trimmedQuery,
    search_genre: trimmedGenre,
  });
  if (error) throw new Error(error.message);
  if (typeof data === "number" && data > 0) return data;
  if (!trimmedGenre) return typeof data === "number" ? data : 0;

  const { data: fallbackData, error: fallbackError } = await supabase.rpc(
    "count_area_videos",
    { search_query: trimmedQuery, search_genre: null },
  );
  if (fallbackError) throw new Error(fallbackError.message);
  return typeof fallbackData === "number" ? fallbackData : 0;
}

export interface FetchProgress {
  prefecture: Prefecture;
  lastFetchedAt: string | null;
  videoCount: number;
}

// 初回取得（本格取得）を優先する主要都道府県。1日あたり2〜3県分しか
// クォータの都合で処理できないため、利用者が多いであろう主要都市から
// 先にデータを揃える。この一覧に無い県は`PREFECTURES`の並び順のまま。
const PRIORITY_PREFECTURES: readonly Prefecture[] = [
  "東京",
  "大阪",
  "愛知",
  "神奈川",
  "北海道",
  "京都",
  "福岡",
  "沖縄",
];

function priorityRank(prefecture: Prefecture): number {
  const index = PRIORITY_PREFECTURES.indexOf(prefecture);
  return index === -1 ? PRIORITY_PREFECTURES.length : index;
}

/**
 * 取得すべき順に都道府県を並べて返す。
 * - 未取得の県：主要都道府県から先に（`PRIORITY_PREFECTURES`の順）
 * - 取得済みの県：最終更新が古い順（新着チェックのローテーション）
 * 未取得は常に取得済みより先に処理する。
 */
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
      if (!a.lastFetchedAt && !b.lastFetchedAt) {
        return priorityRank(a.prefecture) - priorityRank(b.prefecture);
      }
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
      view_count: video.viewCount,
      published_at: video.publishedAt || null,
      // 取れなかった場合は null のまま入れる（＝判断材料が無い行として、
      // 点検の対象外になる）。
      category_id: video.categoryId ?? null,
      duration_seconds: video.durationSeconds ?? null,
      fetched_at: new Date().toISOString(),
    })),
    { onConflict: "video_id" },
  );
  if (error) throw new Error(error.message);
}

export interface StoredAreaVideo {
  videoId: string;
  prefecture: string;
  title: string;
  description: string;
  channelTitle: string;
  categoryId: number | null;
  durationSeconds: number | null;
}

/**
 * 保存済みの動画を `video_id` 順に1ページぶん読む（`/api/cron/cleanup-area-videos`
 * と `/api/cron/cleanup-irrelevant-videos` の点検用）。並び順を主キーで固定して
 * いるので、ページを送っても行が重複したり抜けたりしない。
 */
export async function listAreaVideoPage(
  offset: number,
  limit: number,
): Promise<StoredAreaVideo[]> {
  const supabase = getAreaVideosClient();
  if (!supabase) throw new Error("サーバーにSupabaseの接続情報が設定されていません");

  const { data, error } = await supabase
    .from(TABLE)
    .select("video_id, prefecture, title, description, channel_title, category_id, duration_seconds")
    .order("video_id", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    videoId: row.video_id as string,
    prefecture: row.prefecture as string,
    title: row.title as string,
    description: (row.description as string) ?? "",
    channelTitle: (row.channel_title as string) ?? "",
    categoryId: (row.category_id as number | null) ?? null,
    durationSeconds: (row.duration_seconds as number | null) ?? null,
  }));
}

/**
 * まだカテゴリ・動画の長さを取得していない行のIDを返す
 * （`/api/cron/backfill-video-metadata` 用）。
 */
export async function listVideoIdsMissingMetadata(limit: number): Promise<string[]> {
  const supabase = getAreaVideosClient();
  if (!supabase) throw new Error("サーバーにSupabaseの接続情報が設定されていません");

  const { data, error } = await supabase
    .from(TABLE)
    .select("video_id")
    .is("category_id", null)
    .order("video_id", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => row.video_id as string);
}

/** 何件の行がまだカテゴリ・動画の長さを持っていないか。 */
export async function countVideosMissingMetadata(): Promise<number> {
  const supabase = getAreaVideosClient();
  if (!supabase) throw new Error("サーバーにSupabaseの接続情報が設定されていません");

  const { count, error } = await supabase
    .from(TABLE)
    .select("video_id", { count: "exact", head: true })
    .is("category_id", null);
  if (error) throw new Error(error.message);

  return count ?? 0;
}

export interface VideoMetadata {
  videoId: string;
  categoryId: number | null;
  durationSeconds: number | null;
}

/**
 * 既存行にカテゴリ・動画の長さを書き戻す。行ごとに値が違うので1件ずつ
 * update する（バックフィルは手動実行の一度きりなので、速さより素直さを取る）。
 */
export async function updateVideoMetadata(items: VideoMetadata[]): Promise<void> {
  if (items.length === 0) return;
  const supabase = getAreaVideosClient();
  if (!supabase) throw new Error("サーバーにSupabaseの接続情報が設定されていません");

  for (const item of items) {
    const { error } = await supabase
      .from(TABLE)
      .update({ category_id: item.categoryId, duration_seconds: item.durationSeconds })
      .eq("video_id", item.videoId);
    if (error) throw new Error(error.message);
  }
}

/**
 * 人が「このチャンネルはおでかけスポットと無関係」と判断したチャンネル名。
 * 点検（消す側）と取り込み（入れない側）の両方が参照するので、一度消した
 * チャンネルは再取得でも戻ってこない。
 */
export async function listBlockedChannels(): Promise<Set<string>> {
  const supabase = getAreaVideosClient();
  if (!supabase) throw new Error("サーバーにSupabaseの接続情報が設定されていません");

  const { data, error } = await supabase
    .from("area_video_channel_blocklist")
    .select("channel_title");
  if (error) throw new Error(error.message);

  return new Set((data ?? []).map((row) => row.channel_title as string));
}

export async function blockChannels(channelTitles: string[], note: string | null): Promise<void> {
  if (channelTitles.length === 0) return;
  const supabase = getAreaVideosClient();
  if (!supabase) throw new Error("サーバーにSupabaseの接続情報が設定されていません");

  const { error } = await supabase.from("area_video_channel_blocklist").upsert(
    channelTitles.map((channelTitle) => ({ channel_title: channelTitle, note })),
    { onConflict: "channel_title" },
  );
  if (error) throw new Error(error.message);
}

export async function deleteAreaVideos(videoIds: string[]): Promise<void> {
  if (videoIds.length === 0) return;
  const supabase = getAreaVideosClient();
  if (!supabase) throw new Error("サーバーにSupabaseの接続情報が設定されていません");

  const { error } = await supabase.from(TABLE).delete().in("video_id", videoIds);
  if (error) throw new Error(error.message);
}

/**
 * `area_fetch_progress.video_count` を数え直す。点検で行を削除したあとに使う。
 * `recordFetchProgress` と違い `last_fetched_at` は触らない（点検は取得では
 * ないので、取得ローテーションの順番を狂わせないため）。
 */
export async function refreshVideoCount(prefecture: string): Promise<void> {
  const supabase = getAreaVideosClient();
  if (!supabase) throw new Error("サーバーにSupabaseの接続情報が設定されていません");

  const { count, error: countError } = await supabase
    .from(TABLE)
    .select("video_id", { count: "exact", head: true })
    .eq("prefecture", prefecture);
  if (countError) throw new Error(countError.message);

  const { error } = await supabase
    .from("area_fetch_progress")
    .update({ video_count: count ?? 0 })
    .eq("prefecture", prefecture);
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
