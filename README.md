# yurukake (StrollSync)

お出かけSNSキュレーション＆スマート案内アプリ「StrollSync」のフェーズ1（MVP）実装です。

YouTubeの紹介動画からお出かけスポットを検索し、行きたいリストに保存、
Googleマップ上でまとめて確認・簡易ルート案内までを行えます。

## 主な機能（フェーズ1 MVP）

- **ログイン機能**：メールアドレス＋パスワードでアカウント登録・ログイン（Supabase Auth）
- **スポット・キーワード検索**：エリア名やジャンルで検索
- **SNS動画・情報連携**：YouTube Data API v3で関連動画を一覧表示
- **ワンタップ「行きたいリスト」追加**：気になる動画をスポット情報付きで保存（ログインユーザーごとにSupabaseデータベースへ保存）
- **マイマップ一括表示**：保存したスポットをGoogle Maps上にピン留め表示
- **シンプルルート案内**：保存順に移動ルート・所要時間・距離を表示（徒歩／車／公共交通機関）

## 技術スタック

- Next.js 14 (App Router) / React 18 / TypeScript
- Tailwind CSS
- Supabase（認証・PostgreSQLデータベース）
- YouTube Data API v3（動画検索、サーバーサイドAPI Route経由）
- Google Maps Platform（Maps JavaScript API, Geocoding API, Directions Service）

## セットアップ

```bash
npm install
cp .env.example .env.local
```

### Supabaseプロジェクトの準備

1. [supabase.com](https://supabase.com) でプロジェクトを作成
2. `supabase/schema.sql` の内容をダッシュボードの SQL Editor で実行し、`spots` テーブルとRow Level Securityポリシーを作成
3. Project Settings → API から `Project URL` と `anon public` キーを取得

デフォルトではSupabaseのメール確認（Email Confirmation）が有効です。個人利用でメール確認をスキップしたい場合は、Authentication → Providers → Email の設定で無効にできます。

`.env.local` に以下のAPIキーを設定してください。

| 変数名 | 用途 |
| :--- | :--- |
| `YOUTUBE_API_KEY` | YouTube Data API v3（サーバーサイドのみで使用） |
| `GOOGLE_MAPS_SERVER_API_KEY` | Geocoding API（サーバーサイドのみで使用） |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Maps JavaScript API（ブラウザに公開されるため、HTTPリファラー制限を設定してください） |
| `NEXT_PUBLIC_SUPABASE_URL` | SupabaseプロジェクトのURL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabaseのanon publicキー |

開発サーバーを起動：

```bash
npm run dev
```

`http://localhost:3000` にアクセスします。

## ディレクトリ構成

```
src/
  app/
    page.tsx              # ホーム画面（検索バー）
    search/                # 検索結果画面
    mypage/                # マイページ（マップ＆リスト、要ログイン）
    login/                  # ログイン画面
    signup/                 # 新規登録画面
    api/search/            # YouTube Data API プロキシ
    api/geocode/            # Geocoding API プロキシ
  components/              # UIコンポーネント
  lib/                      # 型定義・Supabaseヘルパー・APIクライアント
  middleware.ts             # Supabaseセッションのリフレッシュ
supabase/
  schema.sql               # spotsテーブル定義とRLSポリシー
```

## 今後の拡張（フェーズ2）

- Instagram連携／URLインポート
- 動画タイムスタンプ連動
- ルート自動最適化
- 営業中ステータスなどのリアルタイム情報

詳細は `docs/` のSOW（作業範囲定義書）を参照してください。
