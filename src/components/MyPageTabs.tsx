"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/mypage/profile", label: "プロフィール編集" },
  { href: "/mypage/account", label: "アカウント情報" },
  { href: "/mypage/plans", label: "お出かけプラン" },
];

/**
 * マイページ配下（プロフィール編集／アカウント情報／お出かけプラン）の共通タブ。
 * ナビの「マイページ」ホバーメニューはホバーできないタッチ端末では開けず、
 * タップするとプロフィールへ遷移するだけなので、このタブが無いと残り2つに
 * 到達できなくなる。
 */
export default function MyPageTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
              active
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-orange-200 text-stone-600 hover:border-brand-300"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
