import { AREAS } from "./constants";
import { getSearchHistory } from "./searchHistory";
import type { SavedSpot } from "./types";

function mostFrequent(values: string[]): string | null {
  if (values.length === 0) return null;
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function findAreaMention(texts: string[]): string | null {
  for (const area of AREAS) {
    if (texts.some((text) => text.includes(area.label))) {
      return area.label;
    }
  }
  return null;
}

export interface RecommendedQuery {
  query: string;
  genre: string | null;
}

/**
 * 保存済みスポットのジャンル・住所や、過去の検索キーワードの傾向から
 * 「あなたへのおすすめ」検索クエリを組み立てる。手がかりが何もない場合は
 * デフォルトの人気エリアにフォールバックする。
 */
export function buildRecommendedQuery(savedSpots: SavedSpot[]): RecommendedQuery {
  const history = getSearchHistory();

  const genre =
    mostFrequent(savedSpots.map((spot) => spot.genre).filter((g): g is string => Boolean(g))) ??
    mostFrequent(history.map((entry) => entry.genre).filter((g): g is string => Boolean(g)));

  const area =
    findAreaMention(savedSpots.map((spot) => spot.address)) ??
    findAreaMention(history.map((entry) => entry.query)) ??
    AREAS[0].label;

  return { query: area, genre: genre ?? null };
}
