-- =====================================================================
-- SpoolStack : reset_foreign_schema.sql
-- ONE-OFF. Written 2026-09-23.
--
-- Why this exists: the live Supabase project held a schema that was never
-- created from db/schema.sql. It reused the same table names with different
-- columns, a 9-row parameter seed instead of 25, and a run_cost_breakdown
-- view WITHOUT security_invoker, which would have exposed every user's run
-- costs to every signed-in user as soon as any runs existed.
--
-- What it does: drops those ten objects so db/schema.sql can build into a
-- clean public schema.
--
-- Safety, in order:
--   1. The GUARD below is the first statement. It counts rows in every user
--      data table and raises an exception if ANY of them has rows. Execution
--      stops at the first error, so if the guard fires, not one DROP runs.
--   2. No CASCADE anywhere. If some object neither of us knows about depends
--      on these tables, its DROP fails loudly instead of silently taking the
--      unknown object with it. Postgres runs a multi-statement batch as one
--      implicit transaction, so a failure rolls the earlier drops back too.
--   3. Reference tables (domains, parameter_defs, defect_types) hold only
--      seed data, which db/schema.sql recreates, so they are not guarded.
--
-- Run order:
--   1. this file
--   2. db/schema.sql
-- =====================================================================

do $guard$
declare
  t        text;
  n        bigint;
  blocking text := '';
begin
  foreach t in array array[
    'runs', 'run_defects', 'machines', 'materials', 'projects', 'user_settings'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format('select count(*) from public.%I', t) into n;
      if n > 0 then
        blocking := blocking || format(' %s=%s', t, n);
      end if;
    end if;
  end loop;

  if blocking <> '' then
    raise exception using
      message = 'Refusing to reset: user tables contain data:' || blocking,
      hint    = 'Nothing was dropped. If this data matters, it needs a migration, not a reset.';
  end if;

  raise notice 'Guard passed: all user tables empty or absent. Proceeding with drops.';
end
$guard$;

-- Dependents first: the view reads runs, and run_defects references runs.
drop view  if exists public.run_cost_breakdown;
drop table if exists public.run_defects;
drop table if exists public.runs;

-- User setup tables. Dropping a table also drops its policies and triggers.
drop table if exists public.projects;
drop table if exists public.materials;
drop table if exists public.machines;
drop table if exists public.user_settings;

-- Reference tables last: the tables above referenced them.
drop table if exists public.parameter_defs;
drop table if exists public.defect_types;
drop table if exists public.domains;

-- =====================================================================
-- Verify: this should return zero rows.
--   select relname, relkind from pg_class
--   where relnamespace = 'public'::regnamespace
--     and relname in ('domains','parameter_defs','defect_types','machines',
--                     'materials','projects','runs','run_defects',
--                     'user_settings','run_cost_breakdown');
-- =====================================================================
