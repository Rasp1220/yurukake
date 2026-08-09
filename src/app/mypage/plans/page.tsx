import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PlansListContent from "./PlansListContent";

export default async function PlansPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectedFrom=/mypage/plans");
  }

  return <PlansListContent />;
}
