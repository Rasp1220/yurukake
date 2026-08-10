import { createClient } from "@/lib/supabase/server";
import { MAX_PROFILE_LINKS } from "@/lib/constants";
import { extractSnsUsername } from "@/lib/snsLinks";
import type {
  Blog,
  BlogBlock,
  BlogBlockType,
  BlogSearchResult,
  BlogStatus,
  Profile,
  ProfileLink,
} from "./types";

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
  bio: string | null;
  tags: string[];
  avatar_url: string | null;
  twitter_url: string | null;
  instagram_url: string | null;
  youtube_url: string | null;
  website_url: string | null;
  links: ProfileLink[] | null;
}

interface BlogSearchRow {
  id: string;
  user_id: string;
  title: string;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
  author_display_name: string | null;
}

function profileFromRow(userId: string, row: ProfileRow | null): Profile {
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

function blogSearchResultFromRow(row: BlogSearchRow): BlogSearchResult {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    thumbnailUrl: row.thumbnail_url,
    status: "published",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    authorDisplayName: row.author_display_name,
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
  return profileFromRow(userId, data as ProfileRow | null);
}

/** 「さがす」の横断検索用。タイトルが検索語にマッチする公開済みブログを返す。 */
export async function searchBlogs(query: string): Promise<BlogSearchResult[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("search_blogs", {
    search_query: query.trim(),
  });

  if (error) throw new Error("ブログの検索に失敗しました");
  return (data as BlogSearchRow[]).map(blogSearchResultFromRow);
}

/** そのユーザーが公開設定にしたブログだけを一覧で返す（RLSで下書きは除外される）。 */
export async function getPublishedBlogs(userId: string, limit?: number): Promise<Blog[]> {
  const supabase = createClient();
  let query = supabase
    .from("blogs")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "published")
    .order("created_at", { ascending: false });
  if (limit !== undefined) query = query.limit(limit);

  const { data, error } = await query;

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
