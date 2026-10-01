-- Revision Flashcards: cloud tables for syncing.
--
-- Run this once in your Supabase project: Dashboard > SQL Editor > New query,
-- paste the whole file, press Run. It is safe to run again.
--
-- Every row belongs to one user. Row Level Security means a signed-in person
-- can only ever read or change their own rows, even if they bypass the app.
-- Times are milliseconds since 1970, the same as on the device.
-- server_updated_at is set by the database on every write and is what devices
-- use to ask "what has changed since I last looked?".

-- On every write: stamp the time, and ignore an upload that is older than
-- what the cloud already has (the most recent edit wins).
create or replace function public.touch_server_updated_at()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null;
  end if;
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

create table if not exists public.subjects (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  sort_order double precision not null default 0,
  exam_dates jsonb not null default '[]',
  created_at bigint not null,
  updated_at bigint not null,
  deleted boolean not null default false,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table if not exists public.sets (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid not null,
  name text not null,
  sort_order double precision not null default 0,
  new_cards_per_day integer not null default 20,
  exam_date_override text,
  created_at bigint not null,
  updated_at bigint not null,
  deleted boolean not null default false,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table if not exists public.notes (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  set_id uuid not null,
  type text not null default 'basic',
  front text not null,
  back text not null,
  tags text[] not null default '{}',
  make_reverse boolean not null default false,
  created_at bigint not null,
  updated_at bigint not null,
  deleted boolean not null default false,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table if not exists public.cards (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  note_id uuid not null,
  set_id uuid not null,
  variant text not null,
  due bigint not null,
  stability double precision not null,
  difficulty double precision not null,
  elapsed_days double precision not null,
  scheduled_days double precision not null,
  learning_steps integer not null,
  reps integer not null,
  lapses integer not null,
  state smallint not null,
  last_review bigint,
  is_leech boolean not null default false,
  created_at bigint not null,
  updated_at bigint not null,
  deleted boolean not null default false,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table if not exists public.review_logs (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id uuid not null,
  rating smallint not null,
  state_before smallint not null,
  reviewed_at bigint not null,
  duration_ms integer not null,
  is_cram boolean not null default false,
  created_at bigint not null,
  updated_at bigint not null,
  deleted boolean not null default false,
  server_updated_at timestamptz not null default clock_timestamp()
);

-- One settings row per person.
create table if not exists public.settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at bigint not null,
  server_updated_at timestamptz not null default clock_timestamp()
);

do $$
declare t text;
begin
  foreach t in array array['subjects', 'sets', 'notes', 'cards', 'review_logs', 'settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists "Own rows only" on public.%I', t);
    execute format(
      'create policy "Own rows only" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('drop trigger if exists touch on public.%I', t);
    execute format(
      'create trigger touch before insert or update on public.%I
         for each row execute function public.touch_server_updated_at()', t);
    execute format(
      'create index if not exists %I on public.%I (user_id, server_updated_at)',
      t || '_user_changes', t);
  end loop;
end $$;
