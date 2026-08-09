"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  addPlanItem,
  getPlan,
  getPlanItems,
  removePlanItem,
  reorderPlanItem,
  updatePlanItemDay,
} from "@/lib/plans";
import { getSavedSpots } from "@/lib/storage";
import { googleMapsUrl, youtubeWatchUrl } from "@/lib/links";
import ShareButtons from "@/components/ShareButtons";
import type { Plan, PlanItem, SavedSpot } from "@/lib/types";

export default function PlanDetailContent({ planId }: { planId: string }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [spots, setSpots] = useState<SavedSpot[]>([]);
  const [status, setStatus] = useState<"loading" | "idle" | "error" | "not-found">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [dayCount, setDayCount] = useState(1);
  const [addDay, setAddDay] = useState<Record<string, number>>({});
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function load() {
    try {
      const [planData, itemsData, spotsData] = await Promise.all([
        getPlan(planId),
        getPlanItems(planId),
        getSavedSpots(),
      ]);
      if (!planData) {
        setStatus("not-found");
        return;
      }
      setPlan(planData);
      setItems(itemsData);
      setSpots(spotsData);
      setDayCount((current) =>
        Math.max(current, 1, ...itemsData.map((item) => item.dayNumber)),
      );
      setStatus("idle");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "読み込みに失敗しました");
      setStatus("error");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  const spotsById = useMemo(() => {
    const map = new Map<string, SavedSpot>();
    for (const spot of spots) map.set(spot.id, spot);
    return map;
  }, [spots]);

  const itemsByDay = useMemo(() => {
    const map = new Map<number, PlanItem[]>();
    for (const item of items) {
      const list = map.get(item.dayNumber) ?? [];
      list.push(item);
      map.set(item.dayNumber, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);
    return map;
  }, [items]);

  async function handleAdd(spotId: string) {
    const day = addDay[spotId] ?? 1;
    try {
      await addPlanItem(planId, spotId, day);
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "追加に失敗しました");
      setStatus("error");
    }
  }

  async function handleRemove(itemId: string) {
    try {
      await removePlanItem(itemId);
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "削除に失敗しました");
      setStatus("error");
    }
  }

  async function handleMoveDay(itemId: string, newDay: number) {
    try {
      await updatePlanItemDay(itemId, newDay);
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "移動に失敗しました");
      setStatus("error");
    }
  }

  async function handleReorder(day: number, index: number, direction: -1 | 1) {
    const dayItems = itemsByDay.get(day) ?? [];
    const otherIndex = index + direction;
    if (otherIndex < 0 || otherIndex >= dayItems.length) return;
    const current = dayItems[index];
    const other = dayItems[otherIndex];
    try {
      await reorderPlanItem(current.id, other.id, current.sortOrder, other.sortOrder);
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "並び替えに失敗しました");
      setStatus("error");
    }
  }

  if (status === "loading") return null;

  if (status === "not-found") {
    return (
      <div className="space-y-4 text-center">
        <p className="text-stone-500">プランが見つかりませんでした。</p>
        <Link href="/mypage/plans" className="text-brand-600 hover:underline">
          プラン一覧に戻る
        </Link>
      </div>
    );
  }

  const assignedSpotIds = new Set(items.map((item) => item.spotId));
  const unassignedSpots = spots.filter((spot) => !assignedSpotIds.has(spot.id));

  const shareText = plan
    ? `${plan.title}\n` +
      Array.from(itemsByDay.entries())
        .sort(([a], [b]) => a - b)
        .map(
          ([day, dayItems]) =>
            `${day}日目: ` +
            dayItems.map((item) => spotsById.get(item.spotId)?.spotName ?? "").join("、"),
        )
        .join("\n")
    : "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <Link href="/mypage/plans" className="text-xs text-stone-400 hover:text-brand-600">
            ← プラン一覧
          </Link>
          <h1 className="text-2xl font-bold text-stone-800">{plan?.title}</h1>
        </div>
        {plan && origin && <ShareButtons text={shareText} url={origin} />}
      </div>

      {status === "error" && <p className="text-sm text-red-600">{errorMessage}</p>}

      <div className="flex flex-col gap-4">
        {Array.from({ length: dayCount }, (_, index) => index + 1).map((day) => (
          <div key={day} className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-semibold text-stone-800">{day}日目</h2>
            {(itemsByDay.get(day) ?? []).length === 0 ? (
              <p className="text-sm text-stone-400">まだスポットが登録されていません。</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {(itemsByDay.get(day) ?? []).map((item, index, dayItems) => {
                  const spot = spotsById.get(item.spotId);
                  if (!spot) return null;
                  return (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 rounded-xl border border-stone-100 p-2"
                    >
                      <div className="relative h-12 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-stone-100">
                        <Image
                          src={spot.thumbnailUrl}
                          alt={spot.spotName}
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-stone-800">
                          {spot.spotName}
                        </p>
                        <div className="flex flex-wrap gap-2 text-xs">
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
                      <div className="flex flex-shrink-0 flex-col items-end gap-1">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => handleReorder(day, index, -1)}
                            className="rounded border border-stone-200 px-1.5 text-xs text-stone-500 hover:bg-stone-50 disabled:opacity-30"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={index === dayItems.length - 1}
                            onClick={() => handleReorder(day, index, 1)}
                            className="rounded border border-stone-200 px-1.5 text-xs text-stone-500 hover:bg-stone-50 disabled:opacity-30"
                          >
                            ↓
                          </button>
                        </div>
                        <div className="flex items-center gap-1">
                          <select
                            value={item.dayNumber}
                            onChange={(event) => handleMoveDay(item.id, Number(event.target.value))}
                            className="rounded border border-stone-200 text-xs"
                          >
                            {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => (
                              <option key={d} value={d}>
                                {d}日目へ
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleRemove(item.id)}
                            className="text-xs text-stone-400 hover:text-red-500"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setDayCount((count) => count + 1)}
          className="self-start rounded-full border border-dashed border-orange-300 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-orange-50"
        >
          + 日を追加
        </button>
      </div>

      <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold text-stone-800">行きたいリストから追加</h2>
        {unassignedSpots.length === 0 ? (
          <p className="text-sm text-stone-400">
            追加できるスポットがありません。検索画面から行きたいリストに追加してください。
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {unassignedSpots.map((spot) => (
              <li key={spot.id} className="flex items-center gap-3 rounded-xl border border-stone-100 p-2">
                <div className="relative h-12 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-stone-100">
                  <Image
                    src={spot.thumbnailUrl}
                    alt={spot.spotName}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </div>
                <p className="min-w-0 flex-1 truncate text-sm text-stone-800">{spot.spotName}</p>
                <select
                  value={addDay[spot.id] ?? 1}
                  onChange={(event) =>
                    setAddDay((current) => ({ ...current, [spot.id]: Number(event.target.value) }))
                  }
                  className="rounded border border-stone-200 text-xs"
                >
                  {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {d}日目
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleAdd(spot.id)}
                  className="rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700"
                >
                  追加
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
