import { createClient } from "@/lib/supabase/client";
import { throwSupabaseError } from "@/lib/supabase/errors";
import type { Profile } from "./types";

interface ProfileRow {
  user_id: string;
  display_name: string | null;
}

function profileFromRow(userId: string, row: ProfileRow | null): Profile {
  return { userId, displayName: row?.display_name ?? null };
}

/** ログイン中のユーザーの表示名（未設定ならnull）と、公開ページのURLに使うuserId。 */
export async function getMyProfile(): Promise<Profile> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインが必要です");

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throwSupabaseError(error, "プロフィールの読み込みに失敗しました");
  return profileFromRow(user.id, data as ProfileRow | null);
}

export async function updateMyDisplayName(displayName: string): Promise<Profile> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインが必要です");

  const { data, error } = await supabase
    .from("profiles")
    .upsert({ user_id: user.id, display_name: displayName || null })
    .select()
    .single();

  if (error) throwSupabaseError(error, "表示名の更新に失敗しました");
  return profileFromRow(user.id, data as ProfileRow);
}
