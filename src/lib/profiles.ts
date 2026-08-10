import { createClient } from "@/lib/supabase/client";
import { throwSupabaseError } from "@/lib/supabase/errors";
import { compressAvatarImage } from "@/lib/imageProcessing";
import { MAX_PROFILE_LINKS } from "@/lib/constants";
import { extractSnsUsername } from "@/lib/snsLinks";
import type { Profile, ProfileLink } from "./types";

const MEDIA_BUCKET = "blog-media";

interface ProfileRow {
  user_id: string;
  display_name: string | null;
  bio: string | null;
  tags: string[];
  avatar_url: string | null;
  twitter_url: string | null;
  instagram_url: string | null;
  youtube_url: string | null;
  website_url: string | null;
  links: ProfileLink[] | null;
}

function profileFromRow(userId: string, row: ProfileRow | null): Profile {
  // links列が空でも、旧・単一WebサイトURL欄（website_url）に値が残っている
  // 場合は1件目としてそのまま引き継ぐ（過去のデータが消えて見えないように）。
  const links =
    row?.links && row.links.length > 0
      ? row.links
      : row?.website_url
        ? [{ label: "Webサイト", url: row.website_url }]
        : [];

  return {
    userId,
    displayName: row?.display_name ?? null,
    bio: row?.bio ?? null,
    tags: row?.tags ?? [],
    avatarUrl: row?.avatar_url ?? null,
    twitterUsername: extractSnsUsername("twitter", row?.twitter_url ?? null) || null,
    instagramUsername: extractSnsUsername("instagram", row?.instagram_url ?? null) || null,
    youtubeUsername: extractSnsUsername("youtube", row?.youtube_url ?? null) || null,
    links: links.slice(0, MAX_PROFILE_LINKS),
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
  bio: string;
  tags: string[];
  twitterUsername: string;
  instagramUsername: string;
  youtubeUsername: string;
  links: ProfileLink[];
}): Promise<Profile> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインが必要です");

  const links = input.links
    .filter((link) => link.url.trim())
    .slice(0, MAX_PROFILE_LINKS);

  const { data, error } = await supabase
    .from("profiles")
    .upsert({
      user_id: user.id,
      display_name: input.displayName || null,
      bio: input.bio || null,
      tags: input.tags,
      twitter_url: input.twitterUsername || null,
      instagram_url: input.instagramUsername || null,
      youtube_url: input.youtubeUsername || null,
      // 旧・単一Webサイト欄は新規保存では使わないが、列自体は残っているので
      // 空にしておく（linksが新しい正となる）。
      website_url: null,
      links,
    })
    .select()
    .single();

  if (error) throwSupabaseError(error, "プロフィールの更新に失敗しました");
  return profileFromRow(user.id, data as ProfileRow);
}

/** アップロードした画像の公開URLをプロフィール画像として保存する（他の項目は変更しない）。nullでリセット。 */
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

/**
 * 256x256のJPEGに圧縮（EXIFも自動的に除去）してからアップロードし、公開URLを返す。
 */
export async function uploadAvatar(file: File): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインが必要です");

  const compressed = await compressAvatarImage(file);
  const fileName = `avatar-${crypto.randomUUID()}.jpg`;
  const path = `${user.id}/${fileName}`;

  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, compressed, {
    cacheControl: "3600",
    upsert: false,
    contentType: "image/jpeg",
  });
  if (error) throw new Error(`アップロードに失敗しました（詳細: ${error.message}）`);

  const {
    data: { publicUrl },
  } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return publicUrl;
}
