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

-- Turnamen: jadwal grup / gugur dan klasemen
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  format text not null default 'group_knockout'
    check (format in ('group_knockout', 'group', 'knockout')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.tournament_teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name text not null,
  short_name text not null default '',
  color text not null default '#e85d04',
  logo text not null default '',
  group_name text,
  players jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  stage text not null check (stage in ('group', 'knockout')),
  group_name text,
  round int not null default 1,
  round_label text not null default '',
  bracket_index int not null default 0,
  home_team_id uuid references public.tournament_teams(id) on delete set null,
  away_team_id uuid references public.tournament_teams(id) on delete set null,
  next_match_id uuid references public.matches(id) on delete set null,
  next_slot text check (next_slot in ('home', 'away')),
  scheduled_at timestamptz,
  venue text not null default '',
  status text not null default 'scheduled'
    check (status in ('scheduled', 'live', 'finished')),
  home_score int not null default 0,
  away_score int not null default 0,
  game_state jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tournament_teams_tournament_idx
  on public.tournament_teams (tournament_id);
create index if not exists matches_tournament_idx
  on public.matches (tournament_id);

do $$
declare t text;
begin
  foreach t in array array['tournaments', 'tournament_teams', 'matches'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_all', t);
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (true) with check (true)',
      t || '_all', t
    );
  end loop;
end $$;

-- Skor live di jadwal ikut update realtime
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;
end $$;
