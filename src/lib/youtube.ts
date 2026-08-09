import type { VideoResult } from "./types";

export async function searchVideos(
  query: string,
  maxResults?: number,
  genre?: string,
): Promise<VideoResult[]> {
  const params = new URLSearchParams({ q: query });
  if (maxResults) params.set("maxResults", String(maxResults));
  if (genre) params.set("genre", genre);
  const res = await fetch(`/api/search?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "検索に失敗しました");
  }
  const data = await res.json();
  return data.results as VideoResult[];
}
