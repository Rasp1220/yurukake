import { createClient } from "@/lib/supabase/client";
import { throwSupabaseError } from "@/lib/supabase/errors";
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

export async function getBlogs(): Promise<Blog[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("blogs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throwSupabaseError(error, "ブログの読み込みに失敗しました");
  return (data as BlogRow[]).map(blogFromRow);
}

export async function getBlog(blogId: string): Promise<Blog | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("blogs")
    .select("*")
    .eq("id", blogId)
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
  const { count } = await supabase
    .from("blog_blocks")
    .select("id", { count: "exact", head: true })
    .eq("blog_id", blogId);

  const { data, error } = await supabase
    .from("blog_blocks")
    .insert({ blog_id: blogId, type, content, sort_order: count ?? 0 })
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

/** サムネイル・画像パーツ・動画パーツの共通アップロード処理。公開URLを返す。 */
export async function uploadBlogMedia(file: File): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインが必要です");

  const extension = file.name.includes(".") ? file.name.split(".").pop() : undefined;
  const fileName = `${crypto.randomUUID()}${extension ? `.${extension}` : ""}`;
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
