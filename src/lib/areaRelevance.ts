import { PREFECTURES, PREFECTURE_ALIASES, type Prefecture } from "./prefectures";

/**
 * 取り込んだ動画が「本当にその都道府県の動画か」を判定する。
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
// これをしないと東京の動画がすべて京都にも一致し、「エリアが特定できない」
// 動画として両方から弾かれてしまう。
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
 * 「ちょうど1つのエリアだけを名指ししていて、それが対象の都道府県である」
 * ときだけ true。判断はタイトル優先で、タイトルがどのエリアにも触れていない
 * ときだけ説明文で補う（説明文はチャンネルの定型文で他県名が並びがちなので、
 * タイトルに手がかりがある限りはそちらを信じる）。
 *
 * 複数のエリアを名指しする動画（「【愛知・グルメ】…北海道グルメが楽しめる
 * イベント…」など）は、どちらの県の動画とも言い切れないため両方から除外する。
 * どこも名指ししていない動画も、その都道府県のものだと確認できないため除外する。
 * 件数よりも「そのエリアの動画しか出てこないこと」を優先する方針。
 */
export function belongsToPrefecture(
  title: string,
  description: string,
  prefecture: Prefecture,
): boolean {
  const inTitle = mentionedPrefectures(title);
  if (inTitle.size > 0) {
    return inTitle.size === 1 && inTitle.has(prefecture);
  }

  const inDescription = mentionedPrefectures(description);
  return inDescription.size === 1 && inDescription.has(prefecture);
}
