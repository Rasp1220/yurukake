import { NextRequest, NextResponse } from "next/server";
import { searchAreaVideos } from "@/lib/areaVideos";

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

  try {
    const results = await searchAreaVideos(query, genre, maxResults);
    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "検索に失敗しました";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
