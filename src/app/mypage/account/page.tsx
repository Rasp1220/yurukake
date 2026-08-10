import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AccountContent from "./AccountContent";

export default async function AccountPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectedFrom=/mypage/account");
  }

  return <AccountContent />;
}
