import Image from "next/image";
import Link from "next/link";
import SnsIcon, { type SnsPlatform } from "@/components/SnsIcon";
import { getProfile, getPublishedBlogs } from "@/lib/publicBlogs";

export default async function BloggerPage({ params }: { params: { userId: string } }) {
  const [profile, blogs] = await Promise.all([
    getProfile(params.userId),
    getPublishedBlogs(params.userId),
  ]);

  const snsLinks = [
    { platform: "twitter" as SnsPlatform, label: "X", url: profile.twitterUrl },
    { platform: "instagram" as SnsPlatform, label: "Instagram", url: profile.instagramUrl },
    { platform: "youtube" as SnsPlatform, label: "YouTube", url: profile.youtubeUrl },
    { platform: "website" as SnsPlatform, label: "Webサイト", url: profile.websiteUrl },
  ].filter(
    (link): link is { platform: SnsPlatform; label: string; url: string } => Boolean(link.url),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-orange-100 bg-white p-6 text-center shadow-sm">
        <div className="relative h-24 w-24 overflow-hidden rounded-full bg-stone-100 ring-4 ring-orange-50">
          {profile.avatarUrl && (
            <Image
              src={profile.avatarUrl}
              alt={profile.displayName ?? "ブロガー"}
              fill
              sizes="96px"
              className="object-cover"
            />
          )}
        </div>

        <div>
          <h1 className="text-xl font-bold text-stone-800">
            {profile.displayName || "ブロガー"}
          </h1>
          <p className="text-sm text-stone-500">公開されているお出かけブログの一覧です。</p>
        </div>

        {profile.tags.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1">
            {profile.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-brand-700"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {snsLinks.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {snsLinks.map((link) => (
              <a
                key={link.platform}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={link.label}
                title={link.label}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-orange-200 text-brand-600 hover:bg-orange-50"
              >
                <SnsIcon platform={link.platform} className="h-4 w-4" />
              </a>
            ))}
          </div>
        )}
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
