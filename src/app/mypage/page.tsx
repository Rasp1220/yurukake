"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import MapView from "@/components/MapView";
import { getSavedSpots, removeSavedSpot } from "@/lib/storage";
import type { SavedSpot } from "@/lib/types";

export default function MyPage() {
  const [spots, setSpots] = useState<SavedSpot[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSpots(getSavedSpots());
    setLoaded(true);
  }, []);

  function handleRemove(id: string) {
    removeSavedSpot(id);
    setSpots(getSavedSpots());
  }

  if (!loaded) return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">マイページ</h1>
        <p className="text-sm text-stone-500">
          保存したスポットをマップで確認し、当日のしおりとして使えます。
        </p>
      </div>

      {spots.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-orange-200 bg-orange-50 py-12 text-center text-stone-500">
          まだ行きたいスポットが保存されていません。検索画面から追加してみましょう。
        </p>
      ) : (
        <>
          <MapView spots={spots} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {spots.map((spot, index) => (
              <div
                key={spot.id}
                className="flex gap-3 rounded-2xl border border-orange-100 bg-white p-3 shadow-sm"
              >
                <div className="relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-stone-100">
                  <Image
                    src={spot.thumbnailUrl}
                    alt={spot.videoTitle}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-1 flex-col justify-between">
                  <div>
                    <p className="text-xs font-semibold text-brand-600">
                      #{index + 1} {spot.spotName}
                    </p>
                    <p className="line-clamp-1 text-xs text-stone-500">{spot.address}</p>
                  </div>
                  <button
                    onClick={() => handleRemove(spot.id)}
                    className="self-start text-xs text-stone-400 hover:text-red-500"
                  >
                    リストから削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
