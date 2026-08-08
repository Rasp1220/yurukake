import { NextRequest, NextResponse } from "next/server";
import type { VideoResult } from "@/lib/types";

const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (!query) {
    return NextResponse.json({ error: "検索キーワードを入力してください" }, { status: 400 });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "サーバーにYOUTUBE_API_KEYが設定されていません" },
      { status: 500 },
    );
  }

  const url = new URL(YOUTUBE_SEARCH_URL);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("q", `${query} スポット 紹介`);
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", "12");
  url.searchParams.set("relevanceLanguage", "ja");
  url.searchParams.set("key", apiKey);

  const ytRes = await fetch(url.toString(), { next: { revalidate: 300 } });
  if (!ytRes.ok) {
    const body = await ytRes.json().catch(() => ({}));
    return NextResponse.json(
      { error: body?.error?.message ?? "YouTube検索に失敗しました" },
      { status: ytRes.status },
    );
  }

  const data = await ytRes.json();
  const results: VideoResult[] = (data.items ?? [])
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

  return NextResponse.json({ results });
}
