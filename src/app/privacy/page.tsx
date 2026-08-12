export const metadata = {
  title: "プライバシーポリシー | ゆるかけ",
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-8 text-stone-700">
      <h1 className="text-2xl font-bold text-brand-600">
        プライバシーポリシー
      </h1>
      <p>
        「ゆるかけ」（以下「本サービス」といいます）は、ユーザーの個人情報を適切に取り扱うことを重要な責務と認識し、以下のとおりプライバシーポリシー（以下「本ポリシー」といいます）を定めます。
      </p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-stone-900">
          1. 取得する情報
        </h2>
        <p>
          本サービスは、アカウント登録時のメールアドレスのほか、行きたいリストやお出かけプラン、ブログ記事などユーザーが本サービス上で作成・投稿する情報を取得します。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-stone-900">
          2. 利用目的
        </h2>
        <p>
          取得した情報は、本サービスの提供・維持・改善、ユーザーからのお問い合わせへの対応のために利用します。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-stone-900">
          3. 第三者提供
        </h2>
        <p>
          運営者は、法令に基づく場合を除き、ユーザーの同意なく個人情報を第三者に提供しません。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-stone-900">
          4. 外部サービスの利用
        </h2>
        <p>
          本サービスは、認証・データ保存のために外部のクラウドサービス（Supabase）や、動画情報の取得のためにYouTube
          Data APIを利用しています。これらのサービスの利用にあたっては、各サービスのプライバシーポリシーも適用されます。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-stone-900">
          5. 本ポリシーの変更
        </h2>
        <p>
          運営者は、必要と判断した場合には、ユーザーに通知することなく本ポリシーを変更できるものとします。
        </p>
      </section>

      <p className="text-sm text-stone-400">制定日：2026年8月12日</p>
    </article>
  );
}
