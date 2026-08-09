import { NextRequest, NextResponse } from "next/server";
import { GENRES } from "@/lib/constants";
import { PREFECTURES, type Prefecture } from "@/lib/prefectures";
import {
  getFetchProgressOrderedByStaleness,
  recordFetchProgress,
  upsertAreaVideos,
} from "@/lib/areaVideos";
import type { VideoResult } from "@/lib/types";

/**
 * `area_videos` テーブルを埋める唯一の入り口。YouTube APIを呼ぶのはこの
 * ルートだけで、サイト側のリクエスト（/api/search）は一切YouTubeを呼ばない。
 *
 * GitHub Actions などの外部スケジューラから `Authorization: Bearer
 * ${CRON_SECRET}` 付きで定期的に（1日1回を想定）叩く。1回の実行で使う
 * クォータの上限を決めておき、最終更新が古い都道府県から順に処理する
 * ことで、47都道府県を自然にローテーションしながら埋めていく。
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const UNITS_PER_CALL = 100;

// 1回の実行で使うクォータの上限。1日のクォータ10,000のうち余裕を残す。
const UNIT_BUDGET_PER_RUN = 8000;
// この件数に達していない都道府県は「本格取得」（複数キーワード×複数ページ）、
// 達している都道府県は「新着チェックのみ」（1ページだけ）にする。
const TARGET_VIDEO_COUNT = 800;
const PAGES_FULL = 3;
const PAGES_MAINTENANCE = 1;
// ""=総合クエリ、それ以外はジャンルを混ぜたクエリ。
const QUERY_VARIANTS: (string | null)[] = [null, ...GENRES];

class YouTubeError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function fetchPage(
  prefecture: string,
  genre: string | null,
  apiKey: string,
  pageToken: string | undefined,
): Promise<{ items: VideoResult[]; nextPageToken?: string }> {
  const url = new URL(YOUTUBE_SEARCH_URL);
  url.searchParams.set("part", "snippet");
  url.searchParams.set(
    "q",
    genre ? `${prefecture} ${genre} スポット 紹介` : `${prefecture} スポット 紹介`,
  );
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", "50");
  url.searchParams.set("relevanceLanguage", "ja");
  url.searchParams.set("key", apiKey);
  if (pageToken) url.searchParams.set("pageToken", pageToken);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new YouTubeError(body?.error?.message ?? "YouTube検索に失敗しました", res.status);
  }

  const data = await res.json();
  const items: VideoResult[] = (data.items ?? [])
    .filter((item: any) => item.id?.videoId)
    .map((item: any) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      thumbnailUrl: item.snippet.thumbnails?.high?.url ?? item.snippet.thumbnails?.default?.url,
      publishedAt: item.snippet.publishedAt,
      description: item.snippet.description,
    }));

  return { items, nextPageToken: data.nextPageToken };
}

interface PrefectureRunResult {
  prefecture: Prefecture;
  mode: "full" | "maintenance";
  videosUpserted: number;
  unitsUsedSoFar: number;
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "サーバーにCRON_SECRETが設定されていません" }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "認証に失敗しました" }, { status: 401 });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "サーバーにYOUTUBE_API_KEYが設定されていません" }, { status: 500 });
  }

  const ordered = await getFetchProgressOrderedByStaleness(PREFECTURES);

  const results: PrefectureRunResult[] = [];
  let unitsUsed = 0;
  let stoppedEarlyReason: string | null = null;

  outer: for (const progress of ordered) {
    const mode: "full" | "maintenance" = progress.videoCount < TARGET_VIDEO_COUNT ? "full" : "maintenance";
    const pages = mode === "full" ? PAGES_FULL : PAGES_MAINTENANCE;
    const estimatedCost = QUERY_VARIANTS.length * pages * UNITS_PER_CALL;

    if (unitsUsed + estimatedCost > UNIT_BUDGET_PER_RUN) break;

    const collected = new Map<string, VideoResult>();

    for (const genre of QUERY_VARIANTS) {
      let pageToken: string | undefined;
      for (let page = 0; page < pages; page++) {
        try {
          const { items, nextPageToken } = await fetchPage(progress.prefecture, genre, apiKey, pageToken);
          unitsUsed += UNITS_PER_CALL;
          for (const item of items) collected.set(item.videoId, item);
          if (!nextPageToken) break;
          pageToken = nextPageToken;
        } catch (error) {
          stoppedEarlyReason = error instanceof Error ? error.message : "YouTube検索に失敗しました";
          break outer;
        }
      }
    }

    if (collected.size > 0) {
      await upsertAreaVideos(progress.prefecture, [...collected.values()]);
    }
    await recordFetchProgress(progress.prefecture);

    results.push({
      prefecture: progress.prefecture,
      mode,
      videosUpserted: collected.size,
      unitsUsedSoFar: unitsUsed,
    });
  }

  return NextResponse.json({
    processed: results,
    totalUnitsUsed: unitsUsed,
    stoppedEarlyReason,
  });
}
