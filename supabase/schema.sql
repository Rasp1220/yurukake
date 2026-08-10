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

-- トップページ（再生数順10件）・もっと見るページ（再生数順ページング）で
-- 並び替えに使う再生数。`videos.list` の statistics.viewCount から取得する
-- （search.list には含まれないため別呼び出しが必要）。取得できなかった
-- 動画は0件として扱う。
alter table public.area_videos add column if not exists view_count bigint not null default 0;

create index if not exists area_videos_prefecture_idx on public.area_videos (prefecture);
-- 都道府県で絞り込んだ上で再生数順に並べる（トップページ・もっと見るページ）
-- クエリを高速化するための複合インデックス。
create index if not exists area_videos_prefecture_view_count_idx
  on public.area_videos (prefecture, view_count desc);
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
--
-- sort_by='view_count'：トップページ（再生数順10件）・もっと見るページ
-- （再生数順50件ページング）用。それ以外（既定'random'）は従来通りの
-- ランダム表示（自由検索・おすすめ枠）。
-- result_offset：もっと見るページのページング用（0始まり）。
create or replace function public.search_area_videos(
  search_query text,
  search_genre text default null,
  result_limit integer default 12,
  result_offset integer default 0,
  sort_by text default 'random'
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
  order by
    case when sort_by = 'view_count' then view_count end desc nulls last,
    case when sort_by = 'random' then random() end
  limit result_limit
  offset result_offset;
$$;

-- もっと見るページのページング（総件数からページ数を出す）に使う。
-- search_area_videos と同じ絞り込み条件を再利用する。
create or replace function public.count_area_videos(
  search_query text,
  search_genre text default null
)
returns integer
language sql
stable
as $$
  select count(*)::integer
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
$$;

-- お出かけブログ機能: ブログ本体（タイトル・サムネイル）と、本文を構成する
-- パーツ（テキスト／画像／動画）。パーツは並び順を持ち、必要な種類だけを
-- 好きな順番で追加できる。

create table if not exists public.blogs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  thumbnail_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 下書き/公開の切り替え。既定は'draft'なので、作成しただけのブログが
-- 本人の意図なく他人に見えることはない。
alter table public.blogs add column if not exists status text not null default 'draft';
alter table public.blogs drop constraint if exists blogs_status_check;
alter table public.blogs add constraint blogs_status_check check (status in ('draft', 'published'));

create index if not exists blogs_user_id_idx on public.blogs (user_id);

alter table public.blogs enable row level security;

-- 本人は下書き・公開済みどちらも見える（次の「公開済みは誰でも閲覧可」ポリシーと
-- OR条件で組み合わされる）。
drop policy if exists "Users can view their own blogs" on public.blogs;
create policy "Users can view their own blogs"
  on public.blogs for select
  using (auth.uid() = user_id);

-- ブロガーの公開プロフィールページ（/blogger/[userId]）・公開ブログページ
-- （/blogs/[id]）は未ログインでも見られるようにするため、公開済み(status='published')
-- のブログは誰でも閲覧できるようにする。
drop policy if exists "Anyone can view published blogs" on public.blogs;
create policy "Anyone can view published blogs"
  on public.blogs for select
  using (status = 'published');

drop policy if exists "Users can insert their own blogs" on public.blogs;
create policy "Users can insert their own blogs"
  on public.blogs for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own blogs" on public.blogs;
create policy "Users can update their own blogs"
  on public.blogs for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own blogs" on public.blogs;
create policy "Users can delete their own blogs"
  on public.blogs for delete
  using (auth.uid() = user_id);

-- type: 'text'（TinyMCEのHTML）／'image'／'video'（アップロードしたファイルのURL）。
-- content にHTMLまたはURLをそのまま保存する（パーツの種類ごとにテーブルを
-- 分けるほどの複雑さがないため、1テーブルにまとめている）。
create table if not exists public.blog_blocks (
  id uuid primary key default gen_random_uuid(),
  blog_id uuid not null references public.blogs (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in ('text', 'image', 'video')),
  content text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists blog_blocks_blog_id_idx on public.blog_blocks (blog_id);

alter table public.blog_blocks enable row level security;

drop policy if exists "Users can view their own blog blocks" on public.blog_blocks;
create policy "Users can view their own blog blocks"
  on public.blog_blocks for select
  using (auth.uid() = user_id);

-- 公開済みブログの本文パーツは、パーツ自体のuser_id（=著者）ではなく
-- 閲覧者が誰であっても読めるようにする。
drop policy if exists "Anyone can view blocks of published blogs" on public.blog_blocks;
create policy "Anyone can view blocks of published blogs"
  on public.blog_blocks for select
  using (
    exists (
      select 1 from public.blogs b
      where b.id = blog_blocks.blog_id and b.status = 'published'
    )
  );

drop policy if exists "Users can insert their own blog blocks" on public.blog_blocks;
create policy "Users can insert their own blog blocks"
  on public.blog_blocks for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own blog blocks" on public.blog_blocks;
create policy "Users can update their own blog blocks"
  on public.blog_blocks for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own blog blocks" on public.blog_blocks;
create policy "Users can delete their own blog blocks"
  on public.blog_blocks for delete
  using (auth.uid() = user_id);

-- ブログのサムネイル・画像パーツ・動画パーツのアップロード先。ファイルは
-- `{auth.uid()}/...` の下に置く前提で、フォルダ名（先頭パス要素）が
-- 自分のuser_idと一致する場合のみ読み書きできるようにする。バケット自体は
-- public にしておき、保存後の公開URL（getPublicUrl）でそのまま表示する。
insert into storage.buckets (id, name, public)
values ('blog-media', 'blog-media', true)
on conflict (id) do nothing;

drop policy if exists "Anyone can view blog media" on storage.objects;
create policy "Anyone can view blog media"
  on storage.objects for select
  using (bucket_id = 'blog-media');

drop policy if exists "Users can upload their own blog media" on storage.objects;
create policy "Users can upload their own blog media"
  on storage.objects for insert
  with check (bucket_id = 'blog-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update their own blog media" on storage.objects;
create policy "Users can update their own blog media"
  on storage.objects for update
  using (bucket_id = 'blog-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete their own blog media" on storage.objects;
create policy "Users can delete their own blog media"
  on storage.objects for delete
  using (bucket_id = 'blog-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- ブロガーの公開プロフィール（/blogger/[userId]）用の表示名。auth.usersの
-- メールアドレスをそのまま公開したくないため、任意で設定できる表示名だけを
-- 別テーブルで持つ。未設定でもプロフィールページ自体は表示できる。
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

-- プロフィールのタグ（例：東京／大阪）。エリアなど自由に増やせるよう、
-- 選べる候補は`src/lib/constants.ts`のPROFILE_TAGSだけで管理し、DB側は
-- ただの文字列配列として持つ（候補を増やしてもマイグレーション不要）。
alter table public.profiles add column if not exists tags text[] not null default '{}';

-- プロフィール画像（blog-mediaバケットへアップロードした公開URL）と、
-- 任意で設定できるSNS・WebサイトのURL。すべて未設定でも表示に支障はない。
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists twitter_url text;
alter table public.profiles add column if not exists instagram_url text;
alter table public.profiles add column if not exists youtube_url text;
alter table public.profiles add column if not exists website_url text;

create index if not exists profiles_display_name_trgm_idx
  on public.profiles using gin (display_name gin_trgm_ops);
create index if not exists profiles_tags_idx on public.profiles using gin (tags);

alter table public.profiles enable row level security;

drop policy if exists "Anyone can view profiles" on public.profiles;
create policy "Anyone can view profiles"
  on public.profiles for select
  using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = user_id);

-- ブロガー検索（/bloggers）。公開ブログを1件以上持つプロフィールだけを対象に、
-- 表示名または（部分一致を含む）タグが検索語にマッチするものを返す。
-- `language sql`（security definerではない）なので、呼び出したロールの
-- RLSがそのまま適用される（profilesは誰でもSELECT可、blogsは
-- status='published'のみ誰でもSELECT可という既存ポリシーに乗る）。
create or replace function public.search_bloggers(search_query text default null)
returns table (
  user_id uuid,
  display_name text,
  tags text[],
  avatar_url text,
  twitter_url text,
  instagram_url text,
  youtube_url text,
  website_url text
)
language sql
stable
as $$
  select
    p.user_id, p.display_name, p.tags,
    p.avatar_url, p.twitter_url, p.instagram_url, p.youtube_url, p.website_url
  from public.profiles p
  where exists (
    select 1 from public.blogs b
    where b.user_id = p.user_id and b.status = 'published'
  )
  and (
    search_query is null
    or search_query = ''
    or p.display_name ilike '%' || search_query || '%'
    or exists (select 1 from unnest(p.tags) t where t ilike '%' || search_query || '%')
  )
  order by p.display_name nulls last;
$$;

-- PostgREST（SupabaseのデータAPI）はテーブル定義をキャッシュしており、更新が
-- 反映されるまで "Could not find the table 'public.xxx' in the schema cache" を
-- 返し続けることがあります。最後にリロードを通知して即座に反映させます。
notify pgrst, 'reload schema';
