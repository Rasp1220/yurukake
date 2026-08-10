"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getSavedSpots, removeSavedSpot } from "@/lib/storage";
import { googleMapsUrl, youtubeWatchUrl } from "@/lib/links";
import ShareButtons from "@/components/ShareButtons";
import type { SavedSpot } from "@/lib/types";

export default function MyPageContent() {
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">マイページ</h1>
          <p className="text-sm text-stone-500">
            保存したスポットを一覧で確認し、当日のしおりとして使えます。
          </p>
        </div>
        <div className="flex flex-shrink-0 gap-2">
          <Link
            href="/mypage/blogs"
            className="rounded-full border border-brand-600 px-4 py-2 text-sm font-semibold text-brand-600 hover:bg-orange-50"
          >
            お出かけブログを作る
          </Link>
          <Link
            href="/mypage/plans"
            className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            お出かけプランを作る
          </Link>
        </div>
      </div>

      {/* ナビの「マイページ」ホバーメニューと同じ導線。ホバーできないタッチ端末
          からもプロフィール・ブロガー情報へ辿り着けるようにここにも置く。 */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link href="/mypage/profile" className="font-medium text-brand-600 hover:underline">
          プロフィール
        </Link>
        <Link href="/mypage/account" className="font-medium text-brand-600 hover:underline">
          ブロガー情報
        </Link>
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
