// 47都道府県。バッチ（`/api/cron/fetch-area-videos`）が動画プールを
// 貯める対象で、`search_area_videos` はここに含まれない自由なキーワードも
// タイトル・説明文のあいまい検索で受け付ける。
export const PREFECTURES = [
  "北海道",
  "青森",
  "岩手",
  "宮城",
  "秋田",
  "山形",
  "福島",
  "茨城",
  "栃木",
  "群馬",
  "埼玉",
  "千葉",
  "東京",
  "神奈川",
  "新潟",
  "富山",
  "石川",
  "福井",
  "山梨",
  "長野",
  "岐阜",
  "静岡",
  "愛知",
  "三重",
  "滋賀",
  "京都",
  "大阪",
  "兵庫",
  "奈良",
  "和歌山",
  "鳥取",
  "島根",
  "岡山",
  "広島",
  "山口",
  "徳島",
  "香川",
  "愛媛",
  "高知",
  "福岡",
  "佐賀",
  "長崎",
  "熊本",
  "大分",
  "宮崎",
  "鹿児島",
  "沖縄",
] as const;

export type Prefecture = (typeof PREFECTURES)[number];

export function isPrefecture(value: string): value is Prefecture {
  return (PREFECTURES as readonly string[]).includes(value);
}
