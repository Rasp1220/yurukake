import { createClient } from "@/lib/supabase/server";
import type { Blog, BlogBlock, BlogBlockType, BlogStatus, Profile } from "./types";

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

interface ProfileRow {
  user_id: string;
  display_name: string | null;
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

/** 未ログインでも見られる、そのユーザーの公開プロフィール（表示名）。 */
export async function getProfile(userId: string): Promise<Profile> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error("プロフィールの読み込みに失敗しました");
  return { userId, displayName: (data as ProfileRow | null)?.display_name ?? null };
}

/** そのユーザーが公開設定にしたブログだけを一覧で返す（RLSで下書きは除外される）。 */
export async function getPublishedBlogs(userId: string): Promise<Blog[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("blogs")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error) throw new Error("ブログの読み込みに失敗しました");
  return (data as BlogRow[]).map(blogFromRow);
}

/** 公開設定のブログを1件返す（下書き・存在しないIDはRLSでnull扱い）。 */
export async function getPublishedBlog(blogId: string): Promise<Blog | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("blogs")
    .select("*")
    .eq("id", blogId)
    .eq("status", "published")
    .maybeSingle();

  if (error) throw new Error("ブログの読み込みに失敗しました");
  return data ? blogFromRow(data as BlogRow) : null;
}

export async function getPublishedBlogBlocks(blogId: string): Promise<BlogBlock[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("blog_blocks")
    .select("*")
    .eq("blog_id", blogId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error("パーツの読み込みに失敗しました");
  return (data as BlogBlockRow[]).map(blogBlockFromRow);
}
