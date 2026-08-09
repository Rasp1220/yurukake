"use client";

export default function ShareButtons({ text, url }: { text: string; url: string }) {
  const encodedText = encodeURIComponent(text);
  const encodedUrl = encodeURIComponent(url);

  const xUrl = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
  const lineUrl = `https://social-plugins.line.me/lineit/share?url=${encodedUrl}&text=${encodedText}`;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-stone-500">シェア:</span>
      <a
        href={xUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
      >
        X
      </a>
      <a
        href={lineUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full border border-green-200 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-50"
      >
        LINE
      </a>
    </div>
  );
}
