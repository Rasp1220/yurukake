import type { SavedSpot } from "./types";

const STORAGE_KEY = "strollsync:wishlist";

function readAll(): SavedSpot[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SavedSpot[];
  } catch {
    return [];
  }
}

function writeAll(spots: SavedSpot[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(spots));
}

export function getSavedSpots(): SavedSpot[] {
  return readAll().sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
  );
}

export function addSavedSpot(spot: Omit<SavedSpot, "id" | "savedAt">): SavedSpot {
  const newSpot: SavedSpot = {
    ...spot,
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
  };
  const all = readAll();
  all.push(newSpot);
  writeAll(all);
  return newSpot;
}

export function removeSavedSpot(id: string) {
  writeAll(readAll().filter((spot) => spot.id !== id));
}

export function isVideoSaved(videoId: string): boolean {
  return readAll().some((spot) => spot.videoId === videoId);
}
