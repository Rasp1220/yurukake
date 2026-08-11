import { createClient } from "@/lib/supabase/client";
import { throwSupabaseError } from "@/lib/supabase/errors";
import { compressContentImage } from "@/lib/imageProcessing";
import type { Blog, BlogBlock, BlogBlockType, BlogStatus } from "./types";

const MEDIA_BUCKET = "blog-media";

interface BlogRow {
  id: string;
  user_id: string;
  title: string;
  thumbnail_url: string | null;
  status: BlogStatus;
  created_at: string;
  updated_at: string;
}

interface BlogBlockRow {
  id: string;
  blog_id: string;
  type: BlogBlockType;
  content: string;
  sort_order: number;
}

function blogFromRow(row: BlogRow): Blog {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    thumbnailUrl: row.thumbnail_url,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function blogBlockFromRow(row: BlogBlockRow): BlogBlock {
  return {
    id: row.id,
    blogId: row.blog_id,
    type: row.type,
    content: row.content,
    sortOrder: row.sort_order,
  };
}

/** マイページのブログ一覧用。他人のブログ（公開済みのもの）は含めず、自分のブログだけを返す。 */
export async function getBlogs(): Promise<Blog[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインが必要です");

  const { data, error } = await supabase
    .from("blogs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throwSupabaseError(error, "ブログの読み込みに失敗しました");
  return (data as BlogRow[]).map(blogFromRow);
}

/** マイページの編集画面用。他人のブログ（公開済みのもの）は編集対象にしないよう、自分のブログだけを取得する。 */
export async function getBlog(blogId: string): Promise<Blog | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインが必要です");

  const { data, error } = await supabase
    .from("blogs")
    .select("*")
    .eq("id", blogId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throwSupabaseError(error, "ブログの読み込みに失敗しました");
  return data ? blogFromRow(data as BlogRow) : null;
}

export async function createBlog(title: string): Promise<Blog> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("blogs")
    .insert({ title })
    .select()
    .single();

  if (error) throwSupabaseError(error, "ブログの作成に失敗しました");
  return blogFromRow(data as BlogRow);
}

export async function updateBlogTitle(blogId: string, title: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("blogs")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", blogId);
  if (error) throwSupabaseError(error, "タイトルの更新に失敗しました");
}

export async function updateBlogThumbnail(
  blogId: string,
  thumbnailUrl: string | null,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("blogs")
    .update({ thumbnail_url: thumbnailUrl, updated_at: new Date().toISOString() })
    .eq("id", blogId);
  if (error) throwSupabaseError(error, "サムネイルの更新に失敗しました");
}

export async function updateBlogStatus(blogId: string, status: BlogStatus): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("blogs")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", blogId);
  if (error) throwSupabaseError(error, "公開設定の更新に失敗しました");
}

export async function deleteBlog(blogId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("blogs").delete().eq("id", blogId);
  if (error) throwSupabaseError(error, "ブログの削除に失敗しました");
}

export async function getBlogBlocks(blogId: string): Promise<BlogBlock[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("blog_blocks")
    .select("*")
    .eq("blog_id", blogId)
    .order("sort_order", { ascending: true });

  if (error) throwSupabaseError(error, "パーツの読み込みに失敗しました");
  return (data as BlogBlockRow[]).map(blogBlockFromRow);
}

export async function addBlogBlock(
  blogId: string,
  type: BlogBlockType,
  content = "",
): Promise<BlogBlock> {
  const supabase = createClient();
  // 件数ではなく「現在の最大sort_order + 1」を使う。件数だと、途中のパーツを
  // 削除したあとに追加したときへ既存パーツと同じsort_orderが割り当てられ
  // （例: [0,2]が残っている状態で件数2を採番）、並び順が不定になるうえ
  // ↑↓の入れ替え（同じ値同士の交換）が効かなくなる。
  const { data: lastBlock } = await supabase
    .from("blog_blocks")
    .select("sort_order")
    .eq("blog_id", blogId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSortOrder =
    lastBlock === null ? 0 : ((lastBlock as { sort_order: number }).sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from("blog_blocks")
    .insert({ blog_id: blogId, type, content, sort_order: nextSortOrder })
    .select()
    .single();

  if (error) throwSupabaseError(error, "パーツの追加に失敗しました");
  return blogBlockFromRow(data as BlogBlockRow);
}

export async function updateBlogBlockContent(
  blockId: string,
  content: string,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("blog_blocks")
    .update({ content })
    .eq("id", blockId);
  if (error) throwSupabaseError(error, "パーツの更新に失敗しました");
}

export async function removeBlogBlock(blockId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("blog_blocks").delete().eq("id", blockId);
  if (error) throwSupabaseError(error, "パーツの削除に失敗しました");
}

export async function reorderBlogBlock(
  blockId: string,
  otherBlockId: string,
  blockSortOrder: number,
  otherSortOrder: number,
): Promise<void> {
  const supabase = createClient();
  const { error: e1 } = await supabase
    .from("blog_blocks")
    .update({ sort_order: otherSortOrder })
    .eq("id", blockId);
  if (e1) throwSupabaseError(e1, "並び替えに失敗しました");

  const { error: e2 } = await supabase
    .from("blog_blocks")
    .update({ sort_order: blockSortOrder })
    .eq("id", otherBlockId);
  if (e2) throwSupabaseError(e2, "並び替えに失敗しました");
}

// Vercelの無料枠は関数の実行時間・帯域に制約があり、巨大な動画ファイルは
// アップロード・配信の両方で厳しい。サーバー側で変換はせず、あくまで
// アップロードできるサイズに上限を設けるだけに留める。
export const MAX_VIDEO_FILE_SIZE = 100 * 1024 * 1024;

/** サムネイル・画像パーツ・動画パーツの共通アップロード処理。公開URLを返す。 */
export async function uploadBlogMedia(file: File): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインが必要です");

  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");

  if (isVideo && file.size > MAX_VIDEO_FILE_SIZE) {
    throw new Error(
      `動画ファイルが大きすぎます（${Math.floor(MAX_VIDEO_FILE_SIZE / 1024 / 1024)}MB以下にしてください）。長い動画はYouTubeにアップロードして、そのリンクをブログに貼る方法もおすすめです。`,
    );
  }

  // 画像は縦横最大4096pxのJPEGに圧縮してからアップロードする（EXIFも
  // 再エンコードで自動的に失われる）。動画はサーバー側で変換すると
  // 計算リソースを大きく消費するため、そのままアップロードする。
  const uploadFile = isImage ? await compressContentImage(file) : file;

  const extension = isImage
    ? "jpg"
    : file.name.includes(".")
      ? file.name.split(".").pop()
      : undefined;
  const fileName = `${crypto.randomUUID()}${extension ? `.${extension}` : ""}`;
  const path = `${user.id}/${fileName}`;

  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, uploadFile, {
    cacheControl: "3600",
    upsert: false,
    contentType: isImage ? "image/jpeg" : file.type || undefined,
  });
  if (error) throw new Error(`アップロードに失敗しました（詳細: ${error.message}）`);

  const {
    data: { publicUrl },
  } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return publicUrl;
}
