"use client";

import { useEffect, useState } from "react";
import VideoCard from "./VideoCard";
import SaveModal from "./SaveModal";
import { searchVideos } from "@/lib/youtube";
import { buildRecommendedQuery } from "@/lib/recommend";
import { getSavedSpots } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import type { VideoResult } from "@/lib/types";

export default function RecommendedSection() {
  const [videos, setVideos] = useState<VideoResult[]>([]);
  const [label, setLabel] = useState("あなたへのおすすめ");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("loading");
  const [selectedVideo, setSelectedVideo] = useState<VideoResult | null>(null);

  useEffect(() => {
    async function load() {
      setStatus("loading");
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const savedSpots = user ? await getSavedSpots().catch(() => []) : [];

        const { query, genre } = buildRecommendedQuery(savedSpots);
        setLabel(genre ? `${query} × ${genre} のおすすめ` : `${query}のおすすめ`);

        const results = await searchVideos(query, 12, genre ?? undefined);
        setVideos(results);
        setStatus("idle");
      } catch {
        setStatus("error");
      }
    }
    load();
  }, []);

  if (status === "error" || (status === "idle" && videos.length === 0)) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-stone-800">{label}</h2>

      {status === "loading" && <p className="py-6 text-sm text-stone-400">読み込み中...</p>}

      {status === "idle" && (
        <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-2">
          {videos.map((video) => (
            <div
              key={video.videoId}
              className="w-52 flex-shrink-0 snap-start sm:w-60 lg:w-[calc((100%-3rem)/4)] xl:w-[calc((100%-4rem)/5)]"
            >
              <VideoCard video={video} onOpen={setSelectedVideo} />
            </div>
          ))}
        </div>
      )}

      {selectedVideo && (
        <SaveModal video={selectedVideo} onClose={() => setSelectedVideo(null)} onSaved={() => {}} />
      )}
    </section>
  );
}
