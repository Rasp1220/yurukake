"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import VideoCard from "./VideoCard";
import SaveModal from "./SaveModal";
import { searchVideos } from "@/lib/youtube";
import type { VideoResult } from "@/lib/types";

export default function VideoSlider({
  areaLabel,
  query,
}: {
  areaLabel: string;
  query: string;
}) {
  const [videos, setVideos] = useState<VideoResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedVideo, setSelectedVideo] = useState<VideoResult | null>(null);
  const [savedMessage, setSavedMessage] = useState(false);

  useEffect(() => {
    setStatus("loading");
    searchVideos(query, 10, undefined, "view_count")
      .then((results) => {
        setVideos(results);
        setStatus("idle");
      })
      .catch((error) => {
        setErrorMessage(error instanceof Error ? error.message : "検索に失敗しました");
        setStatus("error");
      });
  }, [query]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-stone-800">{areaLabel}のおすすめスポット</h2>
        <Link
          href={`/search?q=${encodeURIComponent(query)}`}
          className="text-sm font-medium text-brand-600 hover:underline"
        >
          もっと見る
        </Link>
      </div>

      {savedMessage && (
        <div className="rounded-xl bg-green-50 px-4 py-2 text-sm text-green-700">
          行きたいリストに追加しました！マイページから確認できます。
        </div>
      )}

      {status === "loading" && (
        <p className="py-6 text-sm text-stone-400">読み込み中...</p>
      )}

      {status === "error" && (
        <p className="py-6 text-sm text-red-500">{errorMessage}</p>
      )}

      {status === "idle" && videos.length > 0 && (
        <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2">
          {videos.map((video) => (
            <div key={video.videoId} className="w-52 flex-shrink-0 snap-start sm:w-60">
              <VideoCard video={video} onOpen={setSelectedVideo} />
            </div>
          ))}
        </div>
      )}

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
    </section>
  );
}
