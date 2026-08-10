import { getAreaVideosClient } from "./areaVideos";
import type { BlogSearchResult, VideoResult } from "./types";

/**
 * ハンバーガーメニューの「新着おでかけスポット」「YouTube」「ブログ」用。
 * YouTube動画（area_videos）と公開ブログ（blogs）を`search_recent_spots`関数で
 * UNIONし、公開日時の降順で1つの一覧として取得する。
 */

export type RecentSpotKind = "video" | "blog";

export type RecentSpotItem =
  | { kind: "video"; video: VideoResult }
  | { kind: "blog"; blog: BlogSearchResult };

interface RecentSpotRow {
  kind: RecentSpotKind;
  id: string;
  title: string;
  thumbnail_url: string | null;
  channel_title: string | null;
  published_at: string | null;
}

function toItem(row: RecentSpotRow): RecentSpotItem {
  if (row.kind === "video") {
    return {
      kind: "video",
      video: {
        videoId: row.id,
        title: row.title,
        channelTitle: row.channel_title ?? "",
        thumbnailUrl: row.thumbnail_url ?? "",
        publishedAt: row.published_at ?? "",
        description: "",
        viewCount: 0,
      },
    };
  }
  return {
    kind: "blog",
    blog: {
      id: row.id,
      userId: "",
      title: row.title,
      thumbnailUrl: row.thumbnail_url,
      status: "published",
      createdAt: row.published_at ?? "",
      updatedAt: row.published_at ?? "",
      authorDisplayName: null,
    },
  };
}

export async function getRecentSpots(
  kind: RecentSpotKind | null,
  limit: number,
  offset: number,
): Promise<RecentSpotItem[]> {
  const supabase = getAreaVideosClient();
  if (!supabase) throw new Error("サーバーにSupabaseの接続情報が設定されていません");

  const { data, error } = await supabase.rpc("search_recent_spots", {
    spot_kind: kind,
    result_limit: limit,
    result_offset: offset,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as RecentSpotRow[]).map(toItem);
}

export async function countRecentSpots(kind: RecentSpotKind | null): Promise<number> {
  const supabase = getAreaVideosClient();
  if (!supabase) throw new Error("サーバーにSupabaseの接続情報が設定されていません");

  const { data, error } = await supabase.rpc("count_recent_spots", { spot_kind: kind });
  if (error) throw new Error(error.message);
  return typeof data === "number" ? data : 0;
}
