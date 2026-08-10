import Image from "next/image";
import Link from "next/link";
import type { BlogSearchResult } from "@/lib/types";

// 「さがす」のブログ検索結果用。YouTube動画のVideoCardと同じグリッド内に
// 並ぶため、見た目（サムネイル上・情報下）を揃えている。
export default function BlogResultCard({ blog }: { blog: BlogSearchResult }) {
  return (
    <Link
      href={`/blogs/${blog.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-orange-100 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-stone-100">
        {blog.thumbnailUrl && (
          <Image
            src={blog.thumbnailUrl}
            alt={blog.title}
            fill
            sizes="(max-width: 640px) 100vw, 33vw"
            className="object-cover transition group-hover:scale-105"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold text-stone-800">{blog.title}</h3>
        <p className="text-xs text-stone-500">
          {new Date(blog.createdAt).toLocaleDateString("ja-JP")}
        </p>
      </div>
    </Link>
  );
}
