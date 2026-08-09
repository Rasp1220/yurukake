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
2. `supabase/schema.sql` の内容をダッシュボードの SQL Editor で実行し、`spots`／`plans`／`plan_items`／`search_cache` テーブルとRow Level Securityポリシーを作成（このスクリプトは冪等なので、機能追加後に再実行しても安全です）
3. Project Settings → API から `Project URL` と `anon public` キーを取得

#### 「Could not find the table 'public.plans' in the schema cache」と出る場合

`supabase/schema.sql` がまだ適用されていない（または適用が途中で失敗した）状態です。SQL Editor でスクリプト全体をもう一度実行してください。

SQL Editor はスクリプトを1つのトランザクションとして実行するため、途中の1文でもエラーになるとそれ以前の文もすべてロールバックされます。以前のバージョンのスクリプトは既存プロジェクトで再実行すると `policy ... already exists` で失敗し、後半の `plans`／`plan_items` テーブルが作られないままになっていました。現在のスクリプトはポリシーを `drop policy if exists` してから作り直すため、何度でも実行できます。

スクリプト末尾の `notify pgrst, 'reload schema';` がPostgRESTのスキーマキャッシュを更新します。手動で更新したい場合は Dashboard の Settings → API から "Reload schema cache"（または数分待つ）でも反映されます。

デフォルトではSupabaseのメール確認（Email Confirmation）が有効です。個人利用でメール確認をスキップしたい場合は、Authentication → Providers → Email の設定で無効にできます。

`.env.local` に以下のAPIキーを設定してください。

| 変数名 | 用途 |
| :--- | :--- |
| `YOUTUBE_API_KEY` | YouTube Data API v3（サーバーサイドのみで使用） |
| `NEXT_PUBLIC_SUPABASE_URL` | SupabaseプロジェクトのURL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabaseのanon publicキー |
| `SEARCH_CACHE_TTL_SECONDS` | （任意）検索キャッシュの有効期間。未設定なら86400（24時間） |
| `SUPABASE_SERVICE_ROLE_KEY` | （任意）検索キャッシュの書き込みをサーバー限定にしたい場合のみ |

開発サーバーを起動：

```bash
npm run dev
```

`http://localhost:3000` にアクセスします。

## 検索キャッシュ（YouTube APIクォータ対策）

YouTube Data API v3 の `search.list` は1回で100ユニット消費し、デフォルトのクォータは1日10,000ユニット＝**1日100回**しかありません。検索画面を開くたび・ジャンルタグを切り替えるたびに呼んでいるとすぐ上限に達するため、検索結果を Supabase の `search_cache` テーブルにキャッシュしています。

処理の流れ（`src/app/api/search/route.ts`）：

1. 「検索キーワード＋ジャンル」で `search_cache` を引き、TTL（既定24時間）以内ならDBの結果をそのまま返す（YouTube呼び出しゼロ）
2. キャッシュが無い／古い場合だけ YouTube を呼び、結果をキャッシュに書き戻す
3. YouTube呼び出しが失敗した場合（クォータ超過など）、期限切れのキャッシュがあればそれを返す（レスポンスに `stale: true` が付きます）

補足：

- キャッシュはユーザーごとではなく**全ユーザー共有**です。検索結果は誰が見ても同じ内容のため、`search_cache` に `user_id` はありません。
- 30件で取得したキャッシュは、12件要求（ホーム画面のおすすめ）にも先頭12件を切り出して再利用します。逆に12件のキャッシュは30件要求には使いません。
- キャッシュの読み書きに失敗しても検索は止まりません（YouTubeへフォールバックし、サーバーログに警告を出します）。`search_cache` テーブルを作っていない状態でもアプリはこれまで通り動きます。
- 保存された行は同じ検索条件なら上書き（upsert）されるので、行数は「実際に検索された条件の種類」で頭打ちになります。古い行を消したい場合は `delete from public.search_cache where fetched_at < now() - interval '30 days';` を実行してください。
- 既定ではanonキーで書き込むため、`search_cache` のポリシーは書き込みを許可しています。厳しくしたい場合は `SUPABASE_SERVICE_ROLE_KEY` を設定した上で、`supabase/schema.sql` のコメントに従って書き込みポリシーを削除してください。

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
    api/search/            # YouTube Data API プロキシ（DBキャッシュ経由）
  components/              # UIコンポーネント（ShareButtons, RecommendedSectionほか）
  lib/                      # 型定義・Supabaseヘルパー・APIクライアント・プランCRUD・レコメンドロジック
    searchCache.ts          # YouTube検索結果のDBキャッシュ（サーバー専用）
  middleware.ts             # Supabaseセッションのリフレッシュ
supabase/
  schema.sql               # spots／plans／plan_items／search_cacheテーブル定義とRLSポリシー
```

## 今後の拡張（フェーズ2）

- Instagram連携／URLインポート
- 動画タイムスタンプ連動
- ルート自動最適化
- 営業中ステータスなどのリアルタイム情報

詳細は `docs/` のSOW（作業範囲定義書）を参照してください。追加機能の提案は [`docs/RECOMMENDED_FEATURES.md`](docs/RECOMMENDED_FEATURES.md) にまとめています。
