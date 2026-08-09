"use client";

export default function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav className="flex items-center justify-center gap-4 py-6" aria-label="ページ送り">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="rounded-full border border-orange-200 px-4 py-2 text-sm font-medium text-stone-600 transition hover:border-brand-300 disabled:cursor-not-allowed disabled:opacity-40"
      >
        前へ
      </button>
      <span className="text-sm text-stone-500">
        {page} / {totalPages} ページ
      </span>
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="rounded-full border border-orange-200 px-4 py-2 text-sm font-medium text-stone-600 transition hover:border-brand-300 disabled:cursor-not-allowed disabled:opacity-40"
      >
        次へ
      </button>
    </nav>
  );
}
