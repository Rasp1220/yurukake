export type SnsPlatform = "twitter" | "instagram" | "youtube";

const PROFILE_BASE_URL: Record<SnsPlatform, string> = {
  twitter: "https://x.com/",
  instagram: "https://www.instagram.com/",
  youtube: "https://www.youtube.com/@",
};

/**
 * ユーザー名（例: "neko"）から、そのSNSのプロフィールURLを組み立てる。
 * すでにURLが保存されている古いデータ（旧・URL直接入力の仕様）は、そのまま使う。
 */
export function buildSnsUrl(platform: SnsPlatform, value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const username = trimmed.replace(/^@/, "");
  return `${PROFILE_BASE_URL[platform]}${encodeURIComponent(username)}`;
}

/**
 * 入力欄に表示するユーザー名を取り出す。旧・URL直接入力の仕様で保存された
 * 値は、URLからユーザー名部分だけを抜き出す。
 */
export function extractSnsUsername(platform: SnsPlatform, value: string | null): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";
  if (!/^https?:\/\//i.test(trimmed)) return trimmed.replace(/^@/, "");
  try {
    const url = new URL(trimmed);
    const path = url.pathname.replace(/^\/+|\/+$/g, "");
    return decodeURIComponent(path.split("/")[0] ?? "").replace(/^@/, "");
  } catch {
    return trimmed;
  }
}
