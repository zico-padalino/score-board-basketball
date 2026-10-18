-- Jalankan di Supabase Dashboard → SQL Editor. Aman dijalankan ulang.

-- ============================================================
-- Tabel
-- ============================================================

-- State scoreboard per kode game (layar penonton membaca dari sini)
create table if not exists public.games (
  id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

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
  created_at timestamptz not null default now()
);

-- Info live kecil untuk jadwal publik (jam & skor per kuarter)
alter table public.matches add column if not exists period int not null default 1;
alter table public.matches add column if not exists clock_ms int not null default 0;
alter table public.matches add column if not exists shot_clock_ms int not null default 0;
alter table public.matches add column if not exists clock_running boolean not null default false;
alter table public.matches add column if not exists live_at timestamptz;
alter table public.matches add column if not exists period_scores jsonb not null default '{}'::jsonb;
alter table public.matches drop column if exists game_state;

-- State scoreboard lengkap per laga (untuk melanjutkan game & box score)
create table if not exists public.match_states (
  match_id uuid primary key references public.matches(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists tournament_teams_tournament_idx
  on public.tournament_teams (tournament_id);
create index if not exists matches_tournament_idx
  on public.matches (tournament_id);

-- ============================================================
-- Admin: hanya email di tabel ini yang boleh mengubah data
-- ============================================================

create table if not exists public.admins (
  email text primary key
);
alter table public.admins enable row level security;

-- Ganti / tambah email admin di sini (akun dibuat di Authentication → Users)
insert into public.admins (email) values ('zico.padalino@untirta.ac.id')
on conflict (email) do nothing;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- ============================================================
-- RLS: semua orang boleh baca, hanya admin yang boleh tulis
-- ============================================================

do $$
declare
  t text;
  p text;
begin
  foreach t in array array['games', 'tournaments', 'tournament_teams', 'matches', 'match_states'] loop
    execute format('alter table public.%I enable row level security', t);
    foreach p in array array['_all', '_select', '_insert', '_update', '_read', '_admin'] loop
      execute format('drop policy if exists %I on public.%I', t || p, t);
    end loop;
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      t || '_read', t
    );
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      t || '_admin', t
    );
  end loop;
end $$;

-- ============================================================
-- Storage logo tim: publik baca, admin upload
-- ============================================================

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
  for insert to authenticated with check (bucket_id = 'logos' and public.is_admin());

-- ============================================================
-- Realtime: jadwal publik ikut update saat skor/jam berubah
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;
end $$;
