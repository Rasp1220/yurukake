"use client";

import { useState } from "react";
import VideoCard from "@/components/VideoCard";
import BlogResultCard from "@/components/BlogResultCard";
import SaveModal from "@/components/SaveModal";
import type { RecentSpotItem } from "@/lib/recentSpots";
import type { VideoResult } from "@/lib/types";

export default function NewSpotsResults({ items }: { items: RecentSpotItem[] }) {
  const [selectedVideo, setSelectedVideo] = useState<VideoResult | null>(null);
  const [savedMessage, setSavedMessage] = useState(false);

  if (items.length === 0) {
    return <p className="py-12 text-center text-stone-400">まだ表示できるスポットがありません。</p>;
  }

  return (
    <>
      {savedMessage && (
        <div className="rounded-xl bg-green-50 px-4 py-2 text-sm text-green-700">
          行きたいリストに追加しました！プラン画面から確認できます。
        </div>
      )}

      {/* 通常ページの幅（max-w-5xl）を超えて、PCではウィンドウ幅いっぱいに
          1行5件前後を並べられるよう、この一覧だけ幅の制約を外す。 */}
      <div className="relative left-1/2 w-screen -translate-x-1/2 px-4 lg:px-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {items.map((item) =>
              item.kind === "video" ? (
                <VideoCard
                  key={`video-${item.video.videoId}`}
                  video={item.video}
                  onOpen={setSelectedVideo}
                />
              ) : (
                <BlogResultCard key={`blog-${item.blog.id}`} blog={item.blog} />
              ),
            )}
          </div>
        </div>
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
    </>
  );
}
