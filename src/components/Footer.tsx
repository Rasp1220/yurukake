import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-orange-100 bg-white">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 py-6 text-sm text-stone-600">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <a
            href="https://himatsudo.com"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 font-medium text-brand-700 hover:bg-brand-100"
          >
            ひまつどHP
          </a>
          <a
            href="https://fortune.himatsudo.com"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 font-medium text-brand-700 hover:bg-brand-100"
          >
            ひまつど占い
          </a>
        </div>
        <div className="flex flex-col items-center gap-3 sm:w-full sm:flex-row sm:justify-between">
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <Link href="/terms" className="hover:text-brand-600">
              利用規約
            </Link>
            <Link href="/privacy" className="hover:text-brand-600">
              プライバシーポリシー
            </Link>
          </nav>
          <p className="text-stone-400">&copy; {year} ゆるかけ</p>
        </div>
      </div>
    </footer>
  );
}
