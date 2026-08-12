export interface VideoResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  publishedAt: string;
  description: string;
  viewCount: number;
  /**
   * YouTubeの動画カテゴリID（10=音楽、20=ゲームなど）と動画の長さ（秒）。
   * 無関係な動画の点検にだけ使い、画面には出さない。取り込みバッチと
   * バックフィルバッチだけが値を入れるため、それ以外の経路（検索結果の
   * 表示など）では未設定になる。
   */
  categoryId?: number | null;
  durationSeconds?: number | null;
}

export interface SavedSpot {
  id: string;
  videoId: string;
  videoTitle: string;
  thumbnailUrl: string;
  spotName: string;
  address: string;
  genre: string | null;
  savedAt: string;
}

export interface Plan {
  id: string;
  title: string;
  createdAt: string;
}

export interface PlanItem {
  id: string;
  planId: string;
  spotId: string;
  dayNumber: number;
  sortOrder: number;
}

export type BlogStatus = "draft" | "published";

export interface Blog {
  id: string;
  userId: string;
  title: string;
  thumbnailUrl: string | null;
  status: BlogStatus;
  createdAt: string;
  updatedAt: string;
}

/** 「さがす」の横断検索でヒットしたブログ（著者の表示名つき）。 */
export interface BlogSearchResult extends Blog {
  authorDisplayName: string | null;
}

export type BlogBlockType = "text" | "image" | "images" | "video";

export interface BlogBlock {
  id: string;
  blogId: string;
  type: BlogBlockType;
  content: string;
  sortOrder: number;
}

export interface ProfileLink {
  label: string;
  url: string;
}

export interface Profile {
  userId: string;
  displayName: string | null;
  bio: string | null;
  tags: string[];
  avatarUrl: string | null;
  /** SNSのユーザー名（例: "neko"）。URLではない。 */
  twitterUsername: string | null;
  instagramUsername: string | null;
  youtubeUsername: string | null;
  /** 自由に設定できるWebサイト等へのリンク（最大 MAX_PROFILE_LINKS 件）。 */
  links: ProfileLink[];
}
