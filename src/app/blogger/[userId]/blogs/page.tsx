import Link from "next/link";
import BlogCard from "@/components/BlogCard";
import { getProfile, getPublishedBlogs } from "@/lib/publicBlogs";

export default async function BloggerBlogsPage({
  params,
}: {
  params: { userId: string };
}) {
  const [profile, blogs] = await Promise.all([
    getProfile(params.userId),
    getPublishedBlogs(params.userId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/blogger/${params.userId}`}
          className="text-xs text-stone-400 hover:text-brand-600"
        >
          ← {profile.displayName || "ブロガー"}さんのプロフィール
        </Link>
        <h1 className="text-2xl font-bold text-stone-800">
          {profile.displayName || "ブロガー"}さんのブログ一覧
        </h1>
      </div>

      {blogs.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-orange-200 bg-orange-50 py-12 text-center text-stone-500">
          まだ公開されているブログがありません。
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {blogs.map((blog) => (
            <BlogCard key={blog.id} blog={blog} />
          ))}
        </div>
      )}
    </div>
  );
}
