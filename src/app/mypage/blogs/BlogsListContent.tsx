"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBlog, deleteBlog, getBlogs } from "@/lib/blogs";
import { getMyProfile, updateMyDisplayName } from "@/lib/profiles";
import type { Blog, Profile } from "@/lib/types";

export default function BlogsListContent() {
  const router = useRouter();
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [status, setStatus] = useState<"loading" | "idle" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  async function load() {
    try {
      const [blogsData, profileData] = await Promise.all([getBlogs(), getMyProfile()]);
      setBlogs(blogsData);
      setProfile(profileData);
      setDisplayName(profileData.displayName ?? "");
      setStatus("idle");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "読み込みに失敗しました");
      setStatus("error");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleProfileSave(event: React.FormEvent) {
    event.preventDefault();
    setSavingProfile(true);
    try {
      const updated = await updateMyDisplayName(displayName.trim());
      setProfile(updated);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "表示名の更新に失敗しました");
      setStatus("error");
    } finally {
      setSavingProfile(false);
    }
  }

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

      <section className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
        <h2 className="mb-1 font-semibold text-stone-800">公開プロフィール</h2>
        <p className="mb-3 text-xs text-stone-500">
          ここで設定した表示名で、公開したブログの一覧ページに名前が出ます。
        </p>
        <form onSubmit={handleProfileSave} className="flex gap-2">
          <input
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="表示名（例：はるか）"
            className="w-full rounded-full border border-orange-200 bg-white px-4 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          <button
            type="submit"
            disabled={savingProfile || displayName.trim() === (profile?.displayName ?? "")}
            className="flex-shrink-0 rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {savingProfile ? "保存中..." : "保存"}
          </button>
        </form>
        {profile && (
          <Link
            href={`/blogger/${profile.userId}`}
            target="_blank"
            className="mt-3 inline-block text-xs text-brand-600 hover:underline"
          >
            自分の公開ページを見る ↗
          </Link>
        )}
      </section>

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
