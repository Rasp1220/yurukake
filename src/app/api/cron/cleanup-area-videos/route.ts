import { NextRequest, NextResponse } from "next/server";
import { isPrefecture } from "@/lib/prefectures";
import { belongsToPrefecture } from "@/lib/areaRelevance";
import {
  deleteAreaVideos,
  listAreaVideoPage,
  refreshVideoCount,
  type StoredAreaVideo,
} from "@/lib/areaVideos";

/**
 * 保存済みの `area_videos` を点検し、「その都道府県の動画ではない」行を消す。
 *
 * 取り込み側の都道府県チェック（`src/lib/areaRelevance.ts`）はこれから取り込む
 * 動画にしか効かないため、それ以前に貯めた行（トップページの「北海道の
 * おすすめスポット」に並んでいた愛知・大阪の動画など）はこのエンドポイントで
 * 掃除する。判定ロジックはバッチと同じものを使うので、点検を通った行は
 * 「いま取り込み直しても残る行」と一致する。
 *
 * YouTube APIは呼ばない（クォータを消費しない）。既定は点検だけの
 * ドライラン。実際に削除するときだけ `?apply=true` を付ける。
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// 1回に読む行数と、1回のdeleteに渡すID数。Supabaseの1リクエストが
// 大きくなりすぎない程度に分割する。
const PAGE_SIZE = 1000;
const DELETE_CHUNK_SIZE = 200;

function isMisfiled(video: StoredAreaVideo): boolean {
  // 47都道府県以外の値が入っている行（過去の実装で入り得た想定外の値）は
  // 判定のしようがないため、まとめて掃除対象にする。
  if (!isPrefecture(video.prefecture)) return true;
  return !belongsToPrefecture(video.title, video.description, video.prefecture);
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

  const apply = request.nextUrl.searchParams.get("apply") === "true";

  // 読みながら消すとページの境界がずれるので、先に全件を点検してから消す。
  const misfiled: StoredAreaVideo[] = [];
  const removedByPrefecture = new Map<string, number>();
  let scanned = 0;

  try {
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const page = await listAreaVideoPage(offset, PAGE_SIZE);
      scanned += page.length;

      for (const video of page) {
        if (!isMisfiled(video)) continue;
        misfiled.push(video);
        removedByPrefecture.set(
          video.prefecture,
          (removedByPrefecture.get(video.prefecture) ?? 0) + 1,
        );
      }

      if (page.length < PAGE_SIZE) break;
    }

    if (apply) {
      for (let i = 0; i < misfiled.length; i += DELETE_CHUNK_SIZE) {
        await deleteAreaVideos(
          misfiled.slice(i, i + DELETE_CHUNK_SIZE).map((video) => video.videoId),
        );
      }
      for (const prefecture of removedByPrefecture.keys()) {
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
    misfiledCount: misfiled.length,
    misfiledByPrefecture: Object.fromEntries(
      [...removedByPrefecture.entries()].sort((a, b) => b[1] - a[1]),
    ),
    // ドライランで「何が消えるのか」を目で確かめられるように、先頭だけ返す。
    examples: misfiled.slice(0, 20).map((video) => ({
      prefecture: video.prefecture,
      title: video.title,
    })),
    hint: apply
      ? "削除しました。件数を戻したい都道府県は 'Fetch area videos' の Run workflow（force=true）で取得し直してください。"
      : "点検のみ実行しました（削除していません）。実際に削除するには ?apply=true を付けて実行してください。",
  });
}
