import type { VideoResult } from "./types";
import type { AreaVideoSort } from "./areaVideos";

export interface SearchVideosResult {
  results: VideoResult[];
  total: number;
}

export async function searchVideos(
  query: string,
  maxResults?: number,
  genre?: string,
  offset?: number,
  sort?: AreaVideoSort,
): Promise<VideoResult[]> {
  const { results } = await searchVideosWithTotal(query, maxResults, genre, offset, sort);
  return results;
}

export async function searchVideosWithTotal(
  query: string,
  maxResults?: number,
  genre?: string,
  offset?: number,
  sort?: AreaVideoSort,
): Promise<SearchVideosResult> {
  const params = new URLSearchParams({ q: query });
  if (maxResults) params.set("maxResults", String(maxResults));
  if (genre) params.set("genre", genre);
  if (offset) params.set("offset", String(offset));
  if (sort) params.set("sort", sort);
  const res = await fetch(`/api/search?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "検索に失敗しました");
  }
  const data = await res.json();
  return { results: data.results as VideoResult[], total: (data.total as number) ?? 0 };
}
