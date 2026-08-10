"use client";

import { useEffect, useState } from "react";
import SearchBar from "@/components/SearchBar";
import VideoCard from "@/components/VideoCard";
import BlogResultCard from "@/components/BlogResultCard";
import SaveModal from "@/components/SaveModal";
import Pagination from "@/components/Pagination";
import { searchVideosWithTotal } from "@/lib/youtube";
import { searchBlogs } from "@/lib/blogSearch";
import { recordSearch } from "@/lib/searchHistory";
import { GENRES } from "@/lib/constants";
import type { BlogSearchResult, VideoResult } from "@/lib/types";

const PAGE_SIZE = 50;

export default function SearchResults({ query }: { query: string }) {
  const [videos, setVideos] = useState<VideoResult[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [blogs, setBlogs] = useState<BlogSearchResult[]>([]);
  const [blogStatus, setBlogStatus] = useState<"idle" | "loading" | "error">("idle");
  const [blogErrorMessage, setBlogErrorMessage] = useState("");
  const [selectedVideo, setSelectedVideo] = useState<VideoResult | null>(null);
  const [savedMessage, setSavedMessage] = useState(false);
  const [genre, setGenre] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // 検索条件が変わったら1ページ目に戻す。
  useEffect(() => {
    setPage(1);
  }, [query, genre]);

  useEffect(() => {
    if (!query) return;
    setStatus("loading");
    searchVideosWithTotal(query, {
      maxResults: PAGE_SIZE,
      genre: genre ?? undefined,
      offset: (page - 1) * PAGE_SIZE,
      sort: "view_count",
    })
      .then(({ results, total: totalCount }) => {
        setVideos(results);
        setTotal(totalCount);
        setStatus("idle");
        if (page === 1) recordSearch(query, genre);
      })
      .catch((error) => {
        setErrorMessage(error instanceof Error ? error.message : "検索に失敗しました");
        setStatus("error");
      });
  }, [query, genre, page]);

  // ブログはYouTube動画とは独立に検索する（ジャンル・ページングは動画側だけの概念）。
  useEffect(() => {
    if (!query) {
      setBlogs([]);
      setBlogStatus("idle");
      return;
    }
    setBlogStatus("loading");
    searchBlogs(query)
      .then((results) => {
        setBlogs(results);
        setBlogStatus("idle");
      })
      .catch((error) => {
        setBlogErrorMessage(error instanceof Error ? error.message : "検索に失敗しました");
        setBlogStatus("error");
      });
  }, [query]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const nothingFound =
    Boolean(query) &&
    status === "idle" &&
    blogStatus === "idle" &&
    videos.length === 0 &&
    blogs.length === 0;

  function handlePageChange(nextPage: number) {
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="flex flex-col gap-6">
      <SearchBar initialQuery={query} />

      {query && (
        <div className="flex flex-wrap gap-2">
          {GENRES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setGenre(genre === option ? null : option)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                genre === option
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-orange-200 text-stone-600 hover:border-brand-300"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {savedMessage && (
        <div className="rounded-xl bg-green-50 px-4 py-2 text-sm text-green-700">
          行きたいリストに追加しました！プラン画面から確認できます。
        </div>
      )}

      {!query && (
        <p className="py-12 text-center text-stone-400">
          エリアやジャンルを入力して検索してください。
        </p>
      )}

      {nothingFound && (
        <p className="py-12 text-center text-stone-400">
          「{query}」に一致する動画・ブログが見つかりませんでした。
        </p>
      )}

      {query && (status === "loading" || status === "error" || videos.length > 0) && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-stone-800">YouTube動画</h2>

          {status === "loading" && (
            <p className="py-6 text-center text-stone-400">検索中...</p>
          )}

          {status === "error" && (
            <p className="py-6 text-center text-red-500">{errorMessage}</p>
          )}

          {status === "idle" && videos.length > 0 && (
            // 通常ページの幅（max-w-5xl）を超えて、PCではウィンドウ幅いっぱいに
            // 1行5件前後を並べられるよう、この一覧だけ幅の制約を外す。
            <div className="relative left-1/2 w-screen -translate-x-1/2 px-4 lg:px-8">
              <div className="mx-auto max-w-[1600px]">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {videos.map((video) => (
                    <VideoCard key={video.videoId} video={video} onOpen={setSelectedVideo} />
                  ))}
                </div>
                <Pagination page={page} totalPages={totalPages} onChange={handlePageChange} />
              </div>
            </div>
          )}
        </section>
      )}

      {query && (blogStatus === "loading" || blogStatus === "error" || blogs.length > 0) && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-stone-800">お出かけブログ</h2>

          {blogStatus === "loading" && (
            <p className="py-6 text-center text-stone-400">検索中...</p>
          )}

          {blogStatus === "error" && (
            <p className="py-6 text-center text-red-500">{blogErrorMessage}</p>
          )}

          {blogStatus === "idle" && blogs.length > 0 && (
            // 動画一覧と同じ幅の制約解除・グリッドで、見た目を揃える。
            <div className="relative left-1/2 w-screen -translate-x-1/2 px-4 lg:px-8">
              <div className="mx-auto max-w-[1600px]">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {blogs.map((blog) => (
                    <BlogResultCard key={blog.id} blog={blog} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {selectedVideo && (
        <SaveModal
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
          onSaved={() => {
            setSavedMessage(true);
            setTimeout(() => setSavedMessage(false), 3000);
          }}
        />
      )}
    </div>
  );
}
