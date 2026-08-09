import type { PostgrestError } from "@supabase/supabase-js";

const SETUP_HINT =
  "Supabaseダッシュボードの SQL Editor で supabase/schema.sql を実行してください（何度実行しても安全です）。";

/**
 * SupabaseのPostgRESTエラーを、利用者が次に何をすればよいか分かる日本語に変換する。
 *
 * 特に `Could not find the table 'public.plans' in the schema cache` のように、
 * 原因がアプリではなくデータベースのセットアップ漏れであるエラーは、
 * そのまま表示しても対処法が分からないため補足を付ける。
 */
export function supabaseErrorMessage(error: PostgrestError, fallback: string): string {
  const code = error.code ?? "";
  const message = error.message ?? "";

  // カラム不足（PGRST204 / undefined_column）。schema.sqlの `alter table ... add column`
  // が未適用のときに出る。"schema cache" を含むのでテーブル不足より先に判定する。
  if (code === "PGRST204" || code === "42703") {
    return `データベースの列が最新ではありません。${SETUP_HINT}（詳細: ${message}）`;
  }

  // テーブル不足（PGRST205 / undefined_table）。schema.sql 未実行、または
  // 実行が途中でエラーになりロールバックされたときに出る。
  if (code === "PGRST205" || code === "42P01" || /schema cache/i.test(message)) {
    return `データベースのテーブルが見つかりません。${SETUP_HINT}（詳細: ${message}）`;
  }

  // RLSポリシー違反（insufficient_privilege / RLS violation）。
  if (code === "42501" || /row-level security/i.test(message)) {
    return `データベースへの保存が許可されませんでした。ログイン状態を確認するか、${SETUP_HINT}（詳細: ${message}）`;
  }

  return message || fallback;
}

/** `if (error) throwSupabaseError(error, "...")` として使うヘルパー。 */
export function throwSupabaseError(error: PostgrestError, fallback: string): never {
  throw new Error(supabaseErrorMessage(error, fallback));
}
