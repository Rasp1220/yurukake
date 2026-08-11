import Link from "next/link";
import { Icon } from "@iconify/react";
import BlogCard from "@/components/BlogCard";
import AvatarImage from "@/components/AvatarImage";
import SnsIcon, { type SnsPlatform } from "@/components/SnsIcon";
import { getProfile, getPublishedBlogs } from "@/lib/publicBlogs";
import { buildSnsUrl } from "@/lib/snsLinks";

const LATEST_BLOG_COUNT = 5;

export default async function BloggerPage({ params }: { params: { userId: string } }) {
  const [profile, blogs] = await Promise.all([
    getProfile(params.userId),
    getPublishedBlogs(params.userId, LATEST_BLOG_COUNT),
  ]);

  const snsLinks = [
    { platform: "twitter" as SnsPlatform, label: "X", url: buildSnsUrl("twitter", profile.twitterUsername) },
    {
      platform: "instagram" as SnsPlatform,
      label: "Instagram",
      url: buildSnsUrl("instagram", profile.instagramUsername),
    },
    {
      platform: "youtube" as SnsPlatform,
      label: "YouTube",
      url: buildSnsUrl("youtube", profile.youtubeUsername),
    },
  ].filter(
    (link): link is { platform: SnsPlatform; label: string; url: string } => Boolean(link.url),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-orange-100 bg-white p-6 text-center shadow-sm">
        <AvatarImage
          src={profile.avatarUrl}
          name={profile.displayName}
          size={96}
          className="ring-4 ring-orange-50"
        />

        <div>
          <h1 className="text-xl font-bold text-stone-800">
            {profile.displayName || "ブロガー"}
          </h1>
          {profile.bio ? (
            <p className="mt-1 max-w-sm whitespace-pre-wrap text-sm text-stone-600">
              {profile.bio}
            </p>
          ) : (
            <p className="text-sm text-stone-500">公開されているお出かけブログの一覧です。</p>
          )}
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

        {profile.links.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {profile.links.map((link, index) => (
              <a
                key={index}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-full border border-orange-200 px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-orange-50"
              >
                {link.label || "リンク"}
                <Icon icon="mdi:open-in-new" className="h-3.5 w-3.5" />
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
        <div className="flex flex-col items-center gap-4">
          <h2 className="self-start text-lg font-bold text-stone-800">新着ブログ</h2>
          <div className="-mx-4 flex w-full snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-2">
            {blogs.map((blog) => (
              <div key={blog.id} className="w-64 flex-shrink-0 snap-start">
                <BlogCard blog={blog} />
              </div>
            ))}
          </div>
          <Link
            href={`/blogger/${params.userId}/blogs`}
            className="rounded-full border border-orange-300 px-5 py-2 text-sm font-semibold text-brand-600 hover:bg-orange-50"
          >
            もっと見る
          </Link>
        </div>
      )}
    </div>
  );
}
