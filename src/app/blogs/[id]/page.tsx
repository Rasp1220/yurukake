import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfile, getPublishedBlog, getPublishedBlogBlocks } from "@/lib/publicBlogs";
import { sanitizeBlogContent } from "@/lib/sanitizeHtml";
import { parseImageBlockUrls } from "@/lib/blogImageBlock";

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
              // width/heightを固定せずmax-width・max-heightのみ指定することで、
              // 縦横比を保ったまま大きすぎる画像だけ縮小され、余白（レターボックス）
              // が出ない。
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={block.content}
                alt=""
                loading="lazy"
                className="mx-auto block max-h-[720px] max-w-full rounded-2xl"
              />
            )}
            {block.type === "images" &&
              (() => {
                const urls = parseImageBlockUrls(block.content);
                if (urls.length === 0) return null;
                return (
                  // 横スクロール＋スナップのみのシンプルなスライダー。矢印やドット
                  // インジケーターは付けず、指/マウスでの横スクロール操作に任せる
                  // （VideoSlider.tsxと同じ実装パターン）。
                  <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2">
                    {urls.map((url, index) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={index}
                        src={url}
                        alt=""
                        loading="lazy"
                        className="h-[420px] w-auto max-w-[85vw] flex-shrink-0 snap-start rounded-2xl object-contain sm:max-w-[70vw]"
                      />
                    ))}
                  </div>
                );
              })()}
            {block.type === "video" && block.content && (
              <video src={block.content} controls className="w-full rounded-2xl bg-black" />
            )}
          </div>
        ))}
      </div>
    </article>
  );
}
