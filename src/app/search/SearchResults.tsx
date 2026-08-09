"use client";

import { useEffect, useState } from "react";
import SearchBar from "@/components/SearchBar";
import VideoCard from "@/components/VideoCard";
import SaveModal from "@/components/SaveModal";
import { searchVideos } from "@/lib/youtube";
import { recordSearch } from "@/lib/searchHistory";
import { GENRES } from "@/lib/constants";
import type { VideoResult } from "@/lib/types";

export default function SearchResults({ query }: { query: string }) {
  const [videos, setVideos] = useState<VideoResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedVideo, setSelectedVideo] = useState<VideoResult | null>(null);
  const [savedMessage, setSavedMessage] = useState(false);
  const [genre, setGenre] = useState<string | null>(null);

  useEffect(() => {
    if (!query) return;
    setStatus("loading");
    searchVideos(query, 30, genre ?? undefined)
      .then((results) => {
        setVideos(results);
        setStatus("idle");
        recordSearch(query, genre);
      })
      .catch((error) => {
        setErrorMessage(error instanceof Error ? error.message : "検索に失敗しました");
        setStatus("error");
      });
  }, [query, genre]);

  return (
    <div className="flex flex-col gap-6">
      <SearchBar initialQuery={query} />

      {query && (
        <div className="flex flex-wrap gap-2">
          {GENRES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setGenre(genre === option ? null : option)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                genre === option
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-orange-200 text-stone-600 hover:border-brand-300"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {savedMessage && (
        <div className="rounded-xl bg-green-50 px-4 py-2 text-sm text-green-700">
          行きたいリストに追加しました！マイページから確認できます。
        </div>
      )}

      {status === "loading" && (
        <p className="py-12 text-center text-stone-400">検索中...</p>
      )}

      {status === "error" && (
        <p className="py-12 text-center text-red-500">{errorMessage}</p>
      )}

      {status === "idle" && videos.length === 0 && query && (
        <p className="py-12 text-center text-stone-400">
          「{query}」に関連する動画が見つかりませんでした。
        </p>
      )}

      {!query && (
        <p className="py-12 text-center text-stone-400">
          エリアやジャンルを入力して検索してください。
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {videos.map((video) => (
          <VideoCard key={video.videoId} video={video} onOpen={setSelectedVideo} />
        ))}
      </div>

      {selectedVideo && (
        <SaveModal
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
          onSaved={() => {
            setSavedMessage(true);
            setTimeout(() => setSavedMessage(false), 3000);
          }}
        />
      )}
    </div>
  );
}
