"use client";

import { useState } from "react";
import Image from "next/image";
import { Search } from "lucide-react";
import { searchVideos } from "@/lib/youtube";
import { MAX_LENGTH } from "@/lib/constants";
import Alert from "@/components/Alert";
import type { SavedSpot, VideoResult } from "@/lib/types";

/**
 * プラン詳細画面から、行きたいリストを経由せずに動画を検索して追加するための
 * 検索欄。追加した動画は行きたいリストにも保存される（保存済みの動画は
 * 既存のスポットを再利用する）。
 */
export default function PlanSpotSearch({
  dayCount,
  spots,
  assignedSpotIds,
  onAdd,
}: {
  dayCount: number;
  spots: SavedSpot[];
  assignedSpotIds: Set<string>;
  onAdd: (video: VideoResult, day: number) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VideoResult[] | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [dayByVideo, setDayByVideo] = useState<Record<string, number>>({});
  const [addingId, setAddingId] = useState<string | null>(null);

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setStatus("loading");
    try {
      setResults(await searchVideos(trimmed, 12));
      setStatus("idle");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "検索に失敗しました");
      setStatus("error");
    }
  }

  async function handleAdd(video: VideoResult) {
    setAddingId(video.videoId);
    try {
      await onAdd(video, dayByVideo[video.videoId] ?? 1);
    } finally {
      setAddingId(null);
    }
  }

  function isAdded(videoId: string) {
    const saved = spots.find((spot) => spot.videoId === videoId);
    return Boolean(saved && assignedSpotIds.has(saved.id));
  }

  return (
    <div className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm">
      <h2 className="mb-3 font-semibold text-slate-800">検索して追加</h2>
      <form onSubmit={handleSearch} role="search" className="mb-3 flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="例：浅草 カフェ"
            maxLength={MAX_LENGTH.SHORT}
            aria-label="スポットを検索"
            className="w-full rounded-full border border-brand-200 bg-white py-2 pl-9 pr-4 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <button
          type="submit"
          disabled={status === "loading"}
          className="flex-shrink-0 rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          検索
        </button>
      </form>

      {status === "error" && <Alert>{errorMessage}</Alert>}
      {status === "loading" && <p className="text-sm text-slate-400">検索中...</p>}
      {status === "idle" && results && results.length === 0 && (
        <p className="text-sm text-slate-400">「{query}」に一致する動画が見つかりませんでした。</p>
      )}

      {status !== "loading" && results && results.length > 0 && (
        <ul className="flex flex-col gap-2">
          {results.map((video) => (
            <li
              key={video.videoId}
              className="flex items-center gap-3 rounded-xl border border-slate-100 p-2"
            >
              <div className="relative h-12 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
                <Image
                  src={video.thumbnailUrl}
                  alt={video.title}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </div>
              <p className="min-w-0 flex-1 truncate text-sm text-slate-800">{video.title}</p>
              {isAdded(video.videoId) ? (
                <span className="flex-shrink-0 text-xs text-slate-400">追加済み</span>
              ) : (
                <>
                  <select
                    value={dayByVideo[video.videoId] ?? 1}
                    onChange={(event) =>
                      setDayByVideo((current) => ({
                        ...current,
                        [video.videoId]: Number(event.target.value),
                      }))
                    }
                    aria-label="追加する日"
                    className="rounded border border-slate-200 text-xs"
                  >
                    {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        {d}日目
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={addingId === video.videoId}
                    onClick={() => handleAdd(video)}
                    className="rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                  >
                    追加
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
