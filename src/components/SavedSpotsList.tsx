"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Icon } from "@iconify/react";
import { getSavedSpots, removeSavedSpot } from "@/lib/storage";
import { youtubeWatchUrl } from "@/lib/links";
import { spotDisplayName, spotMapsUrl } from "@/lib/spots";
import Alert from "@/components/Alert";
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
      ? `行きたいリスト：${spots.map((spot) => spotDisplayName(spot)).join("、")}`
      : "";

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-bold text-stone-800">行きたいリスト</h2>
        <p className="text-sm text-stone-500">
          検索画面から保存したスポットです。プランに組み込んで、当日のしおりとして使えます。
        </p>
      </div>

      {status === "error" && <Alert>{errorMessage}</Alert>}

      {spots.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-orange-200 bg-orange-50 py-12 text-center text-stone-500">
          まだ行きたいスポットが保存されていません。検索画面から追加してみましょう。
        </p>
      ) : (
        <>
          {origin && <ShareButtons text={shareText} url={origin} />}
          <div className="flex flex-col gap-3">
            {spots.map((spot, index) => (
              <div
                key={spot.id}
                className="flex items-center gap-4 rounded-2xl border border-orange-100 bg-white p-3 shadow-sm"
              >
                <div className="relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-stone-100 sm:h-28 sm:w-44">
                  <Image
                    src={spot.thumbnailUrl}
                    alt={spot.videoTitle}
                    fill
                    sizes="(max-width: 640px) 96px, 176px"
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-1 flex-col justify-between">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-brand-600">
                        #{index + 1} {spotDisplayName(spot)}
                        {spot.genre && (
                          <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-brand-700">
                            {spot.genre}
                          </span>
                        )}
                      </p>
                      {/* 住所の入力欄は廃止したため、以前に住所を入れて保存した
                          スポットだけこの行が出る（新規保存では常に空になる）。 */}
                      {spot.address && (
                        <p className="line-clamp-1 text-xs text-stone-500">{spot.address}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemove(spot.id)}
                      aria-label="リストから削除"
                      title="リストから削除"
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-stone-400 transition hover:bg-red-50 hover:text-red-500"
                    >
                      <Icon icon="mdi:trash-can-outline" className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={spotMapsUrl(spot)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Google Mapで開く"
                      title="Google Mapで開く"
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50 text-brand-600 transition hover:bg-orange-100"
                    >
                      <Icon icon="mdi:google-maps" className="h-5 w-5" />
                    </a>
                    <a
                      href={youtubeWatchUrl(spot.videoId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="YouTubeで見る"
                      title="YouTubeで見る"
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50 text-brand-600 transition hover:bg-orange-100"
                    >
                      <Icon icon="mdi:youtube" className="h-5 w-5" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
