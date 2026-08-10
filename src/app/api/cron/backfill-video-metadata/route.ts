import { NextRequest, NextResponse } from "next/server";
import {
  countVideosMissingMetadata,
  listVideoIdsMissingMetadata,
  updateVideoMetadata,
  type VideoMetadata,
} from "@/lib/areaVideos";
import {
  fetchVideoDetails,
  VIDEOS_LIST_BATCH_SIZE,
  VIDEOS_LIST_UNITS_PER_CALL,
} from "@/lib/youtubeVideos";

/**
 * 保存済みの `area_videos` に、カテゴリ（`category_id`）と動画の長さ
 * （`duration_seconds`）を後から埋める。
 *
 * この2つは取り込みバッチが再生数と一緒に保存するようになったが、それ以前に
 * 貯めた行は空のままで、無関係な動画の点検
 * （`/api/cron/cleanup-irrelevant-videos`）が判断材料を持てない。ここで
 * まとめて補完する。
 *
 * YouTube APIは呼ぶが、`videos.list` は50件/1ユニットなので極めて安い
 * （5,000行でも100ユニット＝1日のクォータ10,000の1%）。1回の実行で処理する
 * 件数は `?limit=` で調整できる（既定2,000件＝40ユニット）。
 *
 * 何度実行しても、まだ埋まっていない行だけを対象にするので安全（冪等）。
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DEFAULT_LIMIT = 2000;
const MAX_LIMIT = 10000;

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

  const requestedLimit = Number(request.nextUrl.searchParams.get("limit") ?? DEFAULT_LIMIT);
  const limit =
    Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(Math.floor(requestedLimit), MAX_LIMIT)
      : DEFAULT_LIMIT;

  try {
    const remainingBefore = await countVideosMissingMetadata();
    const videoIds = await listVideoIdsMissingMetadata(limit);

    if (videoIds.length === 0) {
      return NextResponse.json({
        updated: 0,
        unitsUsed: 0,
        remaining: 0,
        hint: "すべての行にカテゴリ・動画の長さが入っています。補完は不要です。",
      });
    }

    const details = await fetchVideoDetails(videoIds, apiKey);
    const unitsUsed = Math.ceil(videoIds.length / VIDEOS_LIST_BATCH_SIZE) * VIDEOS_LIST_UNITS_PER_CALL;

    // YouTube側から返ってこなかったID（削除済み・非公開になった動画）は
    // カテゴリが永久に取れないので、-1 を入れて「取得を試みたが不明」と
    // 記録する。null のままだと次回以降も同じ行を無限に読み直してしまう。
    // -1 はどの実在カテゴリとも一致しないため、点検側では判断材料が無い行
    // として扱われる（＝消されない）。
    const items: VideoMetadata[] = videoIds.map((videoId) => {
      const detail = details.get(videoId);
      return {
        videoId,
        categoryId: detail?.categoryId ?? -1,
        durationSeconds: detail?.durationSeconds ?? null,
      };
    });

    await updateVideoMetadata(items);

    const resolved = items.filter((item) => item.categoryId !== -1).length;

    return NextResponse.json({
      updated: items.length,
      resolved,
      unavailable: items.length - resolved,
      unitsUsed,
      remaining: Math.max(0, remainingBefore - items.length),
      hint:
        remainingBefore > items.length
          ? "まだ残りがあります。同じワークフローをもう一度実行してください。"
          : "補完が完了しました。'Cleanup irrelevant videos' を ?inspect=true で実行すると、カテゴリ別の内訳が見られます。",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "補完に失敗しました";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
