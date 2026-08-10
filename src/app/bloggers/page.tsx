import { searchBloggers } from "@/lib/publicBlogs";
import BloggerSearchResults from "./BloggerSearchResults";

export default async function BloggersPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const query = searchParams.q?.trim() ?? "";
  const bloggers = await searchBloggers(query);

  return <BloggerSearchResults query={query} bloggers={bloggers} />;
}
