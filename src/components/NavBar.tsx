import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import HamburgerMenu from "./HamburgerMenu";
import LogoutButton from "./LogoutButton";

export default async function NavBar() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-20 border-b border-orange-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-1">
          <HamburgerMenu />
          <Link href="/" className="text-lg font-bold text-brand-600">
            ゆるかけ
          </Link>
        </div>
        <nav className="flex items-center gap-4 text-sm font-medium text-stone-600">
          <Link href="/search" className="hover:text-brand-600">
            さがす
          </Link>
          <div className="group relative">
            <Link
              href={user ? "/mypage/profile" : "/login"}
              className="inline-block hover:text-brand-600"
            >
              {user ? "マイページ" : "ログイン"}
            </Link>
            {user && (
              // ホバーに加えてフォーカス（キーボード操作）でも開くようにする。
              // タッチ端末ではホバーが無く、タップするとプロフィールへ遷移する
              // だけなので、各ページ側の MyPageTabs から残りへ移動できる。
              <div className="invisible absolute left-1/2 top-full z-30 -translate-x-1/2 pt-2 opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                <div className="w-36 rounded-xl border border-orange-100 bg-white p-1 shadow-lg">
                  <Link
                    href="/mypage/profile"
                    className="block rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-orange-50 hover:text-brand-600"
                  >
                    プロフィール
                  </Link>
                  <Link
                    href="/mypage/account"
                    className="block rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-orange-50 hover:text-brand-600"
                  >
                    ブロガー情報
                  </Link>
                  <Link
                    href="/mypage/plans"
                    className="block rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-orange-50 hover:text-brand-600"
                  >
                    プラン
                  </Link>
                </div>
              </div>
            )}
          </div>
          {user && (
            <Link href="/mypage/blogs" className="hover:text-brand-600">
              ブログ
            </Link>
          )}
          {user ? (
            <LogoutButton />
          ) : (
            <Link
              href="/signup"
              className="rounded-full bg-brand-600 px-3 py-1.5 text-white hover:bg-brand-700"
            >
              新規登録
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
