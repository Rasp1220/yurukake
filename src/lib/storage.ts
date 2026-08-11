import { createClient } from "@/lib/supabase/client";
import { throwSupabaseError } from "@/lib/supabase/errors";
import type { SavedSpot } from "./types";

interface SpotRow {
  id: string;
  video_id: string;
  video_title: string;
  thumbnail_url: string;
  spot_name: string;
  address: string;
  genre: string | null;
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
    genre: row.genre,
    savedAt: row.saved_at,
  };
}

export async function getSavedSpots(): Promise<SavedSpot[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("spots")
    .select("*")
    .order("saved_at", { ascending: false });

  if (error) throwSupabaseError(error, "行きたいリストの読み込みに失敗しました");
  return (data as SpotRow[]).map(fromRow);
}

// 住所は入力欄を廃止したため、保存時には指定しない（空文字で入れる）。列と
// SavedSpot.address は、それ以前に保存されたスポットの住所を表示・Google Map
// 連携に使い続けるために残してある。
export async function addSavedSpot(
  spot: Omit<SavedSpot, "id" | "savedAt" | "address">,
): Promise<SavedSpot> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("spots")
    .insert({
      video_id: spot.videoId,
      video_title: spot.videoTitle,
      thumbnail_url: spot.thumbnailUrl,
      spot_name: spot.spotName,
      address: "",
      genre: spot.genre,
    })
    .select()
    .single();

  if (error) throwSupabaseError(error, "行きたいリストへの保存に失敗しました");
  return fromRow(data as SpotRow);
}

export async function removeSavedSpot(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("spots").delete().eq("id", id);
  if (error) throwSupabaseError(error, "スポットの削除に失敗しました");
}

export async function isVideoSaved(videoId: string): Promise<boolean> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("spots")
    .select("id", { count: "exact", head: true })
    .eq("video_id", videoId);

  if (error) throwSupabaseError(error, "保存状態の確認に失敗しました");
  return (count ?? 0) > 0;
}
