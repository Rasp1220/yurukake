import { NextRequest, NextResponse } from "next/server";
import { buildCacheKey, readSearchCache, writeSearchCache } from "@/lib/searchCache";
import type { VideoResult } from "@/lib/types";

const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";

// キャッシュは Supabase の search_cache テーブルで管理するので、Next.js の
// データキャッシュは使わない（二重にキャッシュすると鮮度が読めなくなるため）。
export const dynamic = "force-dynamic";

class YouTubeError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function fetchFromYouTube(
  query: string,
  genre: string | null,
  maxResults: number,
  apiKey: string,
): Promise<VideoResult[]> {
  const url = new URL(YOUTUBE_SEARCH_URL);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("q", genre ? `${query} ${genre} スポット 紹介` : `${query} スポット 紹介`);
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", String(maxResults));
  url.searchParams.set("relevanceLanguage", "ja");
  url.searchParams.set("key", apiKey);

  const ytRes = await fetch(url.toString(), { cache: "no-store" });
  if (!ytRes.ok) {
    const body = await ytRes.json().catch(() => ({}));
    throw new YouTubeError(
      body?.error?.message ?? "YouTube検索に失敗しました",
      ytRes.status,
    );
  }

  const data = await ytRes.json();
  return (data.items ?? [])
    .filter((item: any) => item.id?.videoId)
    .map((item: any) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      thumbnailUrl:
        item.snippet.thumbnails?.high?.url ?? item.snippet.thumbnails?.default?.url,
      publishedAt: item.snippet.publishedAt,
      description: item.snippet.description,
    }));
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (!query) {
    return NextResponse.json({ error: "検索キーワードを入力してください" }, { status: 400 });
  }
  const genre = request.nextUrl.searchParams.get("genre")?.trim() || null;

  const maxResultsParam = request.nextUrl.searchParams.get("maxResults");
  const requestedMaxResults = maxResultsParam ? Number(maxResultsParam) : NaN;
  const maxResults = Number.isFinite(requestedMaxResults)
    ? Math.min(Math.max(Math.trunc(requestedMaxResults), 1), 50)
    : 12;

  // 1. まずDBのキャッシュを見る。TTL内ならYouTubeを呼ばずに返す。
  const cacheKey = buildCacheKey(query, genre);
  const cached = await readSearchCache(cacheKey, maxResults);
  if (cached?.isFresh) {
    return NextResponse.json({
      results: cached.results,
      cached: true,
      fetchedAt: cached.fetchedAt,
    });
  }

  // TTL切れのキャッシュは捨てずに取っておき、YouTube側が失敗したときに返す。
  // クォータ超過（403）でも古い結果が出るほうが、何も出ないよりましなため。
  function staleResponse(reason: string) {
    console.warn(`[search] YouTube検索に失敗したため期限切れキャッシュを返します: ${reason}`);
    return NextResponse.json({
      results: cached!.results,
      cached: true,
      stale: true,
      fetchedAt: cached!.fetchedAt,
    });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    if (cached) return staleResponse("YOUTUBE_API_KEYが未設定");
    return NextResponse.json(
      { error: "サーバーにYOUTUBE_API_KEYが設定されていません" },
      { status: 500 },
    );
  }

  // 2. キャッシュが無い／古い場合だけYouTubeを叩く。
  let results: VideoResult[];
  try {
    results = await fetchFromYouTube(query, genre, maxResults, apiKey);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "YouTube検索に失敗しました";
    if (cached) return staleResponse(message);
    return NextResponse.json(
      { error: message },
      { status: error instanceof YouTubeError ? error.status : 502 },
    );
  }

  // 3. 次回以降のためにキャッシュへ書き戻す（失敗しても検索結果は返す）。
  await writeSearchCache(cacheKey, query, genre, maxResults, results);

  return NextResponse.json({ results, cached: false });
}
