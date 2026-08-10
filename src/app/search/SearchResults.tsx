"use client";

import { useEffect, useMemo, useState } from "react";
import SearchBar from "@/components/SearchBar";
import VideoCard from "@/components/VideoCard";
import BlogResultCard from "@/components/BlogResultCard";
import SaveModal from "@/components/SaveModal";
import Pagination from "@/components/Pagination";
import Alert from "@/components/Alert";
import { searchVideosWithTotal } from "@/lib/youtube";
import { searchBlogs } from "@/lib/blogSearch";
import { recordSearch } from "@/lib/searchHistory";
import { GENRES } from "@/lib/constants";
import type { BlogSearchResult, VideoResult } from "@/lib/types";

const PAGE_SIZE = 50;

type SearchResultItem =
  | { kind: "video"; date: string; video: VideoResult }
  | { kind: "blog"; date: string; blog: BlogSearchResult };

const TYPE_FILTERS: { label: string; value: "all" | "video" | "blog" }[] = [
  { label: "すべて", value: "all" },
  { label: "YouTube", value: "video" },
  { label: "ブログ", value: "blog" },
];

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
  const [typeFilter, setTypeFilter] = useState<"all" | "video" | "blog">("all");
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
      sort: "published_at",
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

  // ブログには動画のようなページングが無いため、クエリ・ジャンルが変わった
  // ときだけ新着順で取り直す（動画のページ送りには連動させない）。
  useEffect(() => {
    if (!query) {
      setBlogs([]);
      setBlogStatus("idle");
      return;
    }
    setBlogStatus("loading");
    searchBlogs(query, genre)
      .then((results) => {
        setBlogs(results);
        setBlogStatus("idle");
      })
      .catch((error) => {
        setBlogErrorMessage(error instanceof Error ? error.message : "検索に失敗しました");
        setBlogStatus("error");
      });
  }, [query, genre]);

  // YouTube動画とブログを、種類を問わず公開日時の降順で1つの一覧にまとめる。
  // ブログはページングを持たないため、動画の2ページ目以降との重複を避けるべく
  // 1ページ目にしか混ぜない。
  const items = useMemo<SearchResultItem[]>(() => {
    const videoItems: SearchResultItem[] = videos.map((video) => ({
      kind: "video",
      date: video.publishedAt || "",
      video,
    }));
    const blogItems: SearchResultItem[] =
      page === 1
        ? blogs.map((blog) => ({ kind: "blog", date: blog.createdAt, blog }))
        : [];
    return [...videoItems, ...blogItems].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [videos, blogs, page]);

  const filteredItems = useMemo(
    () => (typeFilter === "all" ? items : items.filter((item) => item.kind === typeFilter)),
    [items, typeFilter],
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const loading = status === "loading" || (page === 1 && blogStatus === "loading");
  const nothingFound =
    Boolean(query) &&
    !loading &&
    filteredItems.length === 0 &&
    status !== "error" &&
    blogStatus !== "error";

  function handlePageChange(nextPage: number) {
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="flex flex-col gap-6">
      <SearchBar initialQuery={query} />

      {query && (
        <div className="flex flex-wrap gap-2">
          {TYPE_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setTypeFilter(option.value)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                typeFilter === option.value
                  ? "border-stone-700 bg-stone-700 text-white"
                  : "border-stone-300 text-stone-600 hover:border-stone-500"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

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
        <Alert variant="success">
          行きたいリストに追加しました！プラン画面から確認できます。
        </Alert>
      )}

      {!query && (
        <p className="py-12 text-center text-stone-400">
          エリアやジャンルを入力して検索してください。
        </p>
      )}

      {query && loading && (
        <p className="py-12 text-center text-stone-400">検索中...</p>
      )}

      {query && status === "error" && <Alert>{errorMessage}</Alert>}

      {query && page === 1 && blogStatus === "error" && <Alert>{blogErrorMessage}</Alert>}

      {nothingFound && (
        <p className="py-12 text-center text-stone-400">
          「{query}」に一致する動画・ブログが見つかりませんでした。
        </p>
      )}

      {!loading && filteredItems.length > 0 && (
        // 通常ページの幅（max-w-5xl）を超えて、PCではウィンドウ幅いっぱいに
        // 1行5件前後を並べられるよう、この一覧だけ幅の制約を外す。
        <div className="relative left-1/2 w-screen -translate-x-1/2 px-4 lg:px-8">
          <div className="mx-auto max-w-[1600px]">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {filteredItems.map((item) =>
                item.kind === "video" ? (
                  <VideoCard
                    key={`video-${item.video.videoId}`}
                    video={item.video}
                    onOpen={setSelectedVideo}
                  />
                ) : (
                  <BlogResultCard key={`blog-${item.blog.id}`} blog={item.blog} />
                ),
              )}
            </div>
            <Pagination page={page} totalPages={totalPages} onChange={handlePageChange} />
          </div>
        </div>
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
