import type { SavedSpot } from "./types";
import { googleMapsUrl } from "./links";

/** スポット名を空欄のまま保存した場合の表示名フォールバック（動画タイトル）。 */
export function spotDisplayName(spot: Pick<SavedSpot, "spotName" | "videoTitle">): string {
  return spot.spotName || spot.videoTitle;
}

/**
 * スポットのGoogle Mapリンク。住所欄は廃止済み、スポット名も未入力のことが
 * あるため、そのときは動画タイトル（「〇〇10選」のような、地図検索には
 * 向かない文言のことが多い）では検索せず、地図をそのまま開くだけにする。
 */
export function spotMapsUrl(spot: Pick<SavedSpot, "address" | "spotName">): string {
  const query = spot.address || spot.spotName;
  return query ? googleMapsUrl(query) : "https://www.google.com/maps";
}
