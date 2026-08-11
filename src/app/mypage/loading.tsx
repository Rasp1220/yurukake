// マイページ配下（プロフィール編集・ブログ・アカウント情報・お出かけプラン）共通の
// ローディング表示。各ページはサーバーコンポーネントでログイン確認（Supabaseへの
// 通信）を待ってから描画するため、これが無いとリンクを押した瞬間、通信が終わる
// までブラウザに何の変化も出ず「固まった」ように見えてしまう。ここに置くだけで
// Next.jsが自動的にこの階層以下のページ遷移をSuspenseで包み、即座にこの表示に
// 差し替えてくれる。
export default function MyPageLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-200 border-t-brand-600" />
    </div>
  );
}
