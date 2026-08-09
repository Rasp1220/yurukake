export interface VideoResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  publishedAt: string;
  description: string;
}

export interface SavedSpot {
  id: string;
  videoId: string;
  videoTitle: string;
  thumbnailUrl: string;
  spotName: string;
  address: string;
  lat: number | null;
  lng: number | null;
  savedAt: string;
}
