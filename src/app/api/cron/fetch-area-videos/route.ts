import { NextRequest, NextResponse } from "next/server";
import { GENRES } from "@/lib/constants";
import { PREFECTURES, type Prefecture } from "@/lib/prefectures";
import { belongsToPrefecture, isIrrelevantCategory, looksLikeSpotVideo } from "@/lib/areaRelevance";
import {
  getFetchProgressOrderedByStaleness,
  listBlockedChannels,
  recordFetchProgress,
  refreshVideoCount,
  upsertAreaVideos,
} from "@/lib/areaVideos";
import {
  fetchVideoDetails,
  VIDEOS_LIST_BATCH_SIZE,
  VIDEOS_LIST_UNITS_PER_CALL,
  YouTubeError,
} from "@/lib/youtubeVideos";
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
const UNITS_PER_CALL = 100;
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

// 1都道府県あたりの目標件数。これに達した県はそこで打ち切り、余った
// クォータを他の県に回す。
//
// これが無かった頃は、件数に関係なく必ず11変化×3ページ＝3,300ユニットを
// 使い切っていたため、1日の予算8,000で2県分しか処理できなかった。動画が
// 豊富な県は3,300ユニットを使い切るずっと手前で十分な件数が集まるので、
// そこで切り上げれば同じ予算でより多くの県を埋められる。
//
// 判定には `area_fetch_progress.video_count`（保存済み件数）と、その実行で
// 新たに集めた件数の合計を使う。集めた分には保存済みと重複するものが
// 含まれうるため厳密な件数ではないが、あくまでクォータ配分のための
// 目安なので概算で構わない（次回以降の実行で自然に埋まる）。
const TARGET_VIDEOS_PER_PREFECTURE = 700;

// ある県に着手するために最低限残っていてほしい予算（全ジャンルの1ページ目を
// 回せるだけ）。これ未満なら中途半端に始めず、その回は終了する。
const MIN_UNITS_TO_START_PREFECTURE = QUERY_VARIANTS.length * UNITS_PER_CALL;

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

interface PrefectureRunResult {
  prefecture: Prefecture;
  mode: "full" | "maintenance";
  videosUpserted: number;
  /** カテゴリ（音楽・ゲーム等）を理由に取り込まなかった件数。 */
  droppedByCategory: number;
  /** ブロックしたチャンネルの動画なので取り込まなかった件数。 */
  droppedByChannel: number;
  unitsUsedSoFar: number;
  /** 予算切れで途中打ち切りになった（次回やり直す）。 */
  interrupted?: boolean;
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

  // 人が「無関係」と判断したチャンネル。取れなくても取り込み自体は続ける
  // （その場合はチャンネル単位の除外が効かないだけ）。
  const blockedChannels = await listBlockedChannels().catch(() => new Set<string>());

  const results: PrefectureRunResult[] = [];
  // すでに目標件数に達していて、今回は何もしなかった県。
  const skippedAsSatisfied: Prefecture[] = [];
  let unitsUsed = 0;
  let stoppedEarlyReason: string | null = null;

  outer: for (const progress of ordered) {
    // すでに目標件数に達している県は、YouTubeを一切呼ばずに飛ばす。
    // 浮いたクォータはこのあとの、まだ件数が足りない県に回る。
    const shortfall = TARGET_VIDEOS_PER_PREFECTURE - progress.videoCount;
    if (shortfall <= 0) {
      skippedAsSatisfied.push(progress.prefecture);
      continue;
    }

    const mode: "full" | "maintenance" = progress.lastFetchedAt === null ? "full" : "maintenance";
    const pages = mode === "full" ? PAGES_FULL : PAGES_MAINTENANCE;

    // 着手できるだけの予算が残っているかだけを見る。
    //
    // 以前はここで最悪ケース（全ジャンル×全ページ＝3,300ユニット）を丸ごと
    // 予約していたが、目標件数で早めに切り上げるようになると実際の消費は
    // それよりずっと少なくなるため、予約が重すぎて「まだ2,000ユニット余って
    // いるのに次の県に着手できない」という取りこぼしが出る。実際の消費に
    // 応じて詰め込めるよう、予約は「全ジャンルの1ページ目だけは回せる」
    // 最低ラインに留め、以降は1呼び出しごとに残高を確認する。
    if (unitsUsed + MIN_UNITS_TO_START_PREFECTURE > UNIT_BUDGET_PER_RUN) break;

    const collected = new Map<string, VideoResult>();
    // 予算切れで途中打ち切りになったか。この場合その県は「取得済み」には
    // せず、次回の実行で最初からやり直す。
    let budgetExhausted = false;

    genres: for (const genre of QUERY_VARIANTS) {
      if (collected.size >= shortfall) break;

      let pageToken: string | undefined;
      for (let page = 0; page < pages; page++) {
        if (unitsUsed + UNITS_PER_CALL > UNIT_BUDGET_PER_RUN) {
          budgetExhausted = true;
          stoppedEarlyReason = `1回あたりのクォータ上限（${UNIT_BUDGET_PER_RUN}ユニット）に達したため中断しました。${progress.prefecture}は取得途中なので次回やり直します。`;
          break genres;
        }

        try {
          const { items, nextPageToken } = await fetchPage(progress.prefecture, genre, apiKey, pageToken);
          unitsUsed += UNITS_PER_CALL;
          for (const item of items) collected.set(item.videoId, item);
          // 目標に届いたらこの県は打ち切って次の県へ。
          if (collected.size >= shortfall) break genres;
          if (!nextPageToken) break;
          pageToken = nextPageToken;
        } catch (error) {
          stoppedEarlyReason = error instanceof Error ? error.message : "YouTube検索に失敗しました";
          break outer;
        }
      }
    }

    let droppedByCategory = 0;
    let droppedByChannel = 0;

    if (collected.size > 0) {
      try {
        const details = await fetchVideoDetails([...collected.keys()], apiKey);
        unitsUsed += Math.ceil(collected.size / VIDEOS_LIST_BATCH_SIZE) * VIDEOS_LIST_UNITS_PER_CALL;
        for (const video of collected.values()) {
          const detail = details.get(video.videoId);
          video.viewCount = detail?.viewCount ?? 0;
          video.categoryId = detail?.categoryId ?? null;
          video.durationSeconds = detail?.durationSeconds ?? null;
        }

        // カテゴリが分かったので、ここで初めて「音楽動画・ゲーム実況」と
        // 確実に判定できる。タイトル・説明文のキーワードと違って投稿者が
        // 選んだ固定の選択肢なので、誤って弾く心配がない。
        for (const [videoId, video] of collected) {
          if (isIrrelevantCategory(video.categoryId)) {
            collected.delete(videoId);
            droppedByCategory++;
          }
        }
      } catch {
        // 動画情報の取得に失敗しても動画自体（タイトル・サムネイル）の保存は
        // 止めない。この場合 view_count は0、カテゴリ・長さは null のまま
        // 保存され、次回のメンテナンス取得かバックフィルバッチで補完される。
      }

      // 人が「無関係」と判断済みのチャンネルは、再取得でも戻さない。
      for (const [videoId, video] of collected) {
        if (blockedChannels.has(video.channelTitle)) {
          collected.delete(videoId);
          droppedByChannel++;
        }
      }

      if (collected.size > 0) {
        await upsertAreaVideos(progress.prefecture, [...collected.values()]);
      }
    }

    if (budgetExhausted) {
      // 取れた分は保存するが「取得済み」にはしない（`last_fetched_at` を
      // 更新しない）ので、次回の実行でこの県が本格取得からやり直される。
      // 件数だけは実態に合わせておく。
      await refreshVideoCount(progress.prefecture);
    } else {
      await recordFetchProgress(progress.prefecture);
    }

    results.push({
      prefecture: progress.prefecture,
      mode,
      videosUpserted: collected.size,
      droppedByCategory,
      droppedByChannel,
      unitsUsedSoFar: unitsUsed,
      ...(budgetExhausted ? { interrupted: true } : {}),
    });

    if (budgetExhausted) break;
  }

  // 目標件数に達していて飛ばした県も「もう取得しなくてよい県」なので、
  // 未処理として残っている扱いにはしない。
  const handledThisRun = new Set<Prefecture>([
    ...results.map((r) => r.prefecture),
    ...skippedAsSatisfied,
  ]);
  const allComplete = ordered.every(
    (p) => p.lastFetchedAt !== null || handledThisRun.has(p.prefecture),
  );

  return NextResponse.json({
    processed: results,
    targetPerPrefecture: TARGET_VIDEOS_PER_PREFECTURE,
    skippedAsSatisfied,
    totalUnitsUsed: unitsUsed,
    stoppedEarlyReason,
    allComplete,
  });
}
