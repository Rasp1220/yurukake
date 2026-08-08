import type { VideoResult } from "./types";

export async function searchVideos(query: string): Promise<VideoResult[]> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "検索に失敗しました");
  }
  const data = await res.json();
  return data.results as VideoResult[];
}
