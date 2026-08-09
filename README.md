# yurukake (StrollSync)

お出かけSNSキュレーション＆スマート案内アプリ「StrollSync」のフェーズ1（MVP）実装です。

YouTubeの紹介動画からお出かけスポットを検索し、行きたいリストに保存できます。

## 主な機能（フェーズ1 MVP）

- **ログイン機能**：メールアドレス＋パスワードでアカウント登録・ログイン（Supabase Auth）
- **スポット・キーワード検索**：エリア名やジャンルで検索
- **SNS動画・情報連携**：YouTube Data API v3で関連動画を一覧表示
- **ワンタップ「行きたいリスト」追加**：気になる動画をスポット情報・ジャンル付きで保存（ログインユーザーごとにSupabaseデータベースへ保存）
- **マイページ一覧表示**：保存したスポットを一覧で確認

## 追加機能

[`docs/RECOMMENDED_FEATURES.md`](docs/RECOMMENDED_FEATURES.md) の提案のうち、以下を実装済みです。

- **ジャンル・エリアフィルター**：検索結果をジャンルタグで絞り込み、ホーム画面のエリアを拡大表示
- **お出かけプラン作成**：行きたいリストのスポットを「1日目」「2日目」のように日程へ組み込み、並び替え・移動が可能（マイページ→「お出かけプランを作る」）
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
2. `supabase/schema.sql` の内容をダッシュボードの SQL Editor で実行し、`spots`／`plans`／`plan_items`／`area_videos`／`area_fetch_progress` テーブルとRow Level Securityポリシーを作成（このスクリプトは冪等なので、機能追加後に再実行しても安全です）
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

1. `/api/cron/fetch-area-videos`（`Authorization: Bearer $CRON_SECRET` で保護）が、`area_fetch_progress` を見て最終更新が古い都道府県から順に処理する
2. まだ一度も取得していない都道府県は「本格取得」（総合＋8ジャンルの9パターン×最大3ページ）、既に一度取得済みの都道府県は「新着チェックのみ」（9パターン×1ページ）にして、1回の実行で消費するクォータの上限（8,000ユニット）内に収める
3. 動画IDを主キーに upsert するので、同じ動画を何度取得しても行が増えることはない
4. `.github/workflows/fetch-area-videos.yml` が毎日1回このエンドポイントを呼ぶ（GitHub Actions の Secrets に `APP_BASE_URL` と `CRON_SECRET` を設定してください。デプロイ先が変わったら `APP_BASE_URL` を更新してください）
5. サイト側の `/api/search` は `search_area_videos` 関数（`supabase/schema.sql`）経由で `area_videos` を読むだけ。検索語が都道府県名と完全一致すればその都道府県に絞り込み、一致しなければタイトル・説明文をあいまい検索する

**47都道府県すべてが一度取得済みになると、以降の毎日の自動実行はYouTubeを一切呼ばずに即終了します**（レスポンスは `{ "skipped": true }`）。ワークフロー自体は無効化されないので、更新したくなったら GitHub の Actions タブ → "Fetch area videos" → "Run workflow" から手動実行してください（このときだけ `force=true` が付き、実際に取得し直します）。

補足：

- 初回は全都道府県が空の状態から始まるため、`/api/cron/fetch-area-videos` を（`workflow_dispatch` から手動実行、または直接 `curl` で）何度か実行して埋めるまでは検索結果が少ない状態になります
- 既定ではanonキーで書き込むため、`area_videos`／`area_fetch_progress` のポリシーは書き込みを許可しています。厳しくしたい場合は `SUPABASE_SERVICE_ROLE_KEY` を設定した上で、`supabase/schema.sql` のコメントに従って書き込みポリシーを削除してください

## ディレクトリ構成

```
src/
  app/
    page.tsx              # ホーム画面（検索バー、おすすめ）
    search/                # 検索結果画面（ジャンルフィルター）
    mypage/                # マイページ（保存リスト、要ログイン）
      plans/                # お出かけプラン一覧・詳細（日程スケジュール）
    login/                  # ログイン画面
    signup/                 # 新規登録画面
    api/search/            # area_videosから抽出して返すだけのAPI（YouTubeは呼ばない）
    api/cron/fetch-area-videos/  # YouTube APIを呼んでarea_videosを埋めるバッチ
  components/              # UIコンポーネント（ShareButtons, RecommendedSectionほか）
  lib/                      # 型定義・Supabaseヘルパー・APIクライアント・プランCRUD・レコメンドロジック
    areaVideos.ts           # 動画プールの読み書き（サーバー専用）
    prefectures.ts          # 47都道府県リスト
  middleware.ts             # Supabaseセッションのリフレッシュ
supabase/
  schema.sql               # spots／plans／plan_items／area_videos／area_fetch_progressテーブル定義とRLSポリシー
.github/workflows/
  fetch-area-videos.yml    # バッチを毎日呼び出すGitHub Actions
```

## 今後の拡張（フェーズ2）

- Instagram連携／URLインポート
- 動画タイムスタンプ連動
- ルート自動最適化
- 営業中ステータスなどのリアルタイム情報

詳細は `docs/` のSOW（作業範囲定義書）を参照してください。追加機能の提案は [`docs/RECOMMENDED_FEATURES.md`](docs/RECOMMENDED_FEATURES.md) にまとめています。
