"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { VideoResult } from "@/lib/types";
import { geocodeAddress } from "@/lib/geocode";
import { addSavedSpot } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";

export default function SaveModal({
  video,
  onClose,
  onSaved,
}: {
  video: VideoResult;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [spotName, setSpotName] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setIsLoggedIn(Boolean(data.user)));
  }, []);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!spotName.trim() || !address.trim()) {
      setStatus("error");
      setErrorMessage("スポット名と住所（またはエリア名）を入力してください");
      return;
    }

    setStatus("saving");
    try {
      const { lat, lng } = await geocodeAddress(address);
      await addSavedSpot({
        videoId: video.videoId,
        videoTitle: video.title,
        thumbnailUrl: video.thumbnailUrl,
        spotName: spotName.trim(),
        address: address.trim(),
        lat,
        lng,
      });
      onSaved();
      onClose();
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "保存に失敗しました");
    }
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 aspect-video w-full overflow-hidden rounded-xl bg-black">
          <iframe
            className="h-full w-full"
            src={`https://www.youtube.com/embed/${video.videoId}`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <h2 className="mb-1 text-base font-semibold text-stone-800">{video.title}</h2>
        <p className="mb-4 text-sm text-stone-500">{video.channelTitle}</p>

        {isLoggedIn === false ? (
          <div className="rounded-xl bg-orange-50 p-4 text-center text-sm text-stone-600">
            <p className="mb-3">行きたいリストに追加するにはログインが必要です。</p>
            <Link
              href="/login"
              className="inline-block rounded-full bg-brand-600 px-5 py-2 font-semibold text-white hover:bg-brand-700"
            >
              ログインする
            </Link>
          </div>
        ) : (
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">
              スポット名
            </label>
            <input
              type="text"
              value={spotName}
              onChange={(event) => setSpotName(event.target.value)}
              placeholder="例：〇〇カフェ"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">
              住所・エリア
            </label>
            <input
              type="text"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="例：東京都台東区浅草"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          {status === "error" && (
            <p className="text-sm text-red-600">{errorMessage}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2 text-sm font-medium text-stone-500 hover:bg-stone-100"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={status === "saving"}
              className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {status === "saving" ? "保存中..." : "行きたいリストに追加"}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
