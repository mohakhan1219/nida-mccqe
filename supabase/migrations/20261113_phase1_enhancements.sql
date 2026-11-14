-- Phase 1 enhancements (additive only — do not truncate or recreate production data).
-- Apply manually in Supabase SQL editor after review/approval.

-- 1) Study sessions: paused status + pause log
-- Production verified: study_sessions_status_check is
--   CHECK (status IN ('running', 'completed'))
-- Leave study_sessions_entry_mode_check untouched.
alter table public.study_sessions
  drop constraint if exists study_sessions_status_check;

alter table public.study_sessions
  add constraint study_sessions_status_check
  check (status in ('running', 'paused', 'completed'));

alter table public.study_sessions
  add column if not exists pause_log jsonb not null default '[]'::jsonb;

drop index if exists one_running_session;
create unique index if not exists one_active_session
  on public.study_sessions (workspace_id)
  where status in ('running', 'paused');

-- 2) Cumulative QBank snapshots (UWorld / ACE / etc.)
create table if not exists public.qbank_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  source_id text not null,
  as_of_date date not null,
  total_available int,
  used int,
  unused int,
  correct int,
  incorrect int,
  skipped int,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists qbank_snapshots_workspace_source_asof_idx
  on public.qbank_snapshots (workspace_id, source_id, as_of_date desc);

alter table public.qbank_snapshots enable row level security;

drop policy if exists "workspace qbank snapshots" on public.qbank_snapshots;
create policy "workspace qbank snapshots"
  on public.qbank_snapshots for all
  using (workspace_id = public.user_workspace_id())
  with check (workspace_id = public.user_workspace_id());

-- 3) High-yield topic tracker (catalog may be empty until Filipe Santos source is imported)
create table if not exists public.high_yield_topics (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  subject text not null,
  topic text not null,
  priority text not null check (priority in ('very_high', 'high', 'medium', 'low')),
  status text not null check (status in ('not_started', 'in_progress', 'completed', 'needs_review')),
  notes text not null default '',
  source text not null default 'filipe-santos-mccqe1',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists high_yield_topics_workspace_idx
  on public.high_yield_topics (workspace_id, sort_order);

alter table public.high_yield_topics enable row level security;

drop policy if exists "workspace high yield topics" on public.high_yield_topics;
create policy "workspace high yield topics"
  on public.high_yield_topics for all
  using (workspace_id = public.user_workspace_id())
  with check (workspace_id = public.user_workspace_id());

-- 4) Realtime for new tables + sessions (safe to re-run)
do $$
declare
  t text;
begin
  foreach t in array array['qbank_snapshots', 'high_yield_topics', 'study_sessions']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;
    end;
  end loop;
end $$;

-- 5) ABZI course end date (does not touch schedule_events)
update public.courses
set target_end_date = '2026-12-18'
where id = 'course:abzi'
  and (target_end_date is null or target_end_date = '2026-12-11');

-- Notes:
-- Settings fields (suggestedExamDate, questionAccuracyGoal=0.72,
-- minEligibleQuestionsForTarget=4000, minSubjectsForTarget=6, minMocksForTarget=1,
-- pauseAutoEndMinutes) live in settings.data jsonb and need no schema change.
-- Auto-end of paused sessions is reconciled client-side from pause_log timestamps
-- (cross-device / closed browser safe). A DB cron is optional and not required for Phase 1.
