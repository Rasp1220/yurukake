import Link from "next/link";

export default function NavBar() {
  return (
    <header className="sticky top-0 z-20 border-b border-orange-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold text-brand-600">
          ゆるかけ
        </Link>
        <nav className="flex gap-4 text-sm font-medium text-stone-600">
          <Link href="/search" className="hover:text-brand-600">
            さがす
          </Link>
          <Link href="/mypage" className="hover:text-brand-600">
            マイページ
          </Link>
        </nav>
      </div>
    </header>
  );
}
