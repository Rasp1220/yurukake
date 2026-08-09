import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MyPageContent from "./MyPageContent";

export default async function MyPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectedFrom=/mypage");
  }

  return <MyPageContent />;
}
