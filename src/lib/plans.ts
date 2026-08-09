import { createClient } from "@/lib/supabase/client";
import { throwSupabaseError } from "@/lib/supabase/errors";
import type { Plan, PlanItem } from "./types";

interface PlanRow {
  id: string;
  title: string;
  created_at: string;
}

interface PlanItemRow {
  id: string;
  plan_id: string;
  spot_id: string;
  day_number: number;
  sort_order: number;
}

function planFromRow(row: PlanRow): Plan {
  return { id: row.id, title: row.title, createdAt: row.created_at };
}

function planItemFromRow(row: PlanItemRow): PlanItem {
  return {
    id: row.id,
    planId: row.plan_id,
    spotId: row.spot_id,
    dayNumber: row.day_number,
    sortOrder: row.sort_order,
  };
}

export async function getPlans(): Promise<Plan[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throwSupabaseError(error, "プランの読み込みに失敗しました");
  return (data as PlanRow[]).map(planFromRow);
}

export async function getPlan(planId: string): Promise<Plan | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("id", planId)
    .maybeSingle();

  if (error) throwSupabaseError(error, "プランの読み込みに失敗しました");
  return data ? planFromRow(data as PlanRow) : null;
}

export async function createPlan(title: string): Promise<Plan> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("plans")
    .insert({ title })
    .select()
    .single();

  if (error) throwSupabaseError(error, "プランの作成に失敗しました");
  return planFromRow(data as PlanRow);
}

export async function deletePlan(planId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("plans").delete().eq("id", planId);
  if (error) throwSupabaseError(error, "プランの削除に失敗しました");
}

export async function getPlanItems(planId: string): Promise<PlanItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("plan_items")
    .select("*")
    .eq("plan_id", planId)
    .order("day_number", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) throwSupabaseError(error, "プランの読み込みに失敗しました");
  return (data as PlanItemRow[]).map(planItemFromRow);
}

export async function addPlanItem(
  planId: string,
  spotId: string,
  dayNumber: number,
): Promise<PlanItem> {
  const supabase = createClient();
  const { count } = await supabase
    .from("plan_items")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", planId)
    .eq("day_number", dayNumber);

  const { data, error } = await supabase
    .from("plan_items")
    .insert({ plan_id: planId, spot_id: spotId, day_number: dayNumber, sort_order: count ?? 0 })
    .select()
    .single();

  if (error) throwSupabaseError(error, "スポットの追加に失敗しました");
  return planItemFromRow(data as PlanItemRow);
}

export async function removePlanItem(itemId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("plan_items").delete().eq("id", itemId);
  if (error) throwSupabaseError(error, "スポットの削除に失敗しました");
}

export async function updatePlanItemDay(itemId: string, dayNumber: number): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("plan_items")
    .update({ day_number: dayNumber })
    .eq("id", itemId);
  if (error) throwSupabaseError(error, "日程の移動に失敗しました");
}

export async function reorderPlanItem(
  itemId: string,
  otherItemId: string,
  itemSortOrder: number,
  otherSortOrder: number,
): Promise<void> {
  const supabase = createClient();
  const { error: e1 } = await supabase
    .from("plan_items")
    .update({ sort_order: otherSortOrder })
    .eq("id", itemId);
  if (e1) throwSupabaseError(e1, "並び替えに失敗しました");

  const { error: e2 } = await supabase
    .from("plan_items")
    .update({ sort_order: itemSortOrder })
    .eq("id", otherItemId);
  if (e2) throwSupabaseError(e2, "並び替えに失敗しました");
}
