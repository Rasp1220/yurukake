import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { VideoResult } from "./types";

/**
 * YouTube Data API v3 の検索結果キャッシュ（サーバー専用）。
 *
 * search.list は1回100ユニット消費し、デフォルトのクォータは1日10,000ユニット
 * ＝1日100回しか検索できない。検索画面を開くたび・ジャンルタグを切り替えるたびに
 * 叩いていると個人利用でもすぐ上限に達するため、同じ条件の結果を Supabase の
 * `search_cache` テーブルに保存し、TTL 内はDBから返す。
 *
 * キャッシュはあくまで高速化・節約のための仕組みなので、テーブル未作成や
 * 権限エラーで読み書きに失敗しても検索自体は止めない（YouTubeへフォールバック）。
 */

const TABLE = "search_cache";
const DEFAULT_TTL_SECONDS = 60 * 60 * 24;

export interface CachedSearch {
  results: VideoResult[];
  /** キャッシュを書き込んだ時刻（ISO8601）。 */
  fetchedAt: string;
  /** TTL 内かどうか。false でも「YouTubeが失敗したときの代替」としては使える。 */
  isFresh: boolean;
}

/** `SEARCH_CACHE_TTL_SECONDS`（秒）。未設定なら24時間。0を指定すると毎回取得しにいく。 */
export function cacheTtlSeconds(): number {
  const raw = process.env.SEARCH_CACHE_TTL_SECONDS?.trim();
  if (!raw) return DEFAULT_TTL_SECONDS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : DEFAULT_TTL_SECONDS;
}

// 同じ警告を毎リクエスト出さないための記録。
const warned = new Set<string>();

function warnOnce(context: string, message: string): void {
  const key = `${context}:${message}`;
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(
    `[search-cache] ${context}に失敗したためキャッシュを使わずに検索します: ${message}` +
      "（supabase/schema.sql を実行すると search_cache テーブルが作成されます）",
  );
}

// undefined = 未初期化、null = 環境変数が無くキャッシュ無効。
let cachedClient: SupabaseClient | null | undefined;

function getClient(): SupabaseClient | null {
  if (cachedClient !== undefined) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // キャッシュは全ユーザー共有のサーバー側データなのでログインセッションは使わない。
  // service role キーがあればRLSを迂回できるので、匿名キーへの書き込み許可を
  // 外して運用できる（詳細は supabase/schema.sql のコメント参照）。
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  cachedClient =
    url && key
      ? createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            // Next.js はサーバー側の fetch を勝手にキャッシュする（.next/cache に
            // 永続化されるため開発サーバーを再起動しても残る）。キャッシュの
            // 鮮度判定はこのモジュールが fetched_at で行うので、DBへの
            // 問い合わせ自体は必ず実際に飛ばす。
            fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
          },
        })
      : null;

  return cachedClient;
}

/** 検索条件からキャッシュキーを作る。表記ゆれ（前後の空白・大文字小文字）は吸収する。 */
export function buildCacheKey(query: string, genre: string | null): string {
  // 区切りには入力に現れない制御文字を使い、ジャンル無しの "東京 カフェ" と
  // "東京" x "カフェ" が同じキーにならないようにする。
  return `${query.trim().toLowerCase()}\u001f${genre?.trim().toLowerCase() ?? ""}`;
}

/**
 * キャッシュを読む。TTL切れでも「YouTube呼び出しが失敗したときの代替」として
 * 使えるよう、鮮度は `isFresh` で返すだけでここでは捨てない。
 */
export async function readSearchCache(
  cacheKey: string,
  maxResults: number,
): Promise<CachedSearch | null> {
  const supabase = getClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("results, max_results, fetched_at")
      .eq("cache_key", cacheKey)
      .maybeSingle();

    if (error) {
      warnOnce("キャッシュの読み込み", error.message);
      return null;
    }
    if (!data) return null;

    const results = Array.isArray(data.results) ? (data.results as VideoResult[]) : [];
    const ageSeconds = (Date.now() - new Date(data.fetched_at).getTime()) / 1000;

    // 30件のキャッシュは先頭12件を切り出せば12件要求に流用できるが、逆に
    // 12件でキャッシュした結果は30件要求には足りない。足りない場合は期限内でも
    // 「新鮮ではない」扱いにして取り直す（それでもYouTubeが失敗したときの
    // 代替としては使えるので、捨てずに返す）。
    const sufficient = (data.max_results ?? 0) >= maxResults;

    return {
      results: results.slice(0, maxResults),
      fetchedAt: data.fetched_at,
      isFresh: sufficient && ageSeconds < cacheTtlSeconds(),
    };
  } catch (error) {
    warnOnce("キャッシュの読み込み", error instanceof Error ? error.message : String(error));
    return null;
  }
}

/** 取得結果をキャッシュに書く（同じキーがあれば上書き）。 */
export async function writeSearchCache(
  cacheKey: string,
  query: string,
  genre: string | null,
  maxResults: number,
  results: VideoResult[],
): Promise<void> {
  const supabase = getClient();
  if (!supabase) return;

  try {
    const { error } = await supabase.from(TABLE).upsert(
      {
        cache_key: cacheKey,
        query: query.trim(),
        genre: genre?.trim() || null,
        max_results: maxResults,
        results,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "cache_key" },
    );

    if (error) warnOnce("キャッシュの書き込み", error.message);
  } catch (error) {
    warnOnce("キャッシュの書き込み", error instanceof Error ? error.message : String(error));
  }
}
