import Image from "next/image";
import Link from "next/link";
import { getProfile, getPublishedBlogs } from "@/lib/publicBlogs";

export default async function BloggerPage({ params }: { params: { userId: string } }) {
  const [profile, blogs] = await Promise.all([
    getProfile(params.userId),
    getPublishedBlogs(params.userId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">
          {profile.displayName || "ブロガー"}さんのブログ
        </h1>
        <p className="text-sm text-stone-500">公開されているお出かけブログの一覧です。</p>
      </div>

      {blogs.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-orange-200 bg-orange-50 py-12 text-center text-stone-500">
          まだ公開されているブログがありません。
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {blogs.map((blog) => (
            <Link
              key={blog.id}
              href={`/blogs/${blog.id}`}
              className="flex gap-3 rounded-2xl border border-orange-100 bg-white p-3 shadow-sm hover:border-brand-300"
            >
              <div className="relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-stone-100">
                {blog.thumbnailUrl && (
                  <Image
                    src={blog.thumbnailUrl}
                    alt={blog.title}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-stone-800">{blog.title}</p>
                <p className="text-xs text-stone-400">
                  {new Date(blog.createdAt).toLocaleDateString("ja-JP")}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
