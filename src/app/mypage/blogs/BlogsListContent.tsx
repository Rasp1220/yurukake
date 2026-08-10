"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBlog, deleteBlog, getBlogs } from "@/lib/blogs";
import Alert from "@/components/Alert";
import type { Blog } from "@/lib/types";

const DEFAULT_BLOG_TITLE = "無題のブログ";

export default function BlogsListContent() {
  const router = useRouter();
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [status, setStatus] = useState<"loading" | "idle" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
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

  async function handleCreate() {
    setCreating(true);
    try {
      const blog = await createBlog(DEFAULT_BLOG_TITLE);
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

      {status === "error" && <Alert>{errorMessage}</Alert>}

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-stone-800">ブログ一覧</h2>
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating}
          className="flex-shrink-0 rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {creating ? "作成中..." : "+ 新しいブログを作成"}
        </button>
      </div>

      {blogs.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-orange-200 bg-orange-50 py-12 text-center text-stone-500">
          まだブログがありません。上のボタンから作成してみましょう。
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
                    className="object-contain"
                  />
                )}
              </Link>
              <Link href={`/mypage/blogs/${blog.id}`} className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold text-stone-800 hover:text-brand-600">
                    {blog.title}
                  </p>
                  <span
                    className={
                      blog.status === "published"
                        ? "flex-shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-medium text-brand-700"
                        : "flex-shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500"
                    }
                  >
                    {blog.status === "published" ? "公開中" : "下書き"}
                  </span>
                </div>
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
