# yurukake (StrollSync)

お出かけSNSキュレーション＆スマート案内アプリ「StrollSync」のフェーズ1（MVP）実装です。

YouTubeの紹介動画からお出かけスポットを検索し、行きたいリストに保存できます。

## 主な機能（フェーズ1 MVP）

- **ログイン機能**：メールアドレス＋パスワードでアカウント登録・ログイン（Supabase Auth）
- **スポット・キーワード検索**：エリア名やジャンルで検索
- **SNS動画・情報連携**：YouTube Data API v3で関連動画を一覧表示
- **ワンタップ「行きたいリスト」追加**：気になる動画をスポット情報・ジャンル付きで保存（ログインユーザーごとにSupabaseデータベースへ保存）
- **マイページ一覧表示**：保存したスポットをプラン画面（`/mypage/plans`）の「行きたいリスト」で一覧確認

## 追加機能

[`docs/RECOMMENDED_FEATURES.md`](docs/RECOMMENDED_FEATURES.md) の提案のうち、以下を実装済みです。

- **ジャンル・エリアフィルター**：検索結果をジャンルタグで絞り込み、ホーム画面のエリアを拡大表示
- **お出かけプラン作成**：行きたいリストのスポットを「1日目」「2日目」のように日程へ組み込み、並び替え・移動が可能（マイページ→「お出かけプランを作る」）
- **お出かけブログ作成**：タイトル・サムネイルに加えて、テキスト（TinyMCEのWYSIWYGエディター）・画像・動画のパーツを必要な分だけ好きな順番で追加できるブログ（マイページ→「お出かけブログを作る」）。既定は「下書き」で本人にしか見えず、「公開する」で初めて他のユーザーも閲覧可能になる。公開したブログは表示名・プロフィール画像・SNS（X／Instagram／YouTube／Webサイト、アイコン表示）リンク・タグ（一旦「東京」「大阪」）を設定できるブロガープロフィールページ（`/blogger/[userId]`）から一覧でき、ログイン不要で閲覧できる。プロフィールページには新着5件を横スクロールの一覧で表示し、「もっと見る」からそのブロガーの全ブログ一覧（`/blogger/[userId]/blogs`）に遷移できる
- **「さがす」でYouTube動画とお出かけブログを横断検索**：`/search`で検索すると、YouTube動画（従来どおり）に加えて、タイトルが一致する公開済みお出かけブログもカード表示され、開くとそのままブログ本文（`/blogs/[id]`）を読める。既定は種類を問わず公開日時の降順で1つの一覧に混在表示し、「すべて／YouTube／ブログ」タブで種類を絞り込める（ホーム画面の各都道府県「もっと見る」もこの`/search`に遷移する）。ブロガー（人）を表示名・タグで探す専用ページ・ナビ項目は廃止した
- **新着おでかけスポット**：ヘッダー左のハンバーガーメニューから「新着おでかけスポット」「YouTube」「ブログ」に遷移でき、`/new`でプレフェクチャ・キーワードを問わず全件をYouTube動画・お出かけブログ混在で公開日時の新しい順に一覧・ページングできる（`/new?kind=video`でYouTubeのみ、`/new?kind=blog`でブログのみに絞り込み）
- **マイページの3分割**：マイページ単体の画面は廃止し、「プロフィール」（`/mypage/profile`：表示名・画像・タグ・SNSリンクなど公開情報）「ブロガー情報」（`/mypage/account`：ログイン用メールアドレス・パスワードの変更、非公開）「プラン」（`/mypage/plans`：お出かけプラン＋行きたいリスト）の3つに分けた。ナビの「マイページ」はホバー／フォーカスでこの3つを選べ、そのまま押すとプロフィールへ遷移する（`/mypage`はリダイレクト）。ホバーできないタッチ端末でも移動できるよう、3ページ共通のタブ（`MyPageTabs`）も置いている。メール・パスワード変更はSupabase Authの`updateUser`を使用（メールアドレス変更は既定で新旧両方のアドレスへの確認メールが必要）
- **おすすめ（レコメンド）**：保存スポットのジャンルや検索履歴の傾向から、ホーム画面に「あなたへのおすすめ」動画を表示
- **SNSシェア**：行きたいリストやお出かけプランをX・LINEでシェア
- **外部アプリへの導線**：スポットごとにGoogle Map・YouTube公式アプリへのリンクを表示
- **検索結果のキャッシュ**：同じ条件の検索結果をデータベースに保存し、YouTube APIの呼び出し回数を削減（下記「検索キャッシュ」参照）

## 技術スタック

- Next.js 14 (App Router) / React 18 / TypeScript
- Tailwind CSS
- Supabase（認証・PostgreSQLデータベース）
- YouTube Data API v3（動画検索、サーバーサイドAPI Route経由）

## セットアップ

```bash
npm install
cp .env.example .env.local
```

### Supabaseプロジェクトの準備

1. [supabase.com](https://supabase.com) でプロジェクトを作成
2. `supabase/schema.sql` の内容をダッシュボードの SQL Editor で実行し、`spots`／`plans`／`plan_items`／`blogs`／`blog_blocks`／`profiles`／`area_videos`／`area_fetch_progress` テーブルとRow Level Securityポリシーを作成（このスクリプトは冪等なので、機能追加後に再実行しても安全です）。あわせて、ブログのサムネイル・画像・動画パーツのアップロード先として `blog-media` というPublicなStorageバケットとアクセスポリシーも同じスクリプトで作成されます。`blogs`は`status`列（既定'draft'）を持ち、`status='published'`の行だけ本人以外にもRLSで閲覧を許可する。`profiles`は表示名に加えて`tags`（text配列）・`avatar_url`（プロフィール画像、`blog-media`バケットへアップロード）・`twitter_url`／`instagram_url`／`youtube_url`／`website_url`（SNS・WebサイトのURL、すべて任意）を持ち、「さがす」のブログ検索用の`search_blogs`関数もこのスクリプトで作成される
3. Project Settings → API から `Project URL` と `anon public` キーを取得

#### 「Could not find the table 'public.plans' in the schema cache」と出る場合

`supabase/schema.sql` がまだ適用されていない（または適用が途中で失敗した）状態です。SQL Editor でスクリプト全体をもう一度実行してください。

SQL Editor はスクリプトを1つのトランザクションとして実行するため、途中の1文でもエラーになるとそれ以前の文もすべてロールバックされます。以前のバージョンのスクリプトは既存プロジェクトで再実行すると `policy ... already exists` で失敗し、後半の `plans`／`plan_items` テーブルが作られないままになっていました。現在のスクリプトはポリシーを `drop policy if exists` してから作り直すため、何度でも実行できます。

スクリプト末尾の `notify pgrst, 'reload schema';` がPostgRESTのスキーマキャッシュを更新します。手動で更新したい場合は Dashboard の Settings → API から "Reload schema cache"（または数分待つ）でも反映されます。

デフォルトではSupabaseのメール確認（Email Confirmation）が有効です。個人利用でメール確認をスキップしたい場合は、Authentication → Providers → Email の設定で無効にできます。

`.env.local` に以下のAPIキーを設定してください。

| 変数名 | 用途 |
| :--- | :--- |
| `YOUTUBE_API_KEY` | YouTube Data API v3（バッチ `/api/cron/fetch-area-videos` のみで使用） |
| `NEXT_PUBLIC_SUPABASE_URL` | SupabaseプロジェクトのURL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabaseのanon publicキー |
| `SUPABASE_SERVICE_ROLE_KEY` | （任意）動画プールの書き込みをサーバー限定にしたい場合のみ |
| `CRON_SECRET` | バッチ用エンドポイントを呼ぶときの認証トークン（自分で生成した文字列） |

開発サーバーを起動：

```bash
npm run dev
```

`http://localhost:3000` にアクセスします。

## 動画プール（YouTube APIクォータ対策）

サイト側（トップページ・検索ページ）は**YouTube APIを一切呼びません**。代わりに、バッチが47都道府県ぶんの動画をあらかじめ Supabase の `area_videos` テーブルに貯めておき、検索・表示はすべてそこから抽出します。

処理の流れ：

1. `/api/cron/fetch-area-videos`（`Authorization: Bearer $CRON_SECRET` で保護）が、都道府県を「未取得の主要都道府県（東京・大阪・愛知・神奈川・北海道・京都・福岡・沖縄を優先）→ 未取得のその他 → 取得済み（最終更新が古い順）」の順で処理する
2. まだ一度も取得していない都道府県は「本格取得」（総合＋8ジャンルの9パターン×最大3ページ）、既に一度取得済みの都道府県は「新着チェックのみ」（9パターン×1ページ）にして、1回の実行で消費するクォータの上限（8,000ユニット）内に収める。クォータの都合上、1日に処理できるのはおおむね2〜3都道府県分
3. 各動画の再生数は `videos.list`（1ユニット/回・最大50件バッチ）でまとめて取得し、`view_count` として保存する（トップページ・検索結果ページの並び替えに使う）
4. 動画IDを主キーに upsert するので、同じ動画を何度取得しても行が増えることはない
5. `.github/workflows/fetch-area-videos.yml` が毎日1回このエンドポイントを呼ぶ（GitHub Actions の Secrets に `APP_BASE_URL` と `CRON_SECRET` を設定してください。デプロイ先が変わったら `APP_BASE_URL` を更新してください）
6. サイト側の `/api/search` は `search_area_videos` 関数（`supabase/schema.sql`）経由で `area_videos` を読むだけ。検索語が都道府県名と完全一致すればその都道府県に絞り込み、一致しなければタイトル・説明文をあいまい検索する。トップページのエリア枠は `sort=view_count` で再生数順10件、検索結果ページ（もっと見る）は同じく再生数順で1ページ50件のページング表示

**47都道府県すべてが一度取得済みになると、以降の毎日の自動実行はYouTubeを一切呼ばずに即終了します**（レスポンスは `{ "skipped": true }`）。ワークフロー自体は無効化されないので、更新したくなったら GitHub の Actions タブ → "Fetch area videos" → "Run workflow" から手動実行してください（このときだけ `force=true` が付き、実際に取得し直します）。

補足：

- 初回は全都道府県が空の状態から始まるため、`/api/cron/fetch-area-videos` を（`workflow_dispatch` から手動実行、または直接 `curl` で）何度か実行して埋めるまでは検索結果が少ない状態になります
- 既定ではanonキーで書き込むため、`area_videos`／`area_fetch_progress` のポリシーは書き込みを許可しています。厳しくしたい場合は `SUPABASE_SERVICE_ROLE_KEY` を設定した上で、`supabase/schema.sql` のコメントに従って書き込みポリシーを削除してください

## ディレクトリ構成

```
src/
  app/
    page.tsx              # ホーム画面（検索バー、おすすめ）
    new/                    # 新着おでかけスポット（YouTube動画＋ブログを公開日時降順で全件横断、種類で絞り込み可）
    mypage/                # /mypage/profile へのリダイレクトのみ（要ログイン）
      plans/                # お出かけプラン一覧・詳細＋行きたいリスト（保存スポット）
      blogs/                # お出かけブログ一覧・編集（タイトル／サムネイル／パーツ／公開設定）
      profile/               # プロフィール編集（表示名・画像・タグ・SNSリンク、公開情報）
      account/               # ブロガー情報（メールアドレス・パスワード変更、非公開）
    blogger/[userId]/      # 公開ブロガープロフィール（新着5件を横スクロール表示、ログイン不要）
      blogs/                # そのブロガーの公開ブログ全件一覧（プロフィールの「もっと見る」から）
    blogs/[id]/            # 公開ブログ詳細（ログイン不要、status='published'のみ）
    login/                  # ログイン画面
    signup/                 # 新規登録画面
    search/                 # 「さがす」：YouTube動画とお出かけブログの横断検索
    api/search/            # area_videosから抽出して返すだけのAPI（YouTubeは呼ばない）
    api/search/blogs/      # 公開ブログをタイトル検索して返すAPI
    api/cron/fetch-area-videos/  # YouTube APIを呼んでarea_videosを埋めるバッチ
  components/              # UIコンポーネント（ShareButtons, RecommendedSection, RichTextEditor（TinyMCE）, SnsIcon, BlogCard, BlogResultCard, HamburgerMenuほか）
  lib/                      # 型定義・Supabaseヘルパー・APIクライアント・プラン／ブログCRUD・レコメンドロジック
    areaVideos.ts           # 動画プールの読み書き（サーバー専用）
    prefectures.ts          # 47都道府県リスト
    constants.ts             # AREAS／GENRES／PROFILE_TAGSなどの固定候補リスト
    blogs.ts                # ブログ／パーツのCRUD（本人用）とメディアアップロード（Supabase Storage）
    publicBlogs.ts          # 公開ブログ／プロフィール／ブログ検索の読み取り専用フェッチ（サーバー専用、未ログインでも動作）
    blogSearch.ts           # 「さがす」からブログ検索APIを呼び出すクライアント用ヘルパー
    recentSpots.ts          # 「新着おでかけスポット」用、area_videosとblogsをUNIONして取得（サーバー専用）
    profiles.ts             # 表示名・タグ・アバター・SNSリンク（プロフィール）の読み書き（本人用）
    account.ts               # ログイン用メールアドレス・パスワードの変更（Supabase Auth）
  middleware.ts             # Supabaseセッションのリフレッシュ
scripts/
  copy-tinymce.js           # `npm install`後にTinyMCEをpublic/tinymceへセルフホスト用コピー（postinstall）
supabase/
  schema.sql               # spots／plans／plan_items／blogs／blog_blocks／profiles／area_videos／area_fetch_progressテーブル定義とRLSポリシー、blog-media Storageバケット
.github/workflows/
  fetch-area-videos.yml    # バッチを毎日呼び出すGitHub Actions
```

## 今後の拡張（フェーズ2）

- Instagram連携／URLインポート
- 動画タイムスタンプ連動
- ルート自動最適化
- 営業中ステータスなどのリアルタイム情報

詳細は `docs/` のSOW（作業範囲定義書）を参照してください。追加機能の提案は [`docs/RECOMMENDED_FEATURES.md`](docs/RECOMMENDED_FEATURES.md) にまとめています。
