import { NextRequest, NextResponse } from "next/server";
import { VIDEO_CATEGORY_LABELS } from "@/lib/constants";
import {
  isShortsDuration,
  judgeIrrelevance,
  type IrrelevanceReason,
} from "@/lib/areaRelevance";
import {
  blockChannels,
  deleteAreaVideos,
  listAreaVideoPage,
  listBlockedChannels,
  refreshVideoCount,
  type StoredAreaVideo,
} from "@/lib/areaVideos";

/**
 * 保存済みの `area_videos` を点検し、「お出かけ・観光スポットと無関係」な行を消す。
 * 都道府県が合っているかどうかは問わない（それは `/api/cron/cleanup-area-videos`
 * の役目）。YouTube APIは呼ばない（クォータを消費しない）。
 *
 * 判断材料は優先順に3つ。
 *
 * 1. **カテゴリ**（`category_id`）— 投稿者が固定の選択肢から選んだ構造化データ。
 *    カテゴリ10の動画は音楽動画であって旅行動画ではない、と言い切れる。
 * 2. **チャンネル**（`area_video_channel_blocklist`）— 人が「このチャンネルは
 *    無関係」と判断したもの。YouTubeのノイズはチャンネル単位でまとまって
 *    入るので、1件ずつ判定するより確実で速い。しかも取り込み側も参照するので、
 *    一度消したチャンネルは再取得で戻ってこない。
 * 3. **キーワード**（`IRRELEVANT_VIDEO_KEYWORDS`）— 補助。
 *
 * 当初はタイトル・説明文のキーワードだけで判断していたが、どちらも投稿者が
 * 自由に書いた文章なので推測にしかならず、誤検知が多かった。
 *
 * モード（すべてGET）：
 * - `?inspect=true` … 何も消さず、テーブルの中身をカテゴリ別・チャンネル別に
 *   集計して返す。**まずこれを見て、消す条件を決める。**
 * - 引数なし … 現在の条件で消える行のドライラン（削除しない）
 * - `?apply=true` … 実際に削除する
 * - `?blockChannel=A,B` … チャンネルA・Bを無関係リストに登録する
 *   （`apply` と併用すると、そのチャンネルの行もまとめて消える）
 * - `?deleteShorts=true` … 60秒以下の短尺動画も削除対象に含める
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PAGE_SIZE = 1000;
const DELETE_CHUNK_SIZE = 200;
// ドライランで「何が消えるのか」を目で確かめるために返す例の件数。
const EXAMPLE_LIMIT = 50;
// `?inspect=true` の集計で返すチャンネル・カテゴリの件数。
const INSPECT_CHANNEL_LIMIT = 40;

function categoryLabel(categoryId: number | null): string {
  if (categoryId === null) return "未取得（バックフィル前）";
  return VIDEO_CATEGORY_LABELS[categoryId] ?? `カテゴリ${categoryId}`;
}

/** 件数の多い順に並べて、上位だけをオブジェクトにする。 */
function topEntries(counts: Map<string, number>, limit?: number): Record<string, number> {
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return Object.fromEntries(limit ? sorted.slice(0, limit) : sorted);
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

  const params = request.nextUrl.searchParams;
  const inspect = params.get("inspect") === "true";
  const apply = params.get("apply") === "true";
  const deleteShorts = params.get("deleteShorts") === "true";
  const channelsToBlock = (params.get("blockChannel") ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  try {
    // チャンネルの登録は点検より先に済ませ、同じ実行の判定にすぐ反映させる。
    if (channelsToBlock.length > 0) {
      await blockChannels(channelsToBlock, "cleanup-irrelevant-videos から登録");
    }
    const blockedChannels = await listBlockedChannels();

    // 読みながら消すとページの境界がずれるので、先に全件を点検してから消す。
    const irrelevant: StoredAreaVideo[] = [];
    const irrelevantByPrefecture = new Map<string, number>();
    const irrelevantByReason = new Map<string, number>();
    let scanned = 0;
    // 消す根拠が無かった行。消さないが、件数だけ報告する。
    let keptAsUnknown = 0;

    // `?inspect=true` 用のテーブル全体の集計。
    const allByCategory = new Map<string, number>();
    const allByChannel = new Map<string, number>();
    const categorySamples = new Map<string, string>();
    let shortsCount = 0;
    let missingMetadata = 0;

    for (let offset = 0; ; offset += PAGE_SIZE) {
      const page = await listAreaVideoPage(offset, PAGE_SIZE);
      scanned += page.length;

      for (const video of page) {
        const label = categoryLabel(video.categoryId);
        allByCategory.set(label, (allByCategory.get(label) ?? 0) + 1);
        allByChannel.set(video.channelTitle, (allByChannel.get(video.channelTitle) ?? 0) + 1);
        if (!categorySamples.has(label)) categorySamples.set(label, video.title);
        if (video.categoryId === null) missingMetadata++;
        if (isShortsDuration(video.durationSeconds)) shortsCount++;

        const reason: IrrelevanceReason | null = judgeIrrelevance(video, {
          blockedChannels,
          deleteShorts,
        });
        if (!reason) {
          keptAsUnknown++;
          continue;
        }

        irrelevant.push(video);
        irrelevantByReason.set(reason, (irrelevantByReason.get(reason) ?? 0) + 1);
        irrelevantByPrefecture.set(
          video.prefecture,
          (irrelevantByPrefecture.get(video.prefecture) ?? 0) + 1,
        );
      }

      if (page.length < PAGE_SIZE) break;
    }

    if (inspect) {
      return NextResponse.json({
        inspected: true,
        total: scanned,
        missingMetadata,
        shortsCount,
        byCategory: topEntries(allByCategory),
        categorySamples: Object.fromEntries(categorySamples),
        topChannels: topEntries(allByChannel, INSPECT_CHANNEL_LIMIT),
        blockedChannels: [...blockedChannels],
        wouldDelete: {
          total: irrelevant.length,
          byReason: topEntries(irrelevantByReason),
        },
        hint:
          missingMetadata > 0
            ? `カテゴリ未取得の行が${missingMetadata}件あります。先に 'Backfill video metadata' を実行すると、カテゴリを根拠にした点検ができるようになります。`
            : "byCategory・topChannels を見て、消したいカテゴリがあれば IRRELEVANT_VIDEO_CATEGORY_IDS に追加、消したいチャンネルは ?blockChannel=名前 で登録してください。",
      });
    }

    if (apply) {
      for (let i = 0; i < irrelevant.length; i += DELETE_CHUNK_SIZE) {
        await deleteAreaVideos(
          irrelevant.slice(i, i + DELETE_CHUNK_SIZE).map((video) => video.videoId),
        );
      }
      for (const prefecture of irrelevantByPrefecture.keys()) {
        await refreshVideoCount(prefecture);
      }
    }

    return NextResponse.json({
      applied: apply,
      scanned,
      missingMetadata,
      blockedChannelsAdded: channelsToBlock,
      irrelevantCount: irrelevant.length,
      keptAsUnknown,
      irrelevantByReason: topEntries(irrelevantByReason),
      irrelevantByPrefecture: topEntries(irrelevantByPrefecture),
      examples: irrelevant.slice(0, EXAMPLE_LIMIT).map((video) => ({
        prefecture: video.prefecture,
        channelTitle: video.channelTitle,
        category: categoryLabel(video.categoryId),
        title: video.title,
      })),
      hint: apply
        ? "削除しました。件数を戻したい都道府県は 'Fetch area videos' の Run workflow（force=true）で取得し直してください。"
        : "点検のみ実行しました（削除していません）。examples が実際に消える動画です。内容を確認したうえで apply を付けて実行してください。中身の全体像を見たいときは ?inspect=true。",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "点検に失敗しました";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
