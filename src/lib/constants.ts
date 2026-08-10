export const AREAS = [
  { label: "東京", query: "東京" },
  { label: "大阪", query: "大阪" },
  { label: "北海道", query: "北海道" },
  { label: "京都", query: "京都" },
  { label: "福岡", query: "福岡" },
  { label: "沖縄", query: "沖縄" },
  { label: "名古屋", query: "名古屋" },
  { label: "横浜", query: "横浜" },
];

export const GENRES = [
  "カフェ",
  "グルメ",
  "絶景",
  "子連れ",
  "デート",
  "観光",
  "アウトドア",
  "夜景",
];

// ブロガープロフィールに付けられるタグの候補。一旦は東京・大阪のみ。
export const PROFILE_TAGS = ["東京", "大阪"];

// ユーザーが入力するテキスト欄の最大文字数。プロフィール関連は短め、
// それ以外（タイトルや本文）は長めに設定する。
export const MAX_LENGTH = {
  PROFILE: 200,
  SHORT: 1000,
  LONG: 2000,
} as const;

// プロフィールの自由URL欄（Webサイトなど）の最大枠数。
export const MAX_PROFILE_LINKS = 3;
