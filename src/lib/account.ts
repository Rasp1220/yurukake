import { createClient } from "@/lib/supabase/client";

export async function getCurrentEmail(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ?? null;
}

/**
 * Supabaseの既定設定ではメールアドレス変更は確認制（新旧どちらのアドレスにも
 * 確認メールが届き、両方クリックするまで反映されない）。呼び出し側で
 * その旨を案内すること。
 */
export async function updateAccountEmail(email: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ email });
  if (error) throw new Error(error.message);
}

export async function updateAccountPassword(password: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}
