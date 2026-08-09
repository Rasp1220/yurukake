import { createClient } from "@/lib/supabase/client";
import type { SavedSpot } from "./types";

interface SpotRow {
  id: string;
  video_id: string;
  video_title: string;
  thumbnail_url: string;
  spot_name: string;
  address: string;
  saved_at: string;
}

function fromRow(row: SpotRow): SavedSpot {
  return {
    id: row.id,
    videoId: row.video_id,
    videoTitle: row.video_title,
    thumbnailUrl: row.thumbnail_url,
    spotName: row.spot_name,
    address: row.address,
    savedAt: row.saved_at,
  };
}

export async function getSavedSpots(): Promise<SavedSpot[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("spots")
    .select("*")
    .order("saved_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as SpotRow[]).map(fromRow);
}

export async function addSavedSpot(
  spot: Omit<SavedSpot, "id" | "savedAt">,
): Promise<SavedSpot> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("spots")
    .insert({
      video_id: spot.videoId,
      video_title: spot.videoTitle,
      thumbnail_url: spot.thumbnailUrl,
      spot_name: spot.spotName,
      address: spot.address,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return fromRow(data as SpotRow);
}

export async function removeSavedSpot(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("spots").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function isVideoSaved(videoId: string): Promise<boolean> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("spots")
    .select("id", { count: "exact", head: true })
    .eq("video_id", videoId);

  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}
