import { createClient } from "@/lib/supabase/client";
import { throwSupabaseError } from "@/lib/supabase/errors";
import type { Profile } from "./types";

const MEDIA_BUCKET = "blog-media";

interface ProfileRow {
  user_id: string;
  display_name: string | null;
  tags: string[];
  avatar_url: string | null;
  twitter_url: string | null;
  instagram_url: string | null;
  youtube_url: string | null;
  website_url: string | null;
}

function profileFromRow(userId: string, row: ProfileRow | null): Profile {
  return {
    userId,
    displayName: row?.display_name ?? null,
    tags: row?.tags ?? [],
    avatarUrl: row?.avatar_url ?? null,
    twitterUrl: row?.twitter_url ?? null,
    instagramUrl: row?.instagram_url ?? null,
    youtubeUrl: row?.youtube_url ?? null,
    websiteUrl: row?.website_url ?? null,
  };
}

/** ログイン中のユーザーのプロフィールと、公開ページのURLに使うuserId。未設定の項目はnull／空配列。 */
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

export async function updateMyProfile(input: {
  displayName: string;
  tags: string[];
  twitterUrl: string;
  instagramUrl: string;
  youtubeUrl: string;
  websiteUrl: string;
}): Promise<Profile> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインが必要です");

  const { data, error } = await supabase
    .from("profiles")
    .upsert({
      user_id: user.id,
      display_name: input.displayName || null,
      tags: input.tags,
      twitter_url: input.twitterUrl || null,
      instagram_url: input.instagramUrl || null,
      youtube_url: input.youtubeUrl || null,
      website_url: input.websiteUrl || null,
    })
    .select()
    .single();

  if (error) throwSupabaseError(error, "プロフィールの更新に失敗しました");
  return profileFromRow(user.id, data as ProfileRow);
}

/** アップロードした画像の公開URLをプロフィール画像として保存する（他の項目は変更しない）。 */
export async function updateMyAvatar(avatarUrl: string | null): Promise<Profile> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインが必要です");

  const { data, error } = await supabase
    .from("profiles")
    .upsert({ user_id: user.id, avatar_url: avatarUrl })
    .select()
    .single();

  if (error) throwSupabaseError(error, "プロフィール画像の更新に失敗しました");
  return profileFromRow(user.id, data as ProfileRow);
}

export async function uploadAvatar(file: File): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインが必要です");

  const extension = file.name.includes(".") ? file.name.split(".").pop() : undefined;
  const fileName = `avatar-${crypto.randomUUID()}${extension ? `.${extension}` : ""}`;
  const path = `${user.id}/${fileName}`;

  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw new Error(`アップロードに失敗しました（詳細: ${error.message}）`);

  const {
    data: { publicUrl },
  } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return publicUrl;
}
