import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "./LogoutButton";

export default async function NavBar() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-20 border-b border-orange-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold text-brand-600">
          ゆるかけ
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium text-stone-600">
          <Link href="/search" className="hover:text-brand-600">
            さがす
          </Link>
          <Link href={user ? "/mypage" : "/login"} className="hover:text-brand-600">
            {user ? "マイページ" : "ログイン"}
          </Link>
          {user ? (
            <>
              <span className="hidden text-stone-400 sm:inline">{user.email}</span>
              <LogoutButton />
            </>
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
