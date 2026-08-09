-- Run this once in the Supabase project's SQL editor (Dashboard -> SQL Editor).
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
  saved_at timestamptz not null default now()
);

-- This app no longer integrates with Google Maps (no geocoding, no map
-- display), so spots have no coordinates. Drop the now-unused columns if
-- they still exist from an earlier version of this schema (they may have
-- a not-null constraint, which would otherwise reject every new insert
-- since the app no longer sends lat/lng).
alter table public.spots drop column if exists lat;
alter table public.spots drop column if exists lng;

create index if not exists spots_user_id_idx on public.spots (user_id);

alter table public.spots enable row level security;

create policy "Users can view their own spots"
  on public.spots for select
  using (auth.uid() = user_id);

create policy "Users can insert their own spots"
  on public.spots for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own spots"
  on public.spots for delete
  using (auth.uid() = user_id);
