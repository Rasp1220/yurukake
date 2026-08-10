"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createPlan, deletePlan, getPlans } from "@/lib/plans";
import MyPageTabs from "@/components/MyPageTabs";
import SavedSpotsList from "@/components/SavedSpotsList";
import type { Plan } from "@/lib/types";

export default function PlansListContent() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [status, setStatus] = useState<"loading" | "idle" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      setPlans(await getPlans());
      setStatus("idle");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "読み込みに失敗しました");
      setStatus("error");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    try {
      await createPlan(title);
      setNewTitle("");
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "作成に失敗しました");
      setStatus("error");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deletePlan(id);
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "削除に失敗しました");
      setStatus("error");
    }
  }

  if (status === "loading") return null;

  return (
    <div className="flex flex-col gap-6">
      <MyPageTabs />

      <div>
        <h1 className="text-2xl font-bold text-stone-800">お出かけプラン</h1>
        <p className="text-sm text-stone-500">
          行きたいリストのスポットを日程ごとに組み込んで、旅のしおりを作れます。
        </p>
      </div>

      {status === "error" && <p className="text-sm text-red-600">{errorMessage}</p>}

      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          type="text"
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
          placeholder="例：週末の浅草さんぽ"
          className="w-full rounded-full border border-orange-200 bg-white px-4 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
        <button
          type="submit"
          disabled={creating}
          className="flex-shrink-0 rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {creating ? "作成中..." : "新規作成"}
        </button>
      </form>

      {plans.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-orange-200 bg-orange-50 py-12 text-center text-stone-500">
          まだプランがありません。上のフォームから作成してみましょう。
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm"
            >
              <Link href={`/mypage/plans/${plan.id}`} className="flex-1">
                <p className="font-semibold text-stone-800 hover:text-brand-600">{plan.title}</p>
                <p className="text-xs text-stone-400">
                  {new Date(plan.createdAt).toLocaleDateString("ja-JP")} 作成
                </p>
              </Link>
              <button
                onClick={() => handleDelete(plan.id)}
                className="text-xs text-stone-400 hover:text-red-500"
              >
                削除
              </button>
            </div>
          ))}
        </div>
      )}

      <hr className="border-orange-100" />

      <SavedSpotsList />
    </div>
  );
}
