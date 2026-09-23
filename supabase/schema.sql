-- Dr. Nida Medical OS — run this in the Supabase SQL editor once.
-- Then: Authentication → Providers → Email enabled
-- Disable public sign-ups (invite-only).
-- Create Nida's user in Authentication → Users.
-- The first auth user is attached as primary automatically.
-- Later household/admin users: insert into public.profiles manually.

create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Dr. Nida Medical OS',
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  role text not null check (role in ('primary', 'admin')),
  display_name text not null default 'Dr. Nida',
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_items (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  id text not null,
  kind text not null,
  slug text not null,
  name text not null,
  active boolean not null default true,
  sort_order int not null default 0,
  meta jsonb not null default '{}'::jsonb,
  primary key (workspace_id, id),
  unique (workspace_id, kind, slug)
);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  subject_id text not null,
  source_id text not null,
  activity_id text not null,
  topic text not null default '',
  start_at timestamptz not null,
  end_at timestamptz,
  duration_minutes numeric,
  entry_mode text not null check (entry_mode in ('timer', 'manual')),
  status text not null check (status in ('running', 'completed')),
  notes text not null default '',
  confirmed_through_at timestamptz,
  linked_assessment_id text,
  planned boolean not null default false,
  confidence int,
  energy int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists one_running_session
  on public.study_sessions (workspace_id)
  where status = 'running';

create table if not exists public.question_blocks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  subject_id text not null,
  source_id text not null,
  assessment_type_id text not null,
  topic text not null default '',
  start_at timestamptz not null,
  end_at timestamptz not null,
  duration_minutes numeric not null,
  total int not null,
  correct int not null,
  incorrect int not null,
  skipped int not null,
  timed_mode text not null default 'timed',
  attempt_state text not null default 'first_pass',
  notes text not null default '',
  linked_session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tests_mocks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  subject_id text not null,
  source_id text not null,
  assessment_type_id text not null,
  test_name text not null default '',
  start_at timestamptz not null,
  end_at timestamptz not null,
  duration_minutes numeric not null,
  total int not null,
  correct int not null,
  incorrect int not null,
  skipped int not null,
  rank text not null default '',
  strong_areas text not null default '',
  weak_areas text not null default '',
  review_completed boolean not null default false,
  notes text not null default '',
  linked_session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.incorrect_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  source_kind text not null default 'manual',
  source_id text,
  subject_id text not null,
  provider_id text not null,
  topic text not null default '',
  question_count int not null default 1,
  error_type_id text not null,
  reason text not null default '',
  correct_concept text not null default '',
  priority text not null default 'medium',
  status text not null default 'pending',
  first_review_at date,
  second_review_at date,
  third_review_at date,
  tutor_question text not null default '',
  flashcard_created boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.courses (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  id text not null,
  slug text not null,
  name text not null,
  type text not null,
  start_date date,
  target_end_date date,
  total_units int,
  completed_units int not null default 0,
  total_questions int,
  completed_questions int not null default 0,
  current_subject_id text,
  status text not null default 'not_started',
  notes text not null default '',
  primary key (workspace_id, id),
  unique (workspace_id, slug)
);

create table if not exists public.schedule_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  event_date date not null,
  start_time text not null default '09:00',
  end_time text not null default '10:00',
  timezone text not null default 'America/Toronto',
  event_type text not null default 'Lecture',
  subject_id text,
  course_id text,
  status text not null default 'scheduled',
  notes text not null default '',
  title text not null default '',
  topics jsonb not null default '[]'::jsonb,
  external_id text,
  attendance text,
  prep_done boolean not null default false,
  practice_done boolean not null default false,
  review_done boolean not null default false,
  time_tentative boolean not null default false,
  linked_assessment_id text
);

create unique index if not exists schedule_events_workspace_external_id_uidx
  on public.schedule_events (workspace_id, external_id)
  where external_id is not null;

create table if not exists public.motivation_messages (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  id text not null,
  idx int not null,
  theme text not null,
  message text not null,
  primary key (workspace_id, id),
  unique (workspace_id, idx)
);

create or replace function public.user_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select workspace_id from public.profiles where id = auth.uid()
$$;

alter table public.workspaces enable row level security;
alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.catalog_items enable row level security;
alter table public.study_sessions enable row level security;
alter table public.question_blocks enable row level security;
alter table public.tests_mocks enable row level security;
alter table public.incorrect_reviews enable row level security;
alter table public.courses enable row level security;
alter table public.schedule_events enable row level security;
alter table public.motivation_messages enable row level security;

create policy "members read workspace"
  on public.workspaces for select
  using (id = public.user_workspace_id());

create policy "own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "members update own profile"
  on public.profiles for update
  using (id = auth.uid());

create policy "workspace settings"
  on public.settings for all
  using (workspace_id = public.user_workspace_id())
  with check (workspace_id = public.user_workspace_id());

create policy "workspace catalogs"
  on public.catalog_items for all
  using (workspace_id = public.user_workspace_id())
  with check (workspace_id = public.user_workspace_id());

create policy "workspace sessions"
  on public.study_sessions for all
  using (workspace_id = public.user_workspace_id())
  with check (workspace_id = public.user_workspace_id());

create policy "workspace blocks"
  on public.question_blocks for all
  using (workspace_id = public.user_workspace_id())
  with check (workspace_id = public.user_workspace_id());

create policy "workspace tests"
  on public.tests_mocks for all
  using (workspace_id = public.user_workspace_id())
  with check (workspace_id = public.user_workspace_id());

create policy "workspace reviews"
  on public.incorrect_reviews for all
  using (workspace_id = public.user_workspace_id())
  with check (workspace_id = public.user_workspace_id());

create policy "workspace courses"
  on public.courses for all
  using (workspace_id = public.user_workspace_id())
  with check (workspace_id = public.user_workspace_id());

create policy "workspace schedule"
  on public.schedule_events for all
  using (workspace_id = public.user_workspace_id())
  with check (workspace_id = public.user_workspace_id());

create policy "workspace quotes"
  on public.motivation_messages for all
  using (workspace_id = public.user_workspace_id())
  with check (workspace_id = public.user_workspace_id());

-- First authenticated user becomes primary on the shared workspace.
-- Later users must be inserted into profiles (invite-only).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wid uuid;
  profile_count int;
begin
  select count(*) into profile_count from public.profiles;
  if profile_count > 0 then
    return new;
  end if;

  insert into public.workspaces (name)
  values ('Dr. Nida Medical OS')
  returning id into wid;

  insert into public.profiles (id, workspace_id, role, display_name)
  values (new.id, wid, 'primary', coalesce(new.raw_user_meta_data->>'display_name', 'Dr. Nida'));

  insert into public.settings (workspace_id, data) values (wid, '{}'::jsonb);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Realtime for live sessions and cross-device sync (safe to re-run)
do $$
declare
  t text;
begin
  foreach t in array array[
    'study_sessions',
    'question_blocks',
    'tests_mocks',
    'incorrect_reviews',
    'settings',
    'schedule_events'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;
    end;
  end loop;
end $$;
