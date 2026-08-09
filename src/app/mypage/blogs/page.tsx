import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BlogsListContent from "./BlogsListContent";

export default async function BlogsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectedFrom=/mypage/blogs");
  }

  return <BlogsListContent />;
}
