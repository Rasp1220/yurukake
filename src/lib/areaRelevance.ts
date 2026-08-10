import { PREFECTURES, PREFECTURE_ALIASES, type Prefecture } from "./prefectures";
import { IRRELEVANT_VIDEO_KEYWORDS, SPOT_RELEVANCE_KEYWORDS } from "./constants";

/**
 * 動画が「本当にその都道府県の動画か」を判定する。
 *
 * YouTube検索は `北海道 グルメ スポット 紹介` のようなクエリに対して、
 * 「愛知で開催される北海道グルメイベント」「大須にできた北海道の人気クレープ店」
 * のような“よその県の話”まで返してくる。バッチはそれをそのまま
 * `prefecture = '北海道'` として保存していたため、検索側（`search_area_videos`）が
 * 都道府県で完全一致に絞り込んでも、トップページの「北海道のおすすめスポット」に
 * 関西・東海の動画が並んでしまっていた。関連度の問題は検索側ではなく
 * 取り込み側にあるので、ここで弾く。
 */

// 「東京都」は「京都」を部分文字列として含むため、判定前に「東京」へ寄せる。
// これをしないと東京の動画がすべて京都にも一致し、どちらの県の動画とも
// 言い切れない扱いになってしまう。
function normalize(text: string): string {
  return text.replace(/東京都/g, "東京");
}

/** テキストが言及している都道府県（県名そのもの、または主要都市・エリア名）。 */
function mentionedPrefectures(text: string): Set<Prefecture> {
  const haystack = normalize(text);
  const found = new Set<Prefecture>();

  for (const prefecture of PREFECTURES) {
    const needles = [prefecture, ...PREFECTURE_ALIASES[prefecture]];
    if (needles.some((needle) => haystack.includes(needle))) {
      found.add(prefecture);
    }
  }

  return found;
}

/**
 * - `match`：その都道府県だけを名指ししている（＝その県の動画と言える）
 * - `other-area`：よその県を名指ししている（自県と併記でも該当。
 *   「【愛知・グルメ】…北海道グルメが楽しめるイベント…」は愛知の話なので
 *   北海道としては `other-area`）
 * - `unknown`：どのエリアも名指ししていない（その県の動画か判断できない）
 */
export type AreaVerdict = "match" | "other-area" | "unknown";

/**
 * 判断はタイトル優先で、タイトルがどのエリアにも触れていないときだけ説明文で
 * 補う（説明文はチャンネルの定型文で他県名が並びがちなので、タイトルに
 * 手がかりがある限りはそちらを信じる）。
 */
export function judgeArea(
  title: string,
  description: string,
  prefecture: Prefecture,
): AreaVerdict {
  const inTitle = mentionedPrefectures(title);
  const mentioned = inTitle.size > 0 ? inTitle : mentionedPrefectures(description);

  if (mentioned.size === 0) return "unknown";
  if (mentioned.size === 1 && mentioned.has(prefecture)) return "match";
  return "other-area";
}

/**
 * 取り込み（`/api/cron/fetch-area-videos`）用。その県の動画だと確認できた
 * ものだけを入れる。`unknown` も取り込まないのは、取り込みは「入れない」
 * だけで何も失われないため、厳しめにしても損が無いから。
 *
 * 一方、保存済みの行を消す点検（`/api/cron/cleanup-area-videos`）は
 * `other-area` だけを対象にする。消すのは取り返しがつかないので、
 * 「よその県の話だと確認できた行」しか消さない。
 */
export function belongsToPrefecture(
  title: string,
  description: string,
  prefecture: Prefecture,
): boolean {
  return judgeArea(title, description, prefecture) === "match";
}

// YouTube検索は都道府県名やジャンル語が緩くマッチするだけで採用してしまうため、
// タイトル・説明文が「お出かけ・旅行スポット紹介」らしい内容かをキーワードで
// 判定する。取り込み（`/api/cron/fetch-area-videos`）は「入れない」だけで
// 何も失われないので、これで弾いて構わない。
const lowerCaseSpotKeywords = SPOT_RELEVANCE_KEYWORDS.map((keyword) => keyword.toLowerCase());

export function looksLikeSpotVideo(title: string, description: string): boolean {
  const haystack = `${title} ${description}`.toLowerCase();
  return lowerCaseSpotKeywords.some((keyword) => haystack.includes(keyword));
}

// 保存済みの行を点検する `/api/cron/cleanup-irrelevant-videos` 用。
//
// 最初の実装は `!looksLikeSpotVideo(...)`（＝スポットらしいキーワードが
// 1つも無い）を削除条件にしていたが、これは「関連が確認できない」を
// そのまま「無関係」とみなしてしまい、`SPOT_RELEVANCE_KEYWORDS` に
// 載っている言い回しをたまたま使っていないだけの正当なスポット動画
// （例：ジャンル語を使わない食レポ動画のタイトル）まで大量に削除対象に
// してしまっていた（誤検知）。
//
// `judgeArea`（都道府県版の点検）が「よその県だと確認できた行」だけを
// 消し、判断できない行はそのまま残すのと同じ考え方で、こちらも
// 「無関係だと確認できた行」＝ `IRRELEVANT_VIDEO_KEYWORDS` に一致し、
// かつスポットらしいキーワードには1つも一致しない行だけを削除対象にする。
// 判断できない行（どちらのキーワードにも一致しない）は消さずに残す。
const lowerCaseIrrelevantKeywords = IRRELEVANT_VIDEO_KEYWORDS.map((keyword) =>
  keyword.toLowerCase(),
);

export function looksIrrelevantVideo(title: string, description: string): boolean {
  const haystack = `${title} ${description}`.toLowerCase();
  const hasIrrelevantSignal = lowerCaseIrrelevantKeywords.some((keyword) =>
    haystack.includes(keyword),
  );
  if (!hasIrrelevantSignal) return false;

  return !looksLikeSpotVideo(title, description);
}
