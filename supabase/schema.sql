-- Run this in the Supabase project's SQL editor (Dashboard -> SQL Editor).
-- このスクリプトは何度実行しても安全です（冪等）。テーブル・カラム・ポリシーを
-- 追加したあとに再実行すれば、不足しているものだけが作られます。
--
-- 重要: SQL Editor はスクリプト全体を1つのトランザクションで実行するため、
-- 途中の1文でもエラーになると「それ以前の文も含めて」すべてロールバックされます。
-- `create policy` には `if not exists` が無く、既存プロジェクトで再実行すると
-- 「policy already exists」で失敗するため、すべてのポリシーは
-- `drop policy if exists` -> `create policy` の順で書いています。

-- Creates the `spots` table used to store each logged-in user's saved
-- "行きたいリスト" spots, scoped to that user via Row Level Security.

create table if not exists public.spots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  video_id text not null,
  video_title text not null,
  thumbnail_url text not null,
  spot_name text not null,
  address text not null,
  genre text,
  saved_at timestamptz not null default now()
);

-- Genre tag for the filter/recommendation features. Nullable because
-- spots saved before this column existed have no genre.
alter table public.spots add column if not exists genre text;

-- This app no longer integrates with Google Maps (no geocoding, no map
-- display), so spots have no coordinates. Drop the now-unused columns if
-- they still exist from an earlier version of this schema (they may have
-- a not-null constraint, which would otherwise reject every new insert
-- since the app no longer sends lat/lng).
alter table public.spots drop column if exists lat;
alter table public.spots drop column if exists lng;

create index if not exists spots_user_id_idx on public.spots (user_id);

alter table public.spots enable row level security;

drop policy if exists "Users can view their own spots" on public.spots;
create policy "Users can view their own spots"
  on public.spots for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own spots" on public.spots;
create policy "Users can insert their own spots"
  on public.spots for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own spots" on public.spots;
create policy "Users can delete their own spots"
  on public.spots for delete
  using (auth.uid() = user_id);

-- お出かけプラン（しおり）機能: プラン本体と、プランに紐づく日程ごとのスポット。

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now()
);

create index if not exists plans_user_id_idx on public.plans (user_id);

alter table public.plans enable row level security;

drop policy if exists "Users can view their own plans" on public.plans;
create policy "Users can view their own plans"
  on public.plans for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own plans" on public.plans;
create policy "Users can insert their own plans"
  on public.plans for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own plans" on public.plans;
create policy "Users can update their own plans"
  on public.plans for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own plans" on public.plans;
create policy "Users can delete their own plans"
  on public.plans for delete
  using (auth.uid() = user_id);

create table if not exists public.plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  spot_id uuid not null references public.spots (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day_number integer not null default 1,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists plan_items_plan_id_idx on public.plan_items (plan_id);

alter table public.plan_items enable row level security;

drop policy if exists "Users can view their own plan items" on public.plan_items;
create policy "Users can view their own plan items"
  on public.plan_items for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own plan items" on public.plan_items;
create policy "Users can insert their own plan items"
  on public.plan_items for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own plan items" on public.plan_items;
create policy "Users can update their own plan items"
  on public.plan_items for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own plan items" on public.plan_items;
create policy "Users can delete their own plan items"
  on public.plan_items for delete
  using (auth.uid() = user_id);

-- YouTube検索結果のキャッシュ。YouTube Data API v3 は search.list 1回で
-- 100ユニット消費し、デフォルトのクォータは1日10,000ユニット（＝1日100回）しか
-- ないため、同じ検索条件の結果をここに貯めてAPI呼び出しを減らす。
-- ユーザーごとのデータではなく全員で共有するサーバー側キャッシュなので、
-- user_id は持たない。

-- 旧方式（リクエスト時にYouTubeを叩いてTTLキャッシュする search_cache
-- テーブル）は下記の area_videos 方式に置き換えられました。既存プロジェクトで
-- search_cache テーブルがまだ残っていても動作に支障はないため、このスクリプトは
-- 削除（drop table）はしません。不要になったら手動で
-- `drop table if exists public.search_cache;` を実行してください。

-- 都道府県ごとの動画プール（サイト側はここだけを読み、YouTube APIは
-- バッチ（`/api/cron/fetch-area-videos`、GitHub Actionsなどから定期実行）
-- だけが呼ぶ）。トップページのエリア枠・おすすめ枠・自由検索のすべてが
-- このテーブルから抽出して表示する。
--
-- video_id を主キーにして upsert することで、バッチを繰り返し実行しても
-- 同じ動画が重複して増えることはなく、行数は「実際に見つかったユニークな
-- 動画の数」で頭打ちになる。

create extension if not exists pg_trgm;

create table if not exists public.area_videos (
  video_id text primary key,
  prefecture text not null,
  title text not null,
  channel_title text not null,
  thumbnail_url text not null,
  description text not null default '',
  published_at timestamptz,
  fetched_at timestamptz not null default now()
);

create index if not exists area_videos_prefecture_idx on public.area_videos (prefecture);
create index if not exists area_videos_title_trgm_idx on public.area_videos using gin (title gin_trgm_ops);
create index if not exists area_videos_description_trgm_idx on public.area_videos using gin (description gin_trgm_ops);

alter table public.area_videos enable row level security;

drop policy if exists "Anyone can read area videos" on public.area_videos;
create policy "Anyone can read area videos"
  on public.area_videos for select
  using (true);

-- 書き込みはバッチ（サーバー側）からのみ行うが、既定では anon キーで接続
-- するためポリシーで許可しておく。厳しくしたい場合は
-- `SUPABASE_SERVICE_ROLE_KEY` を設定した上で、下のポリシーを削除する。
drop policy if exists "Anyone can fill area videos" on public.area_videos;
create policy "Anyone can fill area videos"
  on public.area_videos for insert
  with check (true);

drop policy if exists "Anyone can refresh area videos" on public.area_videos;
create policy "Anyone can refresh area videos"
  on public.area_videos for update
  using (true)
  with check (true);

-- バッチが「どの都道府県を次に処理すべきか」を判断するための進捗表。
-- 最終更新が一番古い都道府県から優先的に処理することで、日々のクォータ内で
-- 47都道府県を自然にローテーションできる。

create table if not exists public.area_fetch_progress (
  prefecture text primary key,
  last_fetched_at timestamptz,
  video_count integer not null default 0
);

alter table public.area_fetch_progress enable row level security;

drop policy if exists "Anyone can read fetch progress" on public.area_fetch_progress;
create policy "Anyone can read fetch progress"
  on public.area_fetch_progress for select
  using (true);

drop policy if exists "Anyone can write fetch progress" on public.area_fetch_progress;
create policy "Anyone can write fetch progress"
  on public.area_fetch_progress for all
  using (true)
  with check (true);

-- サイト側の検索（トップページのエリア枠・おすすめ枠・自由検索）はすべて
-- この関数経由で area_videos を読む。都道府県名と完全一致すればその
-- 都道府県に絞り込み、一致しなければタイトル・説明文をあいまい検索する。
-- ジャンルが指定されていれば、それも同様にタイトル・説明文で絞り込む
-- （AND条件）。
create or replace function public.search_area_videos(
  search_query text,
  search_genre text default null,
  result_limit integer default 12
)
returns setof public.area_videos
language sql
stable
as $$
  select *
  from public.area_videos
  where
    (
      prefecture = search_query
      or title ilike '%' || search_query || '%'
      or description ilike '%' || search_query || '%'
    )
    and (
      search_genre is null
      or title ilike '%' || search_genre || '%'
      or description ilike '%' || search_genre || '%'
    )
  order by random()
  limit result_limit;
$$;

-- PostgREST（SupabaseのデータAPI）はテーブル定義をキャッシュしており、更新が
-- 反映されるまで "Could not find the table 'public.xxx' in the schema cache" を
-- 返し続けることがあります。最後にリロードを通知して即座に反映させます。
notify pgrst, 'reload schema';
