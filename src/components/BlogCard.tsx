import Image from "next/image";
import Link from "next/link";
import type { Blog } from "@/lib/types";

export default function BlogCard({ blog }: { blog: Blog }) {
  return (
    <Link
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
            className="object-contain"
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
  );
}
