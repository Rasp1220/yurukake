// 複数画像パーツ（BlogBlockType "images"）は、他のパーツ種別と同じく単一の
// content(text)列に収める設計を踏襲するため、画像URLの配列をJSON文字列化
// して保存する。編集画面（クライアント）と公開表示画面（サーバー）の両方
// から参照するため、Supabaseクライアントに依存しないこのファイルに置く。

/** content列（JSON文字列）を画像URLの配列に変換する。壊れた値は空配列扱い。 */
export function parseImageBlockUrls(content: string): string[] {
  if (!content) return [];
  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((url): url is string => typeof url === "string");
  } catch {
    return [];
  }
}

/** 画像URLの配列をcontent列に保存する形（JSON文字列）に変換する。 */
export function stringifyImageBlockUrls(urls: string[]): string {
  return JSON.stringify(urls);
}
