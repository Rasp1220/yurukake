"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import {
  addBlogBlock,
  getBlog,
  getBlogBlocks,
  removeBlogBlock,
  reorderBlogBlock,
  updateBlogBlockContent,
  updateBlogStatus,
  updateBlogThumbnail,
  updateBlogTitle,
  uploadBlogMedia,
} from "@/lib/blogs";
import type { Blog, BlogBlock, BlogBlockType } from "@/lib/types";

// TinyMCEはブラウザのグローバルオブジェクトに依存するため、サーバー側では
// 描画せずクライアントでのみ読み込む。
const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-80 items-center justify-center rounded-lg border border-stone-200 text-sm text-stone-400">
      エディターを読み込み中...
    </div>
  ),
});

const BLOCK_LABELS: Record<BlogBlockType, string> = {
  text: "テキスト",
  image: "画像",
  video: "動画",
};

export default function BlogEditContent({ blogId }: { blogId: string }) {
  const [blog, setBlog] = useState<Blog | null>(null);
  const [blocks, setBlocks] = useState<BlogBlock[]>([]);
  const [status, setStatus] = useState<"loading" | "idle" | "error" | "not-found">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const [title, setTitle] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [thumbnailUploading, setThumbnailUploading] = useState(false);

  const [textDrafts, setTextDrafts] = useState<Record<string, string>>({});
  const [busyBlockId, setBusyBlockId] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);

  async function load() {
    try {
      const [blogData, blockData] = await Promise.all([
        getBlog(blogId),
        getBlogBlocks(blogId),
      ]);
      if (!blogData) {
        setStatus("not-found");
        return;
      }
      setBlog(blogData);
      setTitle(blogData.title);
      setBlocks(blockData);
      setStatus("idle");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "読み込みに失敗しました");
      setStatus("error");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blogId]);

  function reportError(error: unknown, fallback: string) {
    setErrorMessage(error instanceof Error ? error.message : fallback);
    setStatus("error");
  }

  async function handleTitleSave(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || !blog) return;
    setSavingTitle(true);
    try {
      await updateBlogTitle(blog.id, trimmed);
      setBlog({ ...blog, title: trimmed });
    } catch (error) {
      reportError(error, "タイトルの更新に失敗しました");
    } finally {
      setSavingTitle(false);
    }
  }

  async function handleToggleStatus() {
    if (!blog) return;
    const nextStatus = blog.status === "published" ? "draft" : "published";
    setSavingStatus(true);
    try {
      await updateBlogStatus(blog.id, nextStatus);
      setBlog({ ...blog, status: nextStatus });
    } catch (error) {
      reportError(error, "公開設定の更新に失敗しました");
    } finally {
      setSavingStatus(false);
    }
  }

  async function handleThumbnailChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !blog) return;
    setThumbnailUploading(true);
    try {
      const url = await uploadBlogMedia(file);
      await updateBlogThumbnail(blog.id, url);
      setBlog({ ...blog, thumbnailUrl: url });
    } catch (error) {
      reportError(error, "サムネイルのアップロードに失敗しました");
    } finally {
      setThumbnailUploading(false);
    }
  }

  async function handleThumbnailRemove() {
    if (!blog) return;
    try {
      await updateBlogThumbnail(blog.id, null);
      setBlog({ ...blog, thumbnailUrl: null });
    } catch (error) {
      reportError(error, "サムネイルの削除に失敗しました");
    }
  }

  async function handleAddBlock(type: BlogBlockType) {
    try {
      const block = await addBlogBlock(blogId, type);
      setBlocks((current) => [...current, block]);
    } catch (error) {
      reportError(error, "パーツの追加に失敗しました");
    }
  }

  async function handleRemoveBlock(blockId: string) {
    try {
      await removeBlogBlock(blockId);
      setBlocks((current) => current.filter((block) => block.id !== blockId));
      setTextDrafts((current) => {
        const next = { ...current };
        delete next[blockId];
        return next;
      });
    } catch (error) {
      reportError(error, "パーツの削除に失敗しました");
    }
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const otherIndex = index + direction;
    if (otherIndex < 0 || otherIndex >= blocks.length) return;
    const current = blocks[index];
    const other = blocks[otherIndex];
    try {
      await reorderBlogBlock(current.id, other.id, current.sortOrder, other.sortOrder);
      const next = [...blocks];
      next[index] = { ...other, sortOrder: current.sortOrder };
      next[otherIndex] = { ...current, sortOrder: other.sortOrder };
      setBlocks(next);
    } catch (error) {
      reportError(error, "並び替えに失敗しました");
    }
  }

  async function handleTextSave(blockId: string) {
    const html = textDrafts[blockId];
    if (html === undefined) return;
    setBusyBlockId(blockId);
    try {
      await updateBlogBlockContent(blockId, html);
      setBlocks((current) =>
        current.map((block) => (block.id === blockId ? { ...block, content: html } : block)),
      );
    } catch (error) {
      reportError(error, "テキストの保存に失敗しました");
    } finally {
      setBusyBlockId(null);
    }
  }

  async function handleMediaChange(
    blockId: string,
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusyBlockId(blockId);
    try {
      const url = await uploadBlogMedia(file);
      await updateBlogBlockContent(blockId, url);
      setBlocks((current) =>
        current.map((block) => (block.id === blockId ? { ...block, content: url } : block)),
      );
    } catch (error) {
      reportError(error, "アップロードに失敗しました");
    } finally {
      setBusyBlockId(null);
    }
  }

  if (status === "loading") return null;

  if (status === "not-found") {
    return (
      <div className="space-y-4 text-center">
        <p className="text-stone-500">ブログが見つかりませんでした。</p>
        <Link href="/mypage/blogs" className="text-brand-600 hover:underline">
          ブログ一覧に戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/mypage/blogs"
          className="inline-flex items-center gap-1 text-sm font-medium text-stone-500 hover:text-brand-600"
        >
          ← ブログ一覧に戻る
        </Link>
        <h1 className="text-2xl font-bold text-stone-800">{blog?.title}</h1>
      </div>

      {status === "error" && <p className="text-sm text-red-600">{errorMessage}</p>}

      {blog && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
          <div>
            <h2 className="font-semibold text-stone-800">公開設定</h2>
            <p className="text-xs text-stone-500">
              {blog.status === "published"
                ? "公開中：ブロガープロフィールから誰でも閲覧できます"
                : "下書き：自分だけが閲覧できます"}
            </p>
            {blog.status === "published" && (
              <Link
                href={`/blogs/${blog.id}`}
                target="_blank"
                className="text-xs text-brand-600 hover:underline"
              >
                公開ページを見る ↗
              </Link>
            )}
          </div>
          <button
            type="button"
            onClick={handleToggleStatus}
            disabled={savingStatus}
            className={
              blog.status === "published"
                ? "rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-60"
                : "rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            }
          >
            {savingStatus ? "更新中..." : blog.status === "published" ? "下書きに戻す" : "公開する"}
          </button>
        </section>
      )}

      <section className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold text-stone-800">タイトル</h2>
        <form onSubmit={handleTitleSave} className="flex gap-2">
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-full border border-orange-200 bg-white px-4 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          <button
            type="submit"
            disabled={savingTitle || title.trim() === blog?.title}
            className="flex-shrink-0 rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {savingTitle ? "保存中..." : "保存"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold text-stone-800">サムネイル</h2>
        {blog?.thumbnailUrl && (
          <div className="relative mb-3 h-40 w-full overflow-hidden rounded-xl bg-stone-100">
            <Image
              src={blog.thumbnailUrl}
              alt={blog.title}
              fill
              sizes="480px"
              className="object-cover"
            />
          </div>
        )}
        <div className="flex items-center gap-3">
          <label className="cursor-pointer rounded-full border border-orange-300 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-orange-50">
            {thumbnailUploading
              ? "アップロード中..."
              : blog?.thumbnailUrl
                ? "画像を変更"
                : "画像を選択"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={thumbnailUploading}
              onChange={handleThumbnailChange}
            />
          </label>
          {blog?.thumbnailUrl && (
            <button
              type="button"
              onClick={handleThumbnailRemove}
              className="text-xs text-stone-400 hover:text-red-500"
            >
              削除
            </button>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-semibold text-stone-800">本文パーツ</h2>

        {blocks.length === 0 && (
          <p className="rounded-2xl border border-dashed border-orange-200 bg-orange-50 py-8 text-center text-sm text-stone-500">
            下のボタンからテキストや画像・動画のパーツを追加しましょう。
          </p>
        )}

        {blocks.map((block, index) => (
          <div
            key={block.id}
            className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
                {BLOCK_LABELS[block.type]}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => handleMove(index, -1)}
                  className="rounded border border-stone-200 px-1.5 text-xs text-stone-500 hover:bg-stone-50 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={index === blocks.length - 1}
                  onClick={() => handleMove(index, 1)}
                  className="rounded border border-stone-200 px-1.5 text-xs text-stone-500 hover:bg-stone-50 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveBlock(block.id)}
                  className="ml-2 text-xs text-stone-400 hover:text-red-500"
                >
                  削除
                </button>
              </div>
            </div>

            {block.type === "text" && (
              <div className="flex flex-col gap-2">
                <RichTextEditor
                  value={textDrafts[block.id] ?? block.content}
                  onChange={(html) =>
                    setTextDrafts((current) => ({ ...current, [block.id]: html }))
                  }
                />
                <button
                  type="button"
                  onClick={() => handleTextSave(block.id)}
                  disabled={
                    busyBlockId === block.id ||
                    (textDrafts[block.id] ?? block.content) === block.content
                  }
                  className="self-end rounded-full bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {busyBlockId === block.id ? "保存中..." : "テキストを保存"}
                </button>
              </div>
            )}

            {block.type === "image" && (
              <div className="flex flex-col gap-2">
                {block.content ? (
                  <div className="relative h-56 w-full overflow-hidden rounded-xl bg-stone-100">
                    <Image
                      src={block.content}
                      alt=""
                      fill
                      sizes="480px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-stone-200 py-8 text-center text-sm text-stone-400">
                    画像が未設定です
                  </p>
                )}
                <label className="cursor-pointer self-start rounded-full border border-orange-300 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-orange-50">
                  {busyBlockId === block.id
                    ? "アップロード中..."
                    : block.content
                      ? "画像を変更"
                      : "画像を選択"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={busyBlockId === block.id}
                    onChange={(event) => handleMediaChange(block.id, event)}
                  />
                </label>
              </div>
            )}

            {block.type === "video" && (
              <div className="flex flex-col gap-2">
                {block.content ? (
                  <video src={block.content} controls className="w-full rounded-xl bg-black" />
                ) : (
                  <p className="rounded-xl border border-dashed border-stone-200 py-8 text-center text-sm text-stone-400">
                    動画が未設定です
                  </p>
                )}
                <label className="cursor-pointer self-start rounded-full border border-orange-300 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-orange-50">
                  {busyBlockId === block.id
                    ? "アップロード中..."
                    : block.content
                      ? "動画を変更"
                      : "動画を選択"}
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    disabled={busyBlockId === block.id}
                    onChange={(event) => handleMediaChange(block.id, event)}
                  />
                </label>
              </div>
            )}
          </div>
        ))}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleAddBlock("text")}
            className="rounded-full border border-dashed border-orange-300 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-orange-50"
          >
            + テキストを追加
          </button>
          <button
            type="button"
            onClick={() => handleAddBlock("image")}
            className="rounded-full border border-dashed border-orange-300 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-orange-50"
          >
            + 画像を追加
          </button>
          <button
            type="button"
            onClick={() => handleAddBlock("video")}
            className="rounded-full border border-dashed border-orange-300 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-orange-50"
          >
            + 動画を追加
          </button>
        </div>
      </section>
    </div>
  );
}
