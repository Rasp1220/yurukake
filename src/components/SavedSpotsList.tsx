"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getSavedSpots, removeSavedSpot } from "@/lib/storage";
import { googleMapsUrl, youtubeWatchUrl } from "@/lib/links";
import ShareButtons from "@/components/ShareButtons";
import type { SavedSpot } from "@/lib/types";

/**
 * 検索画面から保存した「行きたいリスト」の一覧。プラン作成時にここから
 * スポットを組み込むため、プラン画面に併設して表示する。
 */
export default function SavedSpotsList() {
  const [spots, setSpots] = useState<SavedSpot[]>([]);
  const [status, setStatus] = useState<"loading" | "idle" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [origin, setOrigin] = useState("");

  async function loadSpots() {
    try {
      setSpots(await getSavedSpots());
      setStatus("idle");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "読み込みに失敗しました");
      setStatus("error");
    }
  }

  useEffect(() => {
    loadSpots();
    setOrigin(window.location.origin);
  }, []);

  async function handleRemove(id: string) {
    try {
      await removeSavedSpot(id);
      await loadSpots();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "削除に失敗しました");
      setStatus("error");
    }
  }

  if (status === "loading") return null;

  const shareText =
    spots.length > 0
      ? `行きたいリスト：${spots.map((spot) => spot.spotName).join("、")}`
      : "";

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-bold text-stone-800">行きたいリスト</h2>
        <p className="text-sm text-stone-500">
          検索画面から保存したスポットです。プランに組み込んで、当日のしおりとして使えます。
        </p>
      </div>

      {status === "error" && <p className="text-sm text-red-600">{errorMessage}</p>}

      {spots.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-orange-200 bg-orange-50 py-12 text-center text-stone-500">
          まだ行きたいスポットが保存されていません。検索画面から追加してみましょう。
        </p>
      ) : (
        <>
          {origin && <ShareButtons text={shareText} url={origin} />}
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
                      {spot.genre && (
                        <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-brand-700">
                          {spot.genre}
                        </span>
                      )}
                    </p>
                    <p className="line-clamp-1 text-xs text-stone-500">
                      {spot.address || "住所未設定"}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      <a
                        href={googleMapsUrl(spot.address || spot.spotName)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-600 hover:underline"
                      >
                        Google Mapで開く
                      </a>
                      <a
                        href={youtubeWatchUrl(spot.videoId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-600 hover:underline"
                      >
                        YouTubeで見る
                      </a>
                    </div>
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
