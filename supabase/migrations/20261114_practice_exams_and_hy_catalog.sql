-- Phase 1 corrections: practice assessments + high-yield catalog key
-- Additive only. Do NOT apply automatically to production — review/approve first.
-- Does not truncate, rewrite, or delete study history.

-- 1) Stable catalog key for idempotent Filipe Santos imports (progress preserved)
alter table public.high_yield_topics
  add column if not exists catalog_key text;

create unique index if not exists high_yield_topics_workspace_catalog_key_uidx
  on public.high_yield_topics (workspace_id, catalog_key)
  where catalog_key is not null;

create unique index if not exists high_yield_topics_workspace_source_subject_topic_uidx
  on public.high_yield_topics (workspace_id, source, subject, topic);

-- 2) Upcoming / completed practice assessments (separate from official licensing exam)
create table if not exists public.practice_assessments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider text not null check (
    provider in ('mccqe1_official_practice', 'uworld', 'ace', 'abzi', 'mcc', 'other')
  ),
  title text not null,
  status text not null check (status in ('scheduled', 'completed', 'cancelled')),
  scheduled_date date not null,
  completed_date date,
  total int,
  correct int,
  incorrect int,
  score_pct numeric,
  notes text not null default '',
  linked_test_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists practice_assessments_workspace_sched_idx
  on public.practice_assessments (workspace_id, scheduled_date);

alter table public.practice_assessments enable row level security;

drop policy if exists "workspace practice assessments" on public.practice_assessments;
create policy "workspace practice assessments"
  on public.practice_assessments for all
  using (workspace_id = public.user_workspace_id())
  with check (workspace_id = public.user_workspace_id());

do $$
begin
  begin
    execute 'alter publication supabase_realtime add table public.practice_assessments';
  exception
    when duplicate_object then null;
  end;
end $$;

-- Notes:
-- Official booking confirmation flags (examBookedConfirmed, examBookingConfirmedAt)
-- live in settings.data jsonb and need no schema change.
-- Completing a practice assessment creates/links a tests_mocks row for performance
-- stats so scores are not double-counted.
