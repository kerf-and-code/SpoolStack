-- =====================================================================
-- SpoolStack: run photos (Stage 0 data collection), 2026-09-25
-- =====================================================================
-- Adds photos to runs: a private Storage bucket for the image files and a
-- run_photos table for what each photo shows. Run once in the Supabase SQL
-- editor. Safe to run again: every statement is idempotent.
--
-- Why a table and not the existing runs.photos array: each photo needs its
-- own labels (what kind of shot, which defect it shows). Those labels are
-- the training and test data for photo diagnosis later, so they must be
-- rows, not strings in an array. runs.photos and run_defects.photo_path
-- stay in place, unused; nothing is dropped here.
--
-- Files live at  run-photos/<user id>/<run id>/<photo id>.jpg
-- The first folder is the owner, which is what the Storage policies check.
-- =====================================================================


-- ---- 1. The bucket: private, images only, 10 MB cap per file ----------
-- The app shrinks photos to about 0.5 MB before upload; the cap is a
-- backstop against a raw 40 MP file slipping through.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('run-photos', 'run-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- ---- 2. Storage policies: your own folder only -------------------------
-- Upload additionally requires the run folder to be one of your runs, so a
-- file cannot be parked under someone else's run id even inside your folder.
drop policy if exists run_photos_objects_select on storage.objects;
create policy run_photos_objects_select on storage.objects for select to authenticated
  using (
    bucket_id = 'run-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists run_photos_objects_insert on storage.objects;
create policy run_photos_objects_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'run-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.runs r
      where r.id::text = (storage.foldername(name))[2]
        and r.user_id = (select auth.uid())
    )
  );

drop policy if exists run_photos_objects_delete on storage.objects;
create policy run_photos_objects_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'run-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );


-- ---- 3. run_photos: one row per photo, with its labels ----------------
create table if not exists public.run_photos (
  id             uuid primary key default gen_random_uuid(),
  run_id         uuid not null references public.runs(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  storage_path   text not null,
  -- What the shot is of. Diagnosis later weighs a first-layer close-up very
  -- differently from a whole-plate overview.
  kind           text not null default 'overview',
  -- The defect this photo shows, if any. One label per photo keeps the
  -- future training data clean; a photo showing two defects gets two shots.
  defect_type_id bigint references public.defect_types(id),
  caption        text,
  width          integer,
  height         integer,
  bytes          integer,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint run_photos_path_uniq unique (storage_path),
  constraint run_photos_kind_check check (kind in ('overview', 'closeup', 'first_layer', 'failure', 'other')),
  constraint run_photos_caption_len check (caption is null or char_length(caption) <= 300),
  constraint run_photos_dims_positive check ((width is null or width > 0) and (height is null or height > 0) and (bytes is null or bytes > 0)),
  -- The file must sit in this user's folder, under this run.
  constraint run_photos_path_shape check (storage_path like user_id::text || '/' || run_id::text || '/%')
);

comment on table public.run_photos is
  'Photos of a run, one row per image file in the run-photos bucket. kind and defect_type_id are '
  'the labels photo diagnosis will be trained and tested on.';

create index if not exists idx_run_photos_run  on public.run_photos (run_id, created_at);
create index if not exists idx_run_photos_user on public.run_photos (user_id, created_at desc);

drop trigger if exists trg_run_photos_updated_at on public.run_photos;
create trigger trg_run_photos_updated_at
  before update on public.run_photos
  for each row execute function public.set_updated_at();


-- ---- 4. RLS on run_photos ---------------------------------------------
-- Insert and update also check the parent run: foreign-key checks bypass
-- RLS, so without this a row could point at someone else's run.
alter table public.run_photos enable row level security;

drop policy if exists run_photos_select on public.run_photos;
create policy run_photos_select on public.run_photos for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists run_photos_insert on public.run_photos;
create policy run_photos_insert on public.run_photos for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and run_id in (select id from public.runs where user_id = (select auth.uid()))
  );

drop policy if exists run_photos_update on public.run_photos;
create policy run_photos_update on public.run_photos for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and run_id in (select id from public.runs where user_id = (select auth.uid()))
  );

drop policy if exists run_photos_delete on public.run_photos;
create policy run_photos_delete on public.run_photos for delete to authenticated
  using ((select auth.uid()) = user_id);


-- ---- 5. Grants ---------------------------------------------------------
revoke all on public.run_photos from anon;
grant select, insert, update, delete on public.run_photos to authenticated;
