const STORAGE_KEY = "yurukake_search_history";
const MAX_ENTRIES = 20;

export interface SearchHistoryEntry {
  query: string;
  genre: string | null;
  searchedAt: string;
}

export function recordSearch(query: string, genre?: string | null): void {
  if (typeof window === "undefined" || !query.trim()) return;

  const history = getSearchHistory();
  history.unshift({
    query: query.trim(),
    genre: genre?.trim() || null,
    searchedAt: new Date().toISOString(),
  });

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(history.slice(0, MAX_ENTRIES)),
    );
  } catch {
    // localStorageが使えない環境（プライベートモード等）では履歴保存をあきらめる
  }
}

export function getSearchHistory(): SearchHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
