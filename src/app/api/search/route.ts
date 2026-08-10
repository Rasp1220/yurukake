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
  const sort: AreaVideoSort =
    sortParam === "view_count" || sortParam === "published_at" ? sortParam : "random";

  // 総件数はページング表示（もっと見るページ）だけが必要とする。トップページの
  // エリア枠・おすすめ枠まで数えると、1回の表示でテーブル全体を走査する
  // count クエリが枠の数だけ走ってしまうため、明示的に要求されたときだけ数える。
  const withTotal = request.nextUrl.searchParams.get("withTotal") === "true";

  try {
    const [results, total] = await Promise.all([
      searchAreaVideos(query, genre, maxResults, offset, sort),
      withTotal ? countAreaVideos(query, genre) : Promise.resolve(0),
    ]);
    return NextResponse.json({ results, total });
  } catch (error) {
    const message = error instanceof Error ? error.message : "検索に失敗しました";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
