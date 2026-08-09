import type { VideoResult } from "./types";
import type { AreaVideoSort } from "./areaVideos";

export interface SearchVideosResult {
  results: VideoResult[];
  total: number;
}

export interface SearchVideosOptions {
  maxResults?: number;
  genre?: string;
  offset?: number;
  sort?: AreaVideoSort;
  /** ページング用の総件数も取得する（数えるコストがかかるので既定は取得しない）。 */
  withTotal?: boolean;
}

async function requestSearch(options: SearchVideosOptions & { query: string }) {
  const { query, maxResults, genre, offset, sort, withTotal } = options;

  const params = new URLSearchParams({ q: query });
  if (maxResults) params.set("maxResults", String(maxResults));
  if (genre) params.set("genre", genre);
  if (offset) params.set("offset", String(offset));
  if (sort) params.set("sort", sort);
  if (withTotal) params.set("withTotal", "true");

  const res = await fetch(`/api/search?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "検索に失敗しました");
  }
  const data = await res.json();
  return { results: data.results as VideoResult[], total: (data.total as number) ?? 0 };
}

/** 一覧だけが欲しいとき（トップページのエリア枠・おすすめ枠）。 */
export async function searchVideos(
  query: string,
  maxResults?: number,
  genre?: string,
  sort?: AreaVideoSort,
): Promise<VideoResult[]> {
  const { results } = await requestSearch({ query, maxResults, genre, sort });
  return results;
}

/** 総件数も欲しいとき（もっと見るページのページング）。 */
export async function searchVideosWithTotal(
  query: string,
  options: Omit<SearchVideosOptions, "withTotal"> = {},
): Promise<SearchVideosResult> {
  return requestSearch({ query, ...options, withTotal: true });
}
