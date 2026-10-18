-- Jalankan sekali di Supabase Dashboard → SQL Editor.

-- State pertandingan per kode game
create table if not exists public.games (
  id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.games enable row level security;

drop policy if exists "games_select" on public.games;
create policy "games_select" on public.games
  for select to anon, authenticated using (true);

drop policy if exists "games_insert" on public.games;
create policy "games_insert" on public.games
  for insert to anon, authenticated with check (true);

drop policy if exists "games_update" on public.games;
create policy "games_update" on public.games
  for update to anon, authenticated using (true) with check (true);

-- Bucket publik untuk logo tim
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'logos',
  'logos',
  true,
  1572864,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do nothing;

drop policy if exists "logos_select" on storage.objects;
create policy "logos_select" on storage.objects
  for select to anon, authenticated using (bucket_id = 'logos');

drop policy if exists "logos_insert" on storage.objects;
create policy "logos_insert" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'logos');
