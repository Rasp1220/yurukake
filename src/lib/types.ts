export interface VideoResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  publishedAt: string;
  description: string;
  viewCount: number;
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

export interface Blog {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export type BlogBlockType = "text" | "image" | "video";

export interface BlogBlock {
  id: string;
  blogId: string;
  type: BlogBlockType;
  content: string;
  sortOrder: number;
}
