import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BlogEditContent from "./BlogEditContent";

export default async function BlogEditPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirectedFrom=/mypage/blogs/${params.id}`);
  }

  return <BlogEditContent blogId={params.id} />;
}
