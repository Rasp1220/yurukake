import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PlanDetailContent from "./PlanDetailContent";

export default async function PlanDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirectedFrom=/mypage/plans/${params.id}`);
  }

  return <PlanDetailContent planId={params.id} />;
}
