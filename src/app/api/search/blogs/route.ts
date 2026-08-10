import { NextRequest, NextResponse } from "next/server";
import { searchBlogs } from "@/lib/publicBlogs";

// 「さがす」の横断検索から、YouTube動画検索（/api/search）と並行して
// 呼び出されるブログ検索専用ルート。
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  const genre = request.nextUrl.searchParams.get("genre")?.trim() || null;
  if (!query) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchBlogs(query, genre);
    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "検索に失敗しました";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
