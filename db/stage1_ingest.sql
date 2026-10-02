-- =====================================================================
-- SpoolStack: Stage 1 slice 2, capture without typing (slicer uploader,
-- upload tokens, pending runs), 2026-10-02
-- =====================================================================
-- Run once in the Supabase SQL editor. Safe to run again: every statement
-- is idempotent. Nothing existing is changed or dropped; two tables, two
-- functions and their policies are added.
--
-- How it fits together:
--   1. You create an upload token in the app. Only its SHA-256 hash is
--      stored; the token itself is shown once and kept in a config file on
--      your PC by the uploader script.
--   2. After every slice, the script sends the settings part of the gcode
--      to /api/ingest with the token. The server parses it and calls
--      ingest_slice(), which checks the token and saves a PENDING run.
--   3. The dashboard's "Did it print?" inbox turns a pending run into a real
--      run with one tap, or dismisses it.
--
-- ingest_slice() and check_upload_token() are SECURITY DEFINER because the
-- uploader has no user session: the token is the credential. Each one does
-- exactly one narrow job, checks the token first, and is the only way
-- anything reaches pending_runs from outside a signed-in session.
-- =====================================================================


-- ---- 1. upload_tokens -------------------------------------------------
create table if not exists public.upload_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  token_hash    text not null,
  token_prefix  text not null,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  constraint upload_tokens_hash_uniq unique (token_hash),
  constraint upload_tokens_hash_shape check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint upload_tokens_name_len check (char_length(name) between 1 and 60),
  constraint upload_tokens_prefix_len check (char_length(token_prefix) between 4 and 16)
);

comment on table public.upload_tokens is
  'Credentials for the slicer uploader. Only the SHA-256 hash of each token is stored.';

create index if not exists idx_upload_tokens_user on public.upload_tokens (user_id, created_at desc);

alter table public.upload_tokens enable row level security;

drop policy if exists upload_tokens_select on public.upload_tokens;
create policy upload_tokens_select on public.upload_tokens for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists upload_tokens_insert on public.upload_tokens;
create policy upload_tokens_insert on public.upload_tokens for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists upload_tokens_update on public.upload_tokens;
create policy upload_tokens_update on public.upload_tokens for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists upload_tokens_delete on public.upload_tokens;
create policy upload_tokens_delete on public.upload_tokens for delete to authenticated
  using ((select auth.uid()) = user_id);

-- A signed-in user may rename or revoke a token, never rewrite its hash.
revoke all on public.upload_tokens from anon;
revoke update on public.upload_tokens from authenticated;
grant select, insert, delete on public.upload_tokens to authenticated;
grant update (name, revoked_at) on public.upload_tokens to authenticated;


-- ---- 2. pending_runs --------------------------------------------------
create table if not exists public.pending_runs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  token_id          uuid references public.upload_tokens(id) on delete set null,
  status            text not null default 'pending',
  file_name         text not null,
  slicer            text,
  printer_model     text,
  duration_minutes  numeric(10,2),
  material_g        numeric(12,3),
  -- The server parser's full output (ParsedRun), unvalidated. Parameters are
  -- validated against parameter_defs when the pending run becomes a run.
  parsed            jsonb not null default '{}'::jsonb,
  slicer_config     jsonb,
  run_id            uuid references public.runs(id) on delete set null,
  sliced_at         timestamptz not null default now(),
  resolved_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint pending_runs_status_check check (status in ('pending', 'logged', 'dismissed', 'superseded')),
  constraint pending_runs_file_name_len check (char_length(file_name) between 1 and 255),
  constraint pending_runs_slicer_len check (slicer is null or char_length(slicer) <= 120),
  constraint pending_runs_printer_len check (printer_model is null or char_length(printer_model) <= 120),
  constraint pending_runs_numbers check (
    (duration_minutes is null or duration_minutes >= 0) and (material_g is null or material_g >= 0)
  ),
  constraint pending_runs_parsed_shape check (
    jsonb_typeof(parsed) = 'object' and octet_length(parsed::text) <= 65536
  ),
  constraint pending_runs_config_shape check (
    slicer_config is null
    or (jsonb_typeof(slicer_config) = 'object' and octet_length(slicer_config::text) <= 131072)
  )
);

comment on table public.pending_runs is
  'Sliced files sent by the uploader, waiting for "did it print?". Becomes a run when logged.';

create index if not exists idx_pending_runs_inbox on public.pending_runs (user_id, status, sliced_at desc);

drop trigger if exists trg_pending_runs_updated_at on public.pending_runs;
create trigger trg_pending_runs_updated_at
  before update on public.pending_runs
  for each row execute function public.set_updated_at();

-- run_id must be one of the same user's runs. Foreign-key checks bypass RLS,
-- so the check is a trigger, as for runs.retry_of_run_id.
create or replace function public.check_pending_run_owner()
returns trigger
language plpgsql
as $check_pending_run_owner$
begin
  if new.run_id is not null
     and (tg_op = 'INSERT' or new.run_id is distinct from old.run_id)
     and not exists (
       select 1 from public.runs r
       where r.id = new.run_id
         and r.user_id = new.user_id
     )
  then
    raise exception using
      errcode = '23503',
      message = 'pending_runs.run_id must be one of your own runs';
  end if;
  return new;
end;
$check_pending_run_owner$;

drop trigger if exists trg_pending_runs_check_owner on public.pending_runs;
create trigger trg_pending_runs_check_owner
  before insert or update on public.pending_runs
  for each row execute function public.check_pending_run_owner();

alter table public.pending_runs enable row level security;

-- No insert policy: new pending runs arrive only through ingest_slice().
drop policy if exists pending_runs_select on public.pending_runs;
create policy pending_runs_select on public.pending_runs for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists pending_runs_update on public.pending_runs;
create policy pending_runs_update on public.pending_runs for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists pending_runs_delete on public.pending_runs;
create policy pending_runs_delete on public.pending_runs for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.pending_runs from anon;
revoke insert, update on public.pending_runs from authenticated;
grant select, delete on public.pending_runs to authenticated;
grant update (status, run_id, resolved_at) on public.pending_runs to authenticated;


-- ---- 3. check_upload_token(): does this token work? -------------------
-- Used by the uploader's --check. Returns the token's name, or raises.
create or replace function public.check_upload_token(p_token text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $check_upload_token$
declare
  v_name text;
begin
  if p_token is null or p_token !~ '^ssk_[A-Za-z0-9_-]{40,64}$' then
    raise exception using errcode = '28000', message = 'invalid upload token';
  end if;
  select t.name into v_name
  from public.upload_tokens t
  where t.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and t.revoked_at is null;
  if v_name is null then
    raise exception using errcode = '28000', message = 'invalid upload token';
  end if;
  return v_name;
end;
$check_upload_token$;

revoke all on function public.check_upload_token(text) from public;
grant execute on function public.check_upload_token(text) to anon, authenticated;


-- ---- 4. ingest_slice(): save a pending run for a token ----------------
-- Re-slicing the same file is normal (tweak, slice, tweak, slice). The
-- newest slice of a file name supersedes older pending ones from the last
-- 12 hours, so the inbox shows the version that was actually printed.
create or replace function public.ingest_slice(
  p_token            text,
  p_file_name        text,
  p_slicer           text,
  p_printer_model    text,
  p_duration_minutes numeric,
  p_material_g       numeric,
  p_parsed           jsonb,
  p_slicer_config    jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $ingest_slice$
declare
  v_token_id uuid;
  v_user_id  uuid;
  v_recent   integer;
  v_id       uuid;
begin
  if p_token is null or p_token !~ '^ssk_[A-Za-z0-9_-]{40,64}$' then
    raise exception using errcode = '28000', message = 'invalid upload token';
  end if;
  select t.id, t.user_id into v_token_id, v_user_id
  from public.upload_tokens t
  where t.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and t.revoked_at is null;
  if v_token_id is null then
    raise exception using errcode = '28000', message = 'invalid upload token';
  end if;

  -- A runaway script or a leaked token cannot flood an account.
  select count(*) into v_recent
  from public.pending_runs
  where user_id = v_user_id and created_at > now() - interval '1 hour';
  if v_recent >= 120 then
    raise exception using errcode = '54000', message = 'too many uploads in the last hour';
  end if;

  update public.upload_tokens set last_used_at = now() where id = v_token_id;

  update public.pending_runs
  set status = 'superseded', resolved_at = now()
  where user_id = v_user_id
    and status = 'pending'
    and file_name = left(p_file_name, 255)
    and sliced_at > now() - interval '12 hours';

  insert into public.pending_runs (
    user_id, token_id, file_name, slicer, printer_model,
    duration_minutes, material_g, parsed, slicer_config
  ) values (
    v_user_id, v_token_id, left(p_file_name, 255), left(p_slicer, 120), left(p_printer_model, 120),
    p_duration_minutes, p_material_g, coalesce(p_parsed, '{}'::jsonb), p_slicer_config
  )
  returning id into v_id;

  return v_id;
end;
$ingest_slice$;

revoke all on function public.ingest_slice(text, text, text, text, numeric, numeric, jsonb, jsonb) from public;
grant execute on function public.ingest_slice(text, text, text, text, numeric, numeric, jsonb, jsonb) to anon, authenticated;
