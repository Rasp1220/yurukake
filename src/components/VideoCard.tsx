"use client";

import Image from "next/image";
import type { VideoResult } from "@/lib/types";

export default function VideoCard({
  video,
  onOpen,
}: {
  video: VideoResult;
  onOpen: (video: VideoResult) => void;
}) {
  return (
    <button
      onClick={() => onOpen(video)}
      className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-orange-100 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-stone-100">
        <Image
          src={video.thumbnailUrl}
          alt={video.title}
          fill
          sizes="(max-width: 640px) 100vw, 33vw"
          className="object-cover transition group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold text-stone-800">
          {video.title}
        </h3>
        <p className="text-xs text-stone-500">{video.channelTitle}</p>
      </div>
    </button>
  );
}
