import { NextRequest, NextResponse } from "next/server";
import { looksIrrelevantVideo } from "@/lib/areaRelevance";
import {
  deleteAreaVideos,
  listAreaVideoPage,
  refreshVideoCount,
  type StoredAreaVideo,
} from "@/lib/areaVideos";

/**
 * 保存済みの `area_videos` を点検し、「お出かけ・観光スポットと無関係」な行を消す。
 *
 * 取り込み側（`/api/cron/fetch-area-videos`）は `looksLikeSpotVideo` で
 * いたずら動画・日常vlogのような無関係な動画を弾いているが、このチェックは
 * これから取り込む動画にしか効かない。それ以前に貯めた行（家族vlogや
 * ドッキリ動画などが都道府県名・ジャンル語に緩くマッチして紛れ込んだもの）
 * はこのエンドポイントで掃除する。都道府県が合っているかどうかは問わない
 * （それは `/api/cron/cleanup-area-videos` の役目）。
 *
 * 削除の条件は取り込みの条件（`looksLikeSpotVideo`）の単純な否定ではない。
 * 「スポットらしいキーワードが1つも無い」を無関係とみなすと、ジャンル語を
 * 使わない食レポ動画のような正当なスポット動画まで削除対象になってしまう
 * （誤検知）。`cleanup-area-videos` が「よその県だと確認できた行」だけを
 * 消すのと同じ考え方で、こちらも `looksIrrelevantVideo`（＝いたずら動画・
 * 歌ってみた等の無関係キーワードに一致し、かつスポットらしいキーワードには
 * 一致しない）で「無関係だと確認できた行」だけを消す。判断できない行は
 * そのまま残し、件数だけ `keptAsUnknown` として報告する。
 *
 * YouTube APIは呼ばない（クォータを消費しない）。既定は点検だけの
 * ドライラン。実際に削除するときだけ `?apply=true` を付ける。
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PAGE_SIZE = 1000;
const DELETE_CHUNK_SIZE = 200;
// ドライランで「何が消えるのか」を目で確かめるために返す例の件数。
const EXAMPLE_LIMIT = 50;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "サーバーにCRON_SECRETが設定されていません" }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "認証に失敗しました" }, { status: 401 });
  }

  const apply = request.nextUrl.searchParams.get("apply") === "true";

  // 読みながら消すとページの境界がずれるので、先に全件を点検してから消す。
  const irrelevant: StoredAreaVideo[] = [];
  const irrelevantByPrefecture = new Map<string, number>();
  let scanned = 0;
  // 判断できずに残した行（無関係キーワード・スポットキーワードのどちら
  // にも一致しない動画）。消さないが、件数だけ報告する。
  let keptAsUnknown = 0;

  try {
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const page = await listAreaVideoPage(offset, PAGE_SIZE);
      scanned += page.length;

      for (const video of page) {
        if (!looksIrrelevantVideo(video.title, video.description)) {
          keptAsUnknown++;
          continue;
        }

        irrelevant.push(video);
        irrelevantByPrefecture.set(
          video.prefecture,
          (irrelevantByPrefecture.get(video.prefecture) ?? 0) + 1,
        );
      }

      if (page.length < PAGE_SIZE) break;
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "点検に失敗しました";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({
    applied: apply,
    scanned,
    irrelevantCount: irrelevant.length,
    keptAsUnknown,
    irrelevantByPrefecture: Object.fromEntries(
      [...irrelevantByPrefecture.entries()].sort((a, b) => b[1] - a[1]),
    ),
    examples: irrelevant.slice(0, EXAMPLE_LIMIT).map((video) => ({
      prefecture: video.prefecture,
      title: video.title,
    })),
    hint: apply
      ? "削除しました。件数を戻したい都道府県は 'Fetch area videos' の Run workflow（force=true）で取得し直してください。"
      : "点検のみ実行しました（削除していません）。examples が実際に消える動画です。内容を確認したうえで ?apply=true を付けて実行してください。",
  });
}
