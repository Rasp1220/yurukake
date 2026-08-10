import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileContent from "./ProfileContent";

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectedFrom=/mypage/profile");
  }

  return <ProfileContent />;
}
