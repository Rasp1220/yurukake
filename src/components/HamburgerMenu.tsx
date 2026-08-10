"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const ITEMS = [
  { href: "/new", label: "新着おでかけスポット" },
  { href: "/new?kind=video", label: "YouTube" },
  { href: "/new?kind=blog", label: "ブログ" },
];

export default function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="メニュー"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full text-stone-600 hover:bg-orange-50 hover:text-brand-600"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-56 rounded-xl border border-orange-100 bg-white p-1 shadow-lg">
          {ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-orange-50 hover:text-brand-600"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
