import Link from "next/link";
import NewSpotsResults from "./NewSpotsResults";
import { countRecentSpots, getRecentSpots, type RecentSpotKind } from "@/lib/recentSpots";

// area_videos／blogsの鮮度をそのまま出したいので、静的最適化させない。
export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

const KIND_TABS: { label: string; kind: RecentSpotKind | null }[] = [
  { label: "すべて", kind: null },
  { label: "YouTube", kind: "video" },
  { label: "ブログ", kind: "blog" },
];

const TITLES: Record<"all" | RecentSpotKind, string> = {
  all: "新着おでかけスポット",
  video: "新着YouTube動画",
  blog: "新着お出かけブログ",
};

function parseKind(value: string | undefined): RecentSpotKind | null {
  return value === "video" || value === "blog" ? value : null;
}

function pageHref(kind: RecentSpotKind | null, page: number): string {
  const params = new URLSearchParams();
  if (kind) params.set("kind", kind);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/new?${query}` : "/new";
}

export default async function NewSpotsPage({
  searchParams,
}: {
  searchParams: { kind?: string; page?: string };
}) {
  const kind = parseKind(searchParams.kind);
  const page = Math.max(1, Number(searchParams.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const [items, total] = await Promise.all([
    getRecentSpots(kind, PAGE_SIZE, offset),
    countRecentSpots(kind),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">{TITLES[kind ?? "all"]}</h1>
        <p className="text-sm text-stone-500">
          YouTube動画とお出かけブログを、種類を問わず公開日時の新しい順に表示します。
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {KIND_TABS.map((tab) => {
          const active = tab.kind === kind;
          return (
            <Link
              key={tab.label}
              href={pageHref(tab.kind, 1)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-orange-200 text-stone-600 hover:border-brand-300"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <NewSpotsResults items={items} />

      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-4 py-6" aria-label="ページ送り">
          <Link
            href={pageHref(kind, Math.max(1, page - 1))}
            aria-disabled={page <= 1}
            className={`rounded-full border border-orange-200 px-4 py-2 text-sm font-medium text-stone-600 transition hover:border-brand-300 ${
              page <= 1 ? "pointer-events-none opacity-40" : ""
            }`}
          >
            前へ
          </Link>
          <span className="text-sm text-stone-500">
            {page} / {totalPages} ページ
          </span>
          <Link
            href={pageHref(kind, Math.min(totalPages, page + 1))}
            aria-disabled={page >= totalPages}
            className={`rounded-full border border-orange-200 px-4 py-2 text-sm font-medium text-stone-600 transition hover:border-brand-300 ${
              page >= totalPages ? "pointer-events-none opacity-40" : ""
            }`}
          >
            次へ
          </Link>
        </nav>
      )}
    </div>
  );
}
