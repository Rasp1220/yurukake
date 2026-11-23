/**
 * 検索欄に貼られたYouTubeの動画URL（watch / youtu.be / shorts / embed / live /
 * スマホ版）から動画IDを取り出す。URLでなければ（通常のキーワードなら）null。
 */
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function extractVideoId(input: string): string | null {
  const text = input.trim();
  if (!text) return null;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^(www|m|music)\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.split("/")[1] ?? "";
    return VIDEO_ID_PATTERN.test(id) ? id : null;
  }

  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const v = url.searchParams.get("v");
    if (v && VIDEO_ID_PATTERN.test(v)) return v;
    const match = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/);
    if (match) return match[1];
  }

  return null;
}
