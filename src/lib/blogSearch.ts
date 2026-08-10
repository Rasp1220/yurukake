import type { BlogSearchResult } from "./types";

/** 「さがす」画面（クライアント）からブログ検索APIを呼び出す。 */
export async function searchBlogs(query: string, genre?: string | null): Promise<BlogSearchResult[]> {
  const params = new URLSearchParams({ q: query });
  if (genre) params.set("genre", genre);
  const res = await fetch(`/api/search/blogs?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "検索に失敗しました");
  }
  const data = await res.json();
  return data.results as BlogSearchResult[];
}
