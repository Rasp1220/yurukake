import { NextRequest, NextResponse } from "next/server";
import { GENRES } from "@/lib/constants";
import { PREFECTURES, type Prefecture } from "@/lib/prefectures";
import { belongsToPrefecture, looksLikeSpotVideo } from "@/lib/areaRelevance";
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
 * GitHub Actions の毎日のスケジュール実行からは `Authorization: Bearer
 * ${CRON_SECRET}` 付きで（`force` 無しで）叩かれる。47都道府県すべてが
 * 一度「本格取得」を終えていれば、スケジュール実行はYouTubeを一切呼ばず
 * 即終了する（＝実質「止まっている」状態。GitHub Actions自体は無効化
 * しないので、いつでも手動実行で更新を再開できる）。
 *
 * 手動で更新したいときは、GitHub Actionsの "Run workflow"（workflow_dispatch）
 * から実行する。この場合はワークフロー側が `?force=true` を付けて呼ぶため、
 * 完了済みでもスキップせずに実際に取得し直す。
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const YOUTUBE_VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";
const UNITS_PER_CALL = 100;
// videos.list（統計情報取得）は1回1ユニットとsearch.listよりずっと安いので、
// トップページ・もっと見るページの再生数順表示のために毎回呼んでも
// クォータへの影響はごくわずか。
const VIDEOS_LIST_UNITS_PER_CALL = 1;
const VIEW_COUNT_BATCH_SIZE = 50;
// description はUIには表示せず検索のあいまい一致にしか使わないため、DB容量
// 節約のため150文字に切り詰めて保存する（トライグラムインデックスのサイズにも効く）。
const DESCRIPTION_MAX_LENGTH = 150;

// 1回の実行で使うクォータの上限。1日のクォータ10,000のうち余裕を残す。
const UNIT_BUDGET_PER_RUN = 8000;
// 一度も本格取得していない都道府県は「本格取得」（複数キーワード×複数ページ）、
// 既に一度取得済みの都道府県は「新着チェックのみ」（1ページだけ）にする。
// 件数ではなく「取得済みかどうか」で判定することで、動画が少ない県が
// 目標件数に届かず永遠に本格取得を繰り返す事態を避ける。
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
  prefecture: Prefecture,
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
    .map((item: any) => ({
      videoId: item.id?.videoId,
      title: item.snippet?.title ?? "",
      channelTitle: item.snippet?.channelTitle ?? "",
      thumbnailUrl:
        item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.default?.url ?? "",
      publishedAt: item.snippet?.publishedAt ?? "",
      description: (item.snippet?.description ?? "").slice(0, DESCRIPTION_MAX_LENGTH),
      // search.list には再生数が含まれないため、後段の fetchViewCounts で
      // videos.list から取得して上書きする。
      viewCount: 0,
    }))
    // サムネイルが無い動画は一覧に出しても絵が出ないうえ、`thumbnail_url` は
    // NOT NULL なので、1件でも混ざるとその都道府県の upsert がまるごと失敗する。
    // 表示できないものは最初から取り込まない。
    // あわせて、お出かけ・旅行スポットらしいキーワードを含まない動画と、
    // 検索した都道府県の動画だと確認できない動画（YouTubeが緩く拾ってくる
    // よその県の話）も除外する。
    .filter(
      (item: VideoResult) =>
        item.videoId &&
        item.thumbnailUrl &&
        looksLikeSpotVideo(item.title, item.description) &&
        belongsToPrefecture(item.title, item.description, prefecture),
    );

  return { items, nextPageToken: data.nextPageToken };
}

/** videos.list（統計情報）で再生数をまとめて取得する。最大50件/回。 */
async function fetchViewCounts(
  videoIds: string[],
  apiKey: string,
): Promise<Map<string, number>> {
  const viewCounts = new Map<string, number>();

  for (let i = 0; i < videoIds.length; i += VIEW_COUNT_BATCH_SIZE) {
    const batch = videoIds.slice(i, i + VIEW_COUNT_BATCH_SIZE);
    const url = new URL(YOUTUBE_VIDEOS_URL);
    url.searchParams.set("part", "statistics");
    url.searchParams.set("id", batch.join(","));
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new YouTubeError(
        body?.error?.message ?? "YouTube動画情報の取得に失敗しました",
        res.status,
      );
    }

    const data = await res.json();
    for (const item of data.items ?? []) {
      const count = Number(item.statistics?.viewCount ?? 0);
      viewCounts.set(item.id, Number.isFinite(count) ? count : 0);
    }
  }

  return viewCounts;
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

  const force = request.nextUrl.searchParams.get("force") === "true";

  const ordered = await getFetchProgressOrderedByStaleness(PREFECTURES);

  const allFetchedAtLeastOnce = ordered.every((p) => p.lastFetchedAt !== null);
  if (!force && allFetchedAtLeastOnce) {
    return NextResponse.json({
      skipped: true,
      reason:
        "47都道府県すべて取得済みのため、今回は何もしませんでした（YouTube呼び出しゼロ）。手動で更新したい場合はGitHub Actionsの「Run workflow」から実行してください。",
    });
  }

  const results: PrefectureRunResult[] = [];
  let unitsUsed = 0;
  let stoppedEarlyReason: string | null = null;

  outer: for (const progress of ordered) {
    const mode: "full" | "maintenance" = progress.lastFetchedAt === null ? "full" : "maintenance";
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
      try {
        const viewCounts = await fetchViewCounts([...collected.keys()], apiKey);
        unitsUsed +=
          Math.ceil(collected.size / VIEW_COUNT_BATCH_SIZE) * VIDEOS_LIST_UNITS_PER_CALL;
        for (const video of collected.values()) {
          video.viewCount = viewCounts.get(video.videoId) ?? 0;
        }
      } catch {
        // 再生数の取得に失敗しても動画自体（タイトル・サムネイル）の保存は
        // 止めない。この場合 view_count は0のまま保存され、次回実行時の
        // メンテナンス取得で再取得を試みる。
      }
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

  const processedThisRun = new Set(results.map((r) => r.prefecture));
  const allComplete = ordered.every(
    (p) => p.lastFetchedAt !== null || processedThisRun.has(p.prefecture),
  );

  return NextResponse.json({
    processed: results,
    totalUnitsUsed: unitsUsed,
    stoppedEarlyReason,
    allComplete,
  });
}
