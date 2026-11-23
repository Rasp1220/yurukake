"use client";

import Image from "next/image";
import type { VideoResult } from "@/lib/types";
import { Card } from "@/components/ui/card";

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
      className="group block h-full w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
     <Card className="flex h-full flex-col overflow-hidden transition-colors group-hover:border-primary/50">
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        <Image
          src={video.thumbnailUrl}
          alt={video.title}
          fill
          sizes="(max-width: 640px) 100vw, 33vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold text-slate-800">
          {video.title}
        </h3>
        <p className="text-xs text-slate-500">{video.channelTitle}</p>
      </div>
     </Card>
    </button>
  );
}
