/**
 * YouTube Data API v3 の `videos.list` 呼び出し（サーバー専用）。
 *
 * 取り込みバッチ（`/api/cron/fetch-area-videos`）とバックフィルバッチ
 * （`/api/cron/backfill-video-metadata`）の両方から使う。
 *
 * `videos.list` はクォータ1ユニット/回で、`part` を増やしても消費は変わらない。
 * そのため再生数（statistics）を取るついでに、カテゴリ（snippet）と動画の
 * 長さ（contentDetails）も**追加コストなし**で取得できる。この2つは
 * 無関係な動画の点検（`/api/cron/cleanup-irrelevant-videos`）が、タイトル・
 * 説明文の文字列マッチという当てにならない手がかりに頼らずに済むようにする
 * ためのもの。
 */

const YOUTUBE_VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";

/** `videos.list` は1回につき最大50件のIDをまとめて問い合わせられる。 */
export const VIDEOS_LIST_BATCH_SIZE = 50;
/** `videos.list` のクォータ消費（1回1ユニット。part を増やしても変わらない）。 */
export const VIDEOS_LIST_UNITS_PER_CALL = 1;

export class YouTubeError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface YouTubeVideoDetails {
  viewCount: number;
  categoryId: number | null;
  durationSeconds: number | null;
}

/**
 * ISO 8601 の再生時間（`PT1H2M3S`、`PT59S` など）を秒に直す。
 * 解釈できない値は `null`（＝長さ不明として扱い、点検の判断材料にしない）。
 */
export function parseIso8601Duration(duration: string | undefined | null): number | null {
  if (!duration) return null;

  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(duration);
  if (!match) return null;

  const [, days, hours, minutes, seconds] = match;
  // 数値がひとつも入っていない（"P" だけ、"PT" だけ）ものは長さ不明とみなす。
  if (!days && !hours && !minutes && !seconds) return null;

  return (
    Number(days ?? 0) * 86400 +
    Number(hours ?? 0) * 3600 +
    Number(minutes ?? 0) * 60 +
    Number(seconds ?? 0)
  );
}

/**
 * 動画IDから再生数・カテゴリ・長さをまとめて取得する（最大50件/回）。
 * 消費ユニット数は `Math.ceil(videoIds.length / VIDEOS_LIST_BATCH_SIZE)`。
 */
export async function fetchVideoDetails(
  videoIds: string[],
  apiKey: string,
): Promise<Map<string, YouTubeVideoDetails>> {
  const details = new Map<string, YouTubeVideoDetails>();

  for (let i = 0; i < videoIds.length; i += VIDEOS_LIST_BATCH_SIZE) {
    const batch = videoIds.slice(i, i + VIDEOS_LIST_BATCH_SIZE);
    const url = new URL(YOUTUBE_VIDEOS_URL);
    url.searchParams.set("part", "statistics,snippet,contentDetails");
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
      const viewCount = Number(item.statistics?.viewCount ?? 0);
      const categoryId = Number(item.snippet?.categoryId);

      details.set(item.id, {
        viewCount: Number.isFinite(viewCount) ? viewCount : 0,
        categoryId: Number.isFinite(categoryId) ? categoryId : null,
        durationSeconds: parseIso8601Duration(item.contentDetails?.duration),
      });
    }
  }

  return details;
}
