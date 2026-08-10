import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfile, getPublishedBlog, getPublishedBlogBlocks } from "@/lib/publicBlogs";
import { sanitizeBlogContent } from "@/lib/sanitizeHtml";

export default async function PublicBlogPage({ params }: { params: { id: string } }) {
  const blog = await getPublishedBlog(params.id);
  if (!blog) notFound();

  const [blocks, profile] = await Promise.all([
    getPublishedBlogBlocks(blog.id),
    getProfile(blog.userId),
  ]);

  return (
    <article className="flex flex-col gap-6">
      <div>
        <Link
          href={`/blogger/${blog.userId}`}
          className="text-xs text-stone-400 hover:text-brand-600"
        >
          ← {profile.displayName || "ブロガー"}さんのブログ一覧
        </Link>
        <h1 className="text-2xl font-bold text-stone-800">{blog.title}</h1>
      </div>

      {blog.thumbnailUrl && (
        <div className="relative h-64 w-full overflow-hidden rounded-2xl bg-stone-100">
          <Image
            src={blog.thumbnailUrl}
            alt={blog.title}
            fill
            sizes="720px"
            className="object-cover"
          />
        </div>
      )}

      <div className="flex flex-col gap-6">
        {blocks.map((block) => (
          <div key={block.id}>
            {block.type === "text" && block.content && (
              <div
                className="text-sm leading-relaxed text-stone-700 [&_a]:text-brand-600 [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
                dangerouslySetInnerHTML={{ __html: sanitizeBlogContent(block.content) }}
              />
            )}
            {block.type === "image" && block.content && (
              <div className="relative h-72 w-full overflow-hidden rounded-2xl bg-stone-100">
                <Image src={block.content} alt="" fill sizes="720px" className="object-cover" />
              </div>
            )}
            {block.type === "video" && block.content && (
              <video src={block.content} controls className="w-full rounded-2xl bg-black" />
            )}
          </div>
        ))}
      </div>
    </article>
  );
}
