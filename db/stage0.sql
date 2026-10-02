-- =====================================================================
-- SpoolStack: Stage 0 continued (retry links, full slicer config,
-- contribute opt-in), 2026-10-01
-- =====================================================================
-- Run once in the Supabase SQL editor. Safe to run again: every statement
-- is idempotent. Nothing is dropped; only columns, a constraint, an index
-- and a trigger are added.
--
-- 1. runs.retry_of_run_id + retry_change_note
--    A retry points at the run it retries, and says what changed. Without
--    this link the fix-suggestion loop can never learn whether a change
--    worked.
-- 2. runs.slicer_config
--    Every named setting from the slicer file, not just the 21 the form
--    maps. Later stages learn from settings nobody has mapped yet. Custom
--    start/end G-code blocks are left out by the app; the size check here
--    is a backstop.
-- 3. user_settings.contribute_training + contribute_training_changed_at
--    Off by default. No photo, label or run setting is used to train
--    anything unless this is on.
-- =====================================================================


-- ---- 1. Retry links ---------------------------------------------------
alter table public.runs
  add column if not exists retry_of_run_id uuid references public.runs(id) on delete set null;
alter table public.runs
  add column if not exists retry_change_note text;

do $stage0_constraints$
begin
  if not exists (select 1 from pg_constraint where conname = 'runs_retry_not_self') then
    alter table public.runs
      add constraint runs_retry_not_self check (retry_of_run_id is null or retry_of_run_id <> id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'runs_retry_note_len') then
    alter table public.runs
      add constraint runs_retry_note_len check (retry_change_note is null or char_length(retry_change_note) <= 500);
  end if;
end
$stage0_constraints$;

create index if not exists idx_runs_retry_of on public.runs (retry_of_run_id) where retry_of_run_id is not null;

comment on column public.runs.retry_of_run_id is
  'The run this one retries. Set null if that run is deleted. Must belong to the same user (trigger).';
comment on column public.runs.retry_change_note is
  'What the user says they changed for this retry. The settings diff is computed, this is the why.';

-- Foreign-key checks bypass RLS, so a retry could otherwise point at
-- another user's run. A policy on runs cannot query runs (Postgres reports
-- infinite recursion), so the check lives in a trigger. It runs with the
-- caller's rights, so the select below only sees the caller's own runs.
create or replace function public.check_retry_owner()
returns trigger
language plpgsql
as $check_retry_owner$
begin
  if new.retry_of_run_id is not null
     and (tg_op = 'INSERT' or new.retry_of_run_id is distinct from old.retry_of_run_id)
     and not exists (
       select 1 from public.runs r
       where r.id = new.retry_of_run_id
         and r.user_id = new.user_id
     )
  then
    raise exception using
      errcode = '23503',
      message = 'retry_of_run_id must be one of your own runs';
  end if;
  return new;
end;
$check_retry_owner$;

drop trigger if exists trg_runs_check_retry_owner on public.runs;
create trigger trg_runs_check_retry_owner
  before insert or update on public.runs
  for each row execute function public.check_retry_owner();


-- ---- 2. Full slicer config ---------------------------------------------
alter table public.runs
  add column if not exists slicer_config jsonb;

do $stage0_config$
begin
  if not exists (select 1 from pg_constraint where conname = 'runs_slicer_config_shape') then
    alter table public.runs
      add constraint runs_slicer_config_shape check (
        slicer_config is null
        or (jsonb_typeof(slicer_config) = 'object' and octet_length(slicer_config::text) <= 131072)
      );
  end if;
end
$stage0_config$;

comment on column public.runs.slicer_config is
  'Every named setting from the imported slicer file, key to value as text. '
  'runs.parameters holds the mapped, validated subset; this holds the rest for later learning.';


-- ---- 3. Contribute opt-in ----------------------------------------------
alter table public.user_settings
  add column if not exists contribute_training boolean not null default false;
alter table public.user_settings
  add column if not exists contribute_training_changed_at timestamptz;

comment on column public.user_settings.contribute_training is
  'Off by default. When on, this account''s photos, labels and run settings may be used to train '
  'SpoolStack''s diagnosis model. Read at training time, so switching off excludes the account from the next training set.';
