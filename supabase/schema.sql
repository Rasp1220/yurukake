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

-- PostgREST（SupabaseのデータAPI）はテーブル定義をキャッシュしており、更新が
-- 反映されるまで "Could not find the table 'public.xxx' in the schema cache" を
-- 返し続けることがあります。最後にリロードを通知して即座に反映させます。
notify pgrst, 'reload schema';
