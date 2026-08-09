import { NextRequest, NextResponse } from "next/server";
import { countAreaVideos, searchAreaVideos, type AreaVideoSort } from "@/lib/areaVideos";

// サイト側はYouTube APIを直接呼ばず、事前にバッチ
// （`/api/cron/fetch-area-videos`）が貯めた `area_videos` テーブルから
// 抽出して返すだけにする。Next.js のデータキャッシュは使わない
// （DB側の鮮度をこのルートが都度読むだけで、余計な二重キャッシュは避ける）。
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (!query) {
    return NextResponse.json({ error: "検索キーワードを入力してください" }, { status: 400 });
  }
  const genre = request.nextUrl.searchParams.get("genre")?.trim() || null;

  const maxResultsParam = request.nextUrl.searchParams.get("maxResults");
  const requestedMaxResults = maxResultsParam ? Number(maxResultsParam) : NaN;
  const maxResults = Number.isFinite(requestedMaxResults)
    ? Math.min(Math.max(Math.trunc(requestedMaxResults), 1), 100)
    : 12;

  const offsetParam = request.nextUrl.searchParams.get("offset");
  const requestedOffset = offsetParam ? Number(offsetParam) : NaN;
  const offset = Number.isFinite(requestedOffset) ? Math.max(Math.trunc(requestedOffset), 0) : 0;

  const sortParam = request.nextUrl.searchParams.get("sort");
  const sort: AreaVideoSort = sortParam === "view_count" ? "view_count" : "random";

  try {
    const [results, total] = await Promise.all([
      searchAreaVideos(query, genre, maxResults, offset, sort),
      countAreaVideos(query, genre),
    ]);
    return NextResponse.json({ results, total });
  } catch (error) {
    const message = error instanceof Error ? error.message : "検索に失敗しました";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
