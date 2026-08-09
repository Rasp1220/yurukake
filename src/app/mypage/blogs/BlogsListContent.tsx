"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBlog, deleteBlog, getBlogs } from "@/lib/blogs";
import type { Blog } from "@/lib/types";

export default function BlogsListContent() {
  const router = useRouter();
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [status, setStatus] = useState<"loading" | "idle" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      setBlogs(await getBlogs());
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
      const blog = await createBlog(title);
      router.push(`/mypage/blogs/${blog.id}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "作成に失敗しました");
      setStatus("error");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteBlog(id);
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "削除に失敗しました");
      setStatus("error");
    }
  }

  if (status === "loading") return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">お出かけブログ</h1>
        <p className="text-sm text-stone-500">
          タイトル・サムネイルを付けて、テキストや画像・動画のパーツを自由に組み合わせたブログを作れます。
        </p>
      </div>

      {status === "error" && <p className="text-sm text-red-600">{errorMessage}</p>}

      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          type="text"
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
          placeholder="例：鎌倉さんぽ日記"
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

      {blogs.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-orange-200 bg-orange-50 py-12 text-center text-stone-500">
          まだブログがありません。上のフォームから作成してみましょう。
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {blogs.map((blog) => (
            <div
              key={blog.id}
              className="flex items-center gap-3 rounded-2xl border border-orange-100 bg-white p-3 shadow-sm"
            >
              <Link
                href={`/mypage/blogs/${blog.id}`}
                className="relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-stone-100"
              >
                {blog.thumbnailUrl && (
                  <Image
                    src={blog.thumbnailUrl}
                    alt={blog.title}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                )}
              </Link>
              <Link href={`/mypage/blogs/${blog.id}`} className="min-w-0 flex-1">
                <p className="truncate font-semibold text-stone-800 hover:text-brand-600">
                  {blog.title}
                </p>
                <p className="text-xs text-stone-400">
                  {new Date(blog.createdAt).toLocaleDateString("ja-JP")} 作成
                </p>
              </Link>
              <button
                onClick={() => handleDelete(blog.id)}
                className="flex-shrink-0 text-xs text-stone-400 hover:text-red-500"
              >
                削除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
