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
-- 「さがす」の公開日時順ソート・「新着おでかけスポット」で使う。
create index if not exists area_videos_published_at_idx on public.area_videos (published_at desc);

-- description はUIに表示せず検索のあいまい一致にしか使わないため、DB容量節約の
-- ため150文字に切り詰めて保存する運用にした。バッチ（fetch-area-videos）は
-- 新規取得分をすでに150文字以内に切り詰めて保存するが、それ以前に保存済みの
-- 行は長いままなので、ここで一括で切り詰める。150文字以内の行には影響しない
-- ため、このスクリプトを何度実行しても安全（冪等）。
update public.area_videos
set description = left(description, 150)
where length(description) > 150;

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

-- 点検バッチ（/api/cron/cleanup-area-videos）が「その都道府県の動画ではない」
-- 行を消せるようにする。書き込み系の他のポリシーと同じく、既定のanonキーでの
-- 接続を前提に許可している。
drop policy if exists "Anyone can prune area videos" on public.area_videos;
create policy "Anyone can prune area videos"
  on public.area_videos for delete
  using (true);

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

drop function if exists public.is_prefecture_name(text);

-- 検索語が都道府県名、または主要都市・エリア名（`src/lib/prefectures.ts` の
-- `PREFECTURE_ALIASES` と同じ内容。追加・変更したら両方に反映すること）で
-- あれば、その都道府県名を返す。どちらにも一致しなければ null を返す。
-- `search_area_videos` / `count_area_videos` が「都道府県で絞り込む」か
-- 「タイトル・説明文のあいまい検索にする」かを決めるのに使う。
--
-- 「札幌」「函館」のような市区町村名でも都道府県で絞り込めるようにするための
-- 関数。例えば「札幌」で検索したとき、単純なタイトル・説明文のあいまい検索
-- だと「札幌」という語を含まない北海道の動画（例：小樽・富良野の動画）が
-- 拾われず、逆に他県の動画がタイトルにたまたま「札幌」を含んでいれば紛れ込む。
-- ここで都道府県名に解決してから `av.prefecture = ...` で絞り込むことで、
-- 「その都道府県の動画だけを、都市名でも呼び出せる」状態にする。
create or replace function public.resolve_prefecture_query(search_query text)
returns text
language sql
immutable
as $$
  select prefecture
  from (
    values
    ('北海道', '北海道'),
    ('札幌', '北海道'),
    ('すすきの', '北海道'),
    ('小樽', '北海道'),
    ('函館', '北海道'),
    ('旭川', '北海道'),
    ('富良野', '北海道'),
    ('美瑛', '北海道'),
    ('知床', '北海道'),
    ('ニセコ', '北海道'),
    ('登別', '北海道'),
    ('洞爺', '北海道'),
    ('帯広', '北海道'),
    ('釧路', '北海道'),
    ('網走', '北海道'),
    ('青森', '青森'),
    ('弘前', '青森'),
    ('八戸', '青森'),
    ('奥入瀬', '青森'),
    ('十和田', '青森'),
    ('白神', '青森'),
    ('岩手', '岩手'),
    ('盛岡', '岩手'),
    ('花巻', '岩手'),
    ('平泉', '岩手'),
    ('八幡平', '岩手'),
    ('宮城', '宮城'),
    ('仙台', '宮城'),
    ('松島', '宮城'),
    ('石巻', '宮城'),
    ('鳴子', '宮城'),
    ('秋田', '秋田'),
    ('角館', '秋田'),
    ('男鹿', '秋田'),
    ('乳頭温泉', '秋田'),
    ('田沢湖', '秋田'),
    ('山形', '山形'),
    ('銀山温泉', '山形'),
    ('鶴岡', '山形'),
    ('酒田', '山形'),
    ('山寺', '山形'),
    ('福島', '福島'),
    ('会津', '福島'),
    ('郡山', '福島'),
    ('いわき', '福島'),
    ('磐梯', '福島'),
    ('猪苗代', '福島'),
    ('茨城', '茨城'),
    ('水戸', '茨城'),
    ('つくば', '茨城'),
    ('ひたち海浜', '茨城'),
    ('大洗', '茨城'),
    ('栃木', '栃木'),
    ('宇都宮', '栃木'),
    ('日光', '栃木'),
    ('那須', '栃木'),
    ('鬼怒川', '栃木'),
    ('益子', '栃木'),
    ('群馬', '群馬'),
    ('前橋', '群馬'),
    ('高崎', '群馬'),
    ('草津温泉', '群馬'),
    ('伊香保', '群馬'),
    ('榛名', '群馬'),
    ('埼玉', '埼玉'),
    ('大宮', '埼玉'),
    ('川越', '埼玉'),
    ('所沢', '埼玉'),
    ('秩父', '埼玉'),
    ('越谷', '埼玉'),
    ('千葉', '千葉'),
    ('船橋', '千葉'),
    ('浦安', '千葉'),
    ('舞浜', '千葉'),
    ('館山', '千葉'),
    ('銚子', '千葉'),
    ('木更津', '千葉'),
    ('成田', '千葉'),
    ('東京', '東京'),
    ('渋谷', '東京'),
    ('新宿', '東京'),
    ('池袋', '東京'),
    ('原宿', '東京'),
    ('表参道', '東京'),
    ('銀座', '東京'),
    ('浅草', '東京'),
    ('上野', '東京'),
    ('お台場', '東京'),
    ('吉祥寺', '東京'),
    ('中目黒', '東京'),
    ('六本木', '東京'),
    ('秋葉原', '東京'),
    ('スカイツリー', '東京'),
    ('下北沢', '東京'),
    ('高円寺', '東京'),
    ('恵比寿', '東京'),
    ('立川', '東京'),
    ('八王子', '東京'),
    ('神奈川', '神奈川'),
    ('横浜', '神奈川'),
    ('みなとみらい', '神奈川'),
    ('川崎', '神奈川'),
    ('鎌倉', '神奈川'),
    ('江ノ島', '神奈川'),
    ('江の島', '神奈川'),
    ('箱根', '神奈川'),
    ('湘南', '神奈川'),
    ('小田原', '神奈川'),
    ('新潟', '新潟'),
    ('長岡', '新潟'),
    ('佐渡', '新潟'),
    ('越後', '新潟'),
    ('富山', '富山'),
    ('立山', '富山'),
    ('黒部', '富山'),
    ('高岡', '富山'),
    ('氷見', '富山'),
    ('石川', '石川'),
    ('金沢', '石川'),
    ('兼六園', '石川'),
    ('能登', '石川'),
    ('輪島', '石川'),
    ('加賀温泉', '石川'),
    ('福井', '福井'),
    ('東尋坊', '福井'),
    ('永平寺', '福井'),
    ('敦賀', '福井'),
    ('若狭', '福井'),
    ('山梨', '山梨'),
    ('河口湖', '山梨'),
    ('山中湖', '山梨'),
    ('富士五湖', '山梨'),
    ('甲府', '山梨'),
    ('昇仙峡', '山梨'),
    ('清里', '山梨'),
    ('長野', '長野'),
    ('松本', '長野'),
    ('軽井沢', '長野'),
    ('上高地', '長野'),
    ('諏訪', '長野'),
    ('白馬', '長野'),
    ('善光寺', '長野'),
    ('岐阜', '岐阜'),
    ('高山', '岐阜'),
    ('白川郷', '岐阜'),
    ('下呂', '岐阜'),
    ('飛騨', '岐阜'),
    ('郡上', '岐阜'),
    ('静岡', '静岡'),
    ('熱海', '静岡'),
    ('伊豆', '静岡'),
    ('浜松', '静岡'),
    ('三島', '静岡'),
    ('沼津', '静岡'),
    ('御殿場', '静岡'),
    ('富士宮', '静岡'),
    ('愛知', '愛知'),
    ('名古屋', '愛知'),
    ('大須', '愛知'),
    ('犬山', '愛知'),
    ('常滑', '愛知'),
    ('豊橋', '愛知'),
    ('熱田', '愛知'),
    ('ジブリパーク', '愛知'),
    ('三重', '三重'),
    ('伊勢神宮', '三重'),
    ('伊勢志摩', '三重'),
    ('志摩', '三重'),
    ('鳥羽', '三重'),
    ('四日市', '三重'),
    ('ナガシマ', '三重'),
    ('滋賀', '滋賀'),
    ('琵琶湖', '滋賀'),
    ('彦根', '滋賀'),
    ('大津', '滋賀'),
    ('京都', '京都'),
    ('祇園', '京都'),
    ('嵐山', '京都'),
    ('清水寺', '京都'),
    ('伏見', '京都'),
    ('金閣寺', '京都'),
    ('河原町', '京都'),
    ('宇治', '京都'),
    ('鴨川', '京都'),
    ('天橋立', '京都'),
    ('大阪', '大阪'),
    ('梅田', '大阪'),
    ('難波', '大阪'),
    ('なんば', '大阪'),
    ('心斎橋', '大阪'),
    ('道頓堀', '大阪'),
    ('天王寺', '大阪'),
    ('ユニバ', '大阪'),
    ('USJ', '大阪'),
    ('通天閣', '大阪'),
    ('中之島', '大阪'),
    ('箕面', '大阪'),
    ('兵庫', '兵庫'),
    ('神戸', '兵庫'),
    ('姫路', '兵庫'),
    ('有馬温泉', '兵庫'),
    ('淡路島', '兵庫'),
    ('三宮', '兵庫'),
    ('城崎', '兵庫'),
    ('六甲', '兵庫'),
    ('奈良', '奈良'),
    ('東大寺', '奈良'),
    ('明日香', '奈良'),
    ('橿原', '奈良'),
    ('法隆寺', '奈良'),
    ('和歌山', '和歌山'),
    ('白浜', '和歌山'),
    ('高野山', '和歌山'),
    ('那智', '和歌山'),
    ('熊野', '和歌山'),
    ('アドベンチャーワールド', '和歌山'),
    ('鳥取', '鳥取'),
    ('米子', '鳥取'),
    ('境港', '鳥取'),
    ('三朝', '鳥取'),
    ('島根', '島根'),
    ('出雲', '島根'),
    ('松江', '島根'),
    ('石見', '島根'),
    ('隠岐', '島根'),
    ('岡山', '岡山'),
    ('倉敷', '岡山'),
    ('美観地区', '岡山'),
    ('蒜山', '岡山'),
    ('広島', '広島'),
    ('宮島', '広島'),
    ('尾道', '広島'),
    ('厳島', '広島'),
    ('山口', '山口'),
    ('下関', '山口'),
    ('錦帯橋', '山口'),
    ('角島', '山口'),
    ('秋吉台', '山口'),
    ('徳島', '徳島'),
    ('鳴門', '徳島'),
    ('祖谷', '徳島'),
    ('阿波', '徳島'),
    ('香川', '香川'),
    ('高松', '香川'),
    ('小豆島', '香川'),
    ('琴平', '香川'),
    ('直島', '香川'),
    ('愛媛', '愛媛'),
    ('松山', '愛媛'),
    ('道後温泉', '愛媛'),
    ('今治', '愛媛'),
    ('しまなみ', '愛媛'),
    ('高知', '高知'),
    ('桂浜', '高知'),
    ('四万十', '高知'),
    ('室戸', '高知'),
    ('仁淀', '高知'),
    ('福岡', '福岡'),
    ('博多', '福岡'),
    ('中洲', '福岡'),
    ('太宰府', '福岡'),
    ('門司港', '福岡'),
    ('北九州', '福岡'),
    ('佐賀', '佐賀'),
    ('唐津', '佐賀'),
    ('嬉野', '佐賀'),
    ('呼子', '佐賀'),
    ('武雄', '佐賀'),
    ('長崎', '長崎'),
    ('佐世保', '長崎'),
    ('ハウステンボス', '長崎'),
    ('軍艦島', '長崎'),
    ('五島', '長崎'),
    ('雲仙', '長崎'),
    ('熊本', '熊本'),
    ('阿蘇', '熊本'),
    ('天草', '熊本'),
    ('黒川温泉', '熊本'),
    ('人吉', '熊本'),
    ('大分', '大分'),
    ('別府', '大分'),
    ('湯布院', '大分'),
    ('由布院', '大分'),
    ('九重', '大分'),
    ('宮崎', '宮崎'),
    ('高千穂', '宮崎'),
    ('日南', '宮崎'),
    ('青島', '宮崎'),
    ('都城', '宮崎'),
    ('鹿児島', '鹿児島'),
    ('桜島', '鹿児島'),
    ('屋久島', '鹿児島'),
    ('指宿', '鹿児島'),
    ('霧島', '鹿児島'),
    ('奄美', '鹿児島'),
    ('沖縄', '沖縄'),
    ('那覇', '沖縄'),
    ('石垣島', '沖縄'),
    ('宮古島', '沖縄'),
    ('美ら海', '沖縄'),
    ('国際通り', '沖縄'),
    ('恩納', '沖縄')
  ) as aliases(alias, prefecture)
  where alias = search_query;
$$;

-- サイト側の検索（トップページのエリア枠・おすすめ枠・自由検索）はすべて
-- この関数経由で area_videos を読む。検索語が都道府県名、または `resolve_prefecture_query`
-- が解決できる主要都市・エリア名（「札幌」「名古屋」など）なら、その都道府県の
-- 行だけに絞り込む（他県のタイトル・説明文へのあいまい一致は見せない）。
-- これが無いと、例えば'石川'検索が東京の「小石川」を含む動画までヒットして
-- しまい、件数・再生数で押し負けたごく僅かな石川の動画が埋もれてしまう。
--
-- 都道府県そのものだけでなく「愛知」「名古屋」のように県名と主要都市名の
-- どちらで検索しても同じ愛知の動画（愛知として取り込まれた行はタイトルに
-- 「名古屋」しか出ないものも含む）が返るのはこのためで、ホームの「名古屋」
-- 「横浜」枠もこの解決を経て実質 prefecture='愛知' / '神奈川' に絞り込まれる。
--
-- 判定に「その都道府県の行が存在するか」ではなく都道府県名・エリア名そのものを
-- 使うのは、まだ一度も取得していない都道府県で、あいまい検索に落ちてほしく
-- ないため。例えば北海道の行が0件のとき、以前は「愛知で開催される北海道
-- グルメイベント」のような“よその県の動画”がトップページの「北海道の
-- おすすめスポット」に並んでしまっていた。0件のときは0件のまま返し、枠ごと
-- 出さないほうが正しい。
--
-- 都道府県名にも主要都市・エリア名にも解決できない自由なキーワード検索だけが、
-- タイトル・説明文のあいまい検索になる。ジャンルが指定されていれば、それも
-- 同様にタイトル・説明文で絞り込む（AND条件）。
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
  select av.*
  from public.area_videos av
  where
    (
      case
        when public.resolve_prefecture_query(search_query) is not null
        then av.prefecture = public.resolve_prefecture_query(search_query)
        else (
          av.title ilike '%' || search_query || '%'
          or av.description ilike '%' || search_query || '%'
        )
      end
    )
    and (
      search_genre is null
      or av.title ilike '%' || search_genre || '%'
      or av.description ilike '%' || search_genre || '%'
    )
  order by
    case when sort_by = 'view_count' then av.view_count end desc nulls last,
    case when sort_by = 'published_at' then av.published_at end desc nulls last,
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
  from public.area_videos av
  where
    (
      case
        when public.resolve_prefecture_query(search_query) is not null
        then av.prefecture = public.resolve_prefecture_query(search_query)
        else (
          av.title ilike '%' || search_query || '%'
          or av.description ilike '%' || search_query || '%'
        )
      end
    )
    and (
      search_genre is null
      or av.title ilike '%' || search_genre || '%'
      or av.description ilike '%' || search_genre || '%'
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
-- twitter_url/instagram_url/youtube_urlは列名こそ「url」だが、現在はUI上で
-- ユーザー名（例: "neko"）を入力させ、表示時にアプリ側でプロフィールURLを
-- 組み立てる（src/lib/snsLinks.ts）。古いデータ（フルURLが入っている行）も
-- 同ファイルの関数で読み替えるため、列自体のマイグレーションは不要。
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists twitter_url text;
alter table public.profiles add column if not exists instagram_url text;
alter table public.profiles add column if not exists youtube_url text;
alter table public.profiles add column if not exists website_url text;

-- プロフィール一言（自己紹介）。
alter table public.profiles add column if not exists bio text;

-- 自由に設定できるリンク欄（例: ポートフォリオ、ショップなど）。
-- 個人ドメインを持つ人が少ないため単一のWebサイトURL欄では窮屈という声を
-- 受け、ラベル付きのリンクを最大 MAX_PROFILE_LINKS（3件）まで登録できる
-- ようにした（`[{ "label": "...", "url": "..." }, ...]`）。既存の
-- website_url列はアプリ側で1件目として読み替えるため残してある。
alter table public.profiles add column if not exists links jsonb not null default '[]'::jsonb;

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

-- 「さがす」（/search）にブログ検索を統合するため、ブロガー（人）を表示名・
-- タグで探す専用の検索機能は廃止する（旧`search_bloggers`関数）。
drop function if exists public.search_bloggers(text);

-- ブログ検索（/search に統合、YouTube動画検索と並行して呼び出す）。公開済み
-- (status='published')のブログをタイトルの部分一致で検索する。本文
-- （blog_blocksのcontent）はTinyMCEのHTMLで、全文検索するとタグ由来の
-- ノイズが多いため、まずはタイトルのみを検索対象にする。
create index if not exists blogs_title_trgm_idx
  on public.blogs using gin (title gin_trgm_ops);

-- search_genre引数を追加する前の2引数版が残っていると、PostgREST側で
-- どちらの関数を呼ぶか一意に決まらずRPCがエラーになる（「さがす」で
-- 「ブログの検索に失敗しました」と出る原因）。先に古い方を消しておく。
drop function if exists public.search_blogs(text, integer);

create or replace function public.search_blogs(
  search_query text default null,
  result_limit integer default 24,
  search_genre text default null
)
returns table (
  id uuid,
  user_id uuid,
  title text,
  thumbnail_url text,
  created_at timestamptz,
  updated_at timestamptz,
  author_display_name text
)
language sql
stable
as $$
  select
    b.id, b.user_id, b.title, b.thumbnail_url, b.created_at, b.updated_at,
    p.display_name as author_display_name
  from public.blogs b
  left join public.profiles p on p.user_id = b.user_id
  where b.status = 'published'
    and (
      search_query is null
      or search_query = ''
      or b.title ilike '%' || search_query || '%'
    )
    and (
      search_genre is null
      or b.title ilike '%' || search_genre || '%'
    )
  order by b.created_at desc
  limit result_limit;
$$;

-- ハンバーガーメニューの「新着おでかけスポット」「YouTube」「ブログ」で使う。
-- YouTube動画（area_videos）と公開ブログ（blogs）を1つの結果としてUNIONし、
-- 公開日時の降順でページングできるようにする。spot_kindで'video'/'blog'に
-- 絞り込める（nullなら両方）。
create index if not exists blogs_created_at_idx on public.blogs (created_at desc);

create or replace function public.search_recent_spots(
  spot_kind text default null,
  result_limit integer default 24,
  result_offset integer default 0
)
returns table (
  kind text,
  id text,
  title text,
  thumbnail_url text,
  channel_title text,
  published_at timestamptz
)
language sql
stable
as $$
  select kind, id, title, thumbnail_url, channel_title, published_at
  from (
    select
      'video'::text as kind,
      av.video_id as id,
      av.title,
      av.thumbnail_url,
      av.channel_title,
      av.published_at
    from public.area_videos av
    where spot_kind is null or spot_kind = 'video'

    union all

    select
      'blog'::text as kind,
      b.id::text as id,
      b.title,
      b.thumbnail_url,
      null::text as channel_title,
      b.created_at as published_at
    from public.blogs b
    where b.status = 'published'
      and (spot_kind is null or spot_kind = 'blog')
  ) combined
  order by published_at desc nulls last
  limit result_limit
  offset result_offset;
$$;

-- search_recent_spots と同じ絞り込み条件を再利用する。
create or replace function public.count_recent_spots(spot_kind text default null)
returns integer
language sql
stable
as $$
  select (
    (select count(*) from public.area_videos where spot_kind is null or spot_kind = 'video')
    +
    (select count(*) from public.blogs
     where status = 'published' and (spot_kind is null or spot_kind = 'blog'))
  )::integer;
$$;

-- PostgREST（SupabaseのデータAPI）はテーブル定義をキャッシュしており、更新が
-- 反映されるまで "Could not find the table 'public.xxx' in the schema cache" を
-- 返し続けることがあります。最後にリロードを通知して即座に反映させます。
notify pgrst, 'reload schema';
