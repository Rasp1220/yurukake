import { NextRequest, NextResponse } from "next/server";
import { GENRES } from "@/lib/constants";
import { PREFECTURES, type Prefecture } from "@/lib/prefectures";
import { belongsToPrefecture, isIrrelevantCategory, looksLikeSpotVideo } from "@/lib/areaRelevance";
import {
  getFetchProgressOrderedByStaleness,
  listBlockedChannels,
  recordFetchProgress,
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
 * 一度取得済みになっていれば、スケジュール実行はYouTubeを一切呼ばず
 * 即終了する（＝実質「止まっている」状態。GitHub Actions自体は無効化
 * しないので、いつでも手動実行で更新を再開できる）。
 *
 * 手動で更新したいときは、GitHub Actionsの "Run workflow"（workflow_dispatch）
 * から実行する。この場合はワークフロー側が `?force=true` を付けて呼ぶため、
 * 完了済みでもスキップせずに実際に取得し直す。
 *
 * ラウンドロビン方式：47都道府県を「深く1〜2県だけ埋めて残りは放置」
 * ではなく、「まだ目標件数に届いていない県すべてに、1回の実行で必ず
 * 最低1回は触れる」ことを優先する。
 *
 * 仕組み：ジャンルクエリ（11種類）を1つずつ「その回の担当ジャンル」として
 * 選び、まだ目標に届いていない都道府県**全員**に対してそのジャンルの
 * 1ページ目だけを取得する（＝1パス）。1パス終えたら、まだ届いていない県
 * だけを対象に次のジャンルでもう1パス、を予算が尽きるかジャンルを一巡
 * するまで繰り返す。
 *
 * 予算8,000ユニット（80回の検索呼び出し）に対して都道府県は最大47なので、
 * 1パス目でほぼ全県に届く。残った予算は自然と「まだ目標に届いていない県」
 * だけに使われる（人気県は早く目標に届いてパス対象から外れるため）。
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
// ""=総合クエリ、それ以外はジャンルを混ぜたクエリ。ラウンドロビンの
// 「1パス」はこのうち1つを使う。
const QUERY_VARIANTS: (string | null)[] = [null, ...GENRES];

// 1都道府県あたりの目標件数。これに達した県は以降のパスから除外し、
// 浮いたぶんの予算を他の県に回す。
const TARGET_VIDEOS_PER_PREFECTURE = 700;

// 安全弁。各パスは常に1ページ目（pageToken無し）しか見ないため、同じ
// ジャンルで2回目のパスを回しても同じ結果しか返らず無意味。ジャンルの
// 種類数を超えてパスを重ねることはしない（＝全ジャンルの1ページ目を
// 試し尽くしても届かない県は、今回の探索範囲では実在数が足りないという
// こと。深追いするには別途ページング対応が必要）。
const MAX_PASSES = QUERY_VARIANTS.length;

async function fetchPage(
  prefecture: Prefecture,
  genre: string | null,
  apiKey: string,
): Promise<VideoResult[]> {
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

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new YouTubeError(body?.error?.message ?? "YouTube検索に失敗しました", res.status);
  }

  const data = await res.json();
  return (data.items ?? [])
    .map((item: any) => ({
      videoId: item.id?.videoId,
      title: item.snippet?.title ?? "",
      channelTitle: item.snippet?.channelTitle ?? "",
      thumbnailUrl:
        item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.default?.url ?? "",
      publishedAt: item.snippet?.publishedAt ?? "",
      description: (item.snippet?.description ?? "").slice(0, DESCRIPTION_MAX_LENGTH),
      // search.list には再生数が含まれないため、後段の fetchVideoDetails
      // から取得して上書きする。
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
}

interface PrefectureRunResult {
  prefecture: Prefecture;
  videosUpserted: number;
  /** カテゴリ（音楽・ゲーム等）を理由に取り込まなかった件数。 */
  droppedByCategory: number;
  /** ブロックしたチャンネルの動画なので取り込まなかった件数。 */
  droppedByChannel: number;
  /** この県に何パス分（何ジャンル分）触れたか。 */
  passesUsed: number;
  /** 今回の実行で目標件数に届いたか。 */
  reachedTarget: boolean;
}

interface Accumulator {
  prefecture: Prefecture;
  baselineCount: number;
  collected: Map<string, VideoResult>;
  passesUsed: number;
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

  // すでに目標件数に達している県は、YouTubeを一切呼ばずに最初から除外する。
  // `accumulators` は一度作ったら削除しない（達成した県の記録も後段の
  // 保存処理で使うため）。「まだパスの対象か」は別の Set で管理する。
  const skippedAsSatisfied: Prefecture[] = [];
  const accumulators = new Map<Prefecture, Accumulator>();
  const pending = new Set<Prefecture>();

  for (const progress of ordered) {
    if (progress.videoCount >= TARGET_VIDEOS_PER_PREFECTURE) {
      skippedAsSatisfied.push(progress.prefecture);
      continue;
    }
    accumulators.set(progress.prefecture, {
      prefecture: progress.prefecture,
      baselineCount: progress.videoCount,
      collected: new Map(),
      passesUsed: 0,
    });
    pending.add(progress.prefecture);
  }

  let unitsUsed = 0;
  let stoppedEarlyReason: string | null = null;

  sweep: for (let pass = 0; pass < MAX_PASSES && pending.size > 0; pass++) {
    const genre = QUERY_VARIANTS[pass % QUERY_VARIANTS.length];
    // このパスの対象は、直前のパスまでで目標に届かず残っている県のみ。
    // 順序は元の優先順位（未取得の主要都道府県 → 未取得のその他 →
    // 取得済みで古い順）を保つ。
    const targets = ordered.map((p) => p.prefecture).filter((pref) => pending.has(pref));

    for (const prefecture of targets) {
      const acc = accumulators.get(prefecture)!;

      if (unitsUsed + UNITS_PER_CALL > UNIT_BUDGET_PER_RUN) {
        stoppedEarlyReason = `1回あたりのクォータ上限（${UNIT_BUDGET_PER_RUN}ユニット）に達したため中断しました。まだ目標に届いていない県は次回の実行で続きから対象になります。`;
        break sweep;
      }

      try {
        const items = await fetchPage(prefecture, genre, apiKey);
        unitsUsed += UNITS_PER_CALL;
        for (const item of items) acc.collected.set(item.videoId, item);
        acc.passesUsed++;
      } catch (error) {
        stoppedEarlyReason = error instanceof Error ? error.message : "YouTube検索に失敗しました";
        break sweep;
      }

      if (acc.baselineCount + acc.collected.size >= TARGET_VIDEOS_PER_PREFECTURE) {
        pending.delete(prefecture);
      }
    }
  }

  // 実際に1回以上パスが回った県だけ保存処理する（0回のまま予算切れで
  // 触れられなかった県は、次回の実行で最初から対象になる＝何もしない）。
  const results: PrefectureRunResult[] = [];

  for (const acc of accumulators.values()) {
    if (acc.passesUsed === 0) continue;

    let droppedByCategory = 0;
    let droppedByChannel = 0;

    if (acc.collected.size > 0) {
      try {
        const details = await fetchVideoDetails([...acc.collected.keys()], apiKey);
        unitsUsed += Math.ceil(acc.collected.size / VIDEOS_LIST_BATCH_SIZE) * VIDEOS_LIST_UNITS_PER_CALL;
        for (const video of acc.collected.values()) {
          const detail = details.get(video.videoId);
          video.viewCount = detail?.viewCount ?? 0;
          video.categoryId = detail?.categoryId ?? null;
          video.durationSeconds = detail?.durationSeconds ?? null;
        }

        // カテゴリが分かったので、ここで初めて「音楽動画・ゲーム実況」と
        // 確実に判定できる。タイトル・説明文のキーワードと違って投稿者が
        // 選んだ固定の選択肢なので、誤って弾く心配がない。
        for (const [videoId, video] of acc.collected) {
          if (isIrrelevantCategory(video.categoryId)) {
            acc.collected.delete(videoId);
            droppedByCategory++;
          }
        }
      } catch {
        // 動画情報の取得に失敗しても動画自体（タイトル・サムネイル）の保存は
        // 止めない。この場合 view_count は0、カテゴリ・長さは null のまま
        // 保存され、次回の取得かバックフィルバッチで補完される。
      }

      // 人が「無関係」と判断済みのチャンネルは、再取得でも戻さない。
      for (const [videoId, video] of acc.collected) {
        if (blockedChannels.has(video.channelTitle)) {
          acc.collected.delete(videoId);
          droppedByChannel++;
        }
      }

      if (acc.collected.size > 0) {
        await upsertAreaVideos(acc.prefecture, [...acc.collected.values()]);
      }
    }

    await recordFetchProgress(acc.prefecture);

    results.push({
      prefecture: acc.prefecture,
      videosUpserted: acc.collected.size,
      droppedByCategory,
      droppedByChannel,
      passesUsed: acc.passesUsed,
      reachedTarget: !pending.has(acc.prefecture),
    });
  }

  // 目標件数に達していて最初から飛ばした県も「もう取得しなくてよい県」
  // なので、未処理として残っている扱いにはしない。
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
