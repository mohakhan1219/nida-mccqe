-- Additive ABZI schedule columns for existing production workspaces.
-- Safe to re-run. Does not delete or rewrite schedule rows.
-- Run in Supabase SQL editor (or psql) before deploying the app that seeds ABZI events.

alter table public.schedule_events add column if not exists title text not null default '';
alter table public.schedule_events add column if not exists topics jsonb not null default '[]'::jsonb;
alter table public.schedule_events add column if not exists external_id text;
alter table public.schedule_events add column if not exists attendance text;
alter table public.schedule_events add column if not exists prep_done boolean not null default false;
alter table public.schedule_events add column if not exists practice_done boolean not null default false;
alter table public.schedule_events add column if not exists review_done boolean not null default false;
alter table public.schedule_events add column if not exists time_tentative boolean not null default false;
alter table public.schedule_events add column if not exists linked_assessment_id text;

create unique index if not exists schedule_events_workspace_external_id_uidx
  on public.schedule_events (workspace_id, external_id)
  where external_id is not null;
