"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PROFILE_TAGS } from "@/lib/constants";
import type { Profile } from "@/lib/types";

export default function BloggerSearchResults({
  query,
  bloggers,
}: {
  query: string;
  bloggers: Profile[];
}) {
  const router = useRouter();
  const [text, setText] = useState(query);

  function goToQuery(nextQuery: string) {
    router.push(nextQuery ? `/bloggers?q=${encodeURIComponent(nextQuery)}` : "/bloggers");
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    goToQuery(text.trim());
  }

  function handleTagClick(tag: string) {
    setText(tag);
    goToQuery(tag);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">ブロガーを探す</h1>
        <p className="text-sm text-stone-500">
          表示名やタグでブロガーを検索できます。公開ブログを持つブロガーだけが表示されます。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex w-full gap-2">
        <input
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="例：はるか、東京"
          className="w-full rounded-full border border-orange-200 bg-white px-5 py-3 text-base shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
        <button
          type="submit"
          className="flex-shrink-0 whitespace-nowrap rounded-full bg-brand-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-brand-700"
        >
          検索
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {PROFILE_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => handleTagClick(tag)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              query === tag
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-orange-200 text-stone-600 hover:border-brand-300"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {bloggers.length === 0 ? (
        <p className="py-12 text-center text-stone-400">
          {query
            ? `「${query}」に一致するブロガーが見つかりませんでした。`
            : "公開されているブログを持つブロガーがまだいません。"}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {bloggers.map((blogger) => (
            <Link
              key={blogger.userId}
              href={`/blogger/${blogger.userId}`}
              className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm hover:border-brand-300"
            >
              <p className="font-semibold text-stone-800">{blogger.displayName || "ブロガー"}</p>
              {blogger.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {blogger.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-brand-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
