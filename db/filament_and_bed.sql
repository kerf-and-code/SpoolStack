-- =====================================================================
-- SpoolStack: filament colours, build plate, surface prep, enclosure and
-- warping, 2026-10-12
-- =====================================================================
-- Run once in the Supabase SQL editor. Safe to run again: every statement
-- is idempotent.
--
-- 1. materials.color_hex: the colour of a filament as a hex code, so the
--    app can show a swatch and tell two spools of the same PLA apart by the
--    colour the slicer file names.
-- 2. A new parameter type, multi_enum: several options at once, stored as
--    a JSON array. Surface prep becomes one ("cleaned with IPA, then
--    hairspray").
-- 3. Settings: Build plate (one choice), Surface prep (any number), and
--    Printed in an enclosure (yes/no).
-- 4. Existing runs: surface prep values that were really plate types
--    (textured PEI, smooth PEI, glass) move to Build plate; the rest become
--    one-item lists. Only runs that have a surface prep value are touched.
-- 5. Warping is renamed to say what it looks like, and enclosure and plate
--    join the likely causes that later fix suggestions start from.
--
-- No column or table is dropped. Two CHECK constraints on parameter_defs are
-- replaced with wider versions of themselves.
-- =====================================================================


-- ---- 1. Filament colour ----------------------------------------------------
alter table public.materials add column if not exists color_hex text;

do $fb_material_hex$
begin
  if not exists (select 1 from pg_constraint where conname = 'materials_color_hex_shape') then
    alter table public.materials
      add constraint materials_color_hex_shape check (color_hex is null or color_hex ~ '^#[0-9A-F]{6}$');
  end if;
end
$fb_material_hex$;

comment on column public.materials.color_hex is
  'Colour as "#RRGGBB", upper case. Matched against filament_colour in slicer files.';


-- ---- 2. multi_enum parameter type ----------------------------------------
-- Replaces the data_type and enum-options checks with versions that also
-- allow multi_enum. Found by what they check, not by name, so a project
-- whose constraint was named differently is still updated.
do $fb_multi_enum$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.parameter_defs'::regclass
      and contype = 'c'
      and (pg_get_constraintdef(oid) like '%data_type = ANY%' or pg_get_constraintdef(oid) like '%data_type <> %')
      and conname not in ('parameter_defs_data_type_check2', 'parameter_defs_options_present')
  loop
    execute format('alter table public.parameter_defs drop constraint %I', c.conname);
  end loop;

  if not exists (select 1 from pg_constraint where conname = 'parameter_defs_data_type_check2') then
    alter table public.parameter_defs
      add constraint parameter_defs_data_type_check2
      check (data_type in ('number', 'integer', 'boolean', 'text', 'enum', 'multi_enum'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'parameter_defs_options_present') then
    alter table public.parameter_defs
      add constraint parameter_defs_options_present
      check (data_type not in ('enum', 'multi_enum') or (enum_options is not null and cardinality(enum_options) > 0));
  end if;
end
$fb_multi_enum$;


-- ---- 3. Build plate, surface prep, enclosure -----------------------------
insert into public.parameter_defs
  (domain_id, key, display_name, group_name, data_type, unit,
   min_value, max_value, step, enum_options, is_required, is_calibration_relevant, help_text, sort_order)
values
  ('fdm','enclosed',             'Printed in an enclosure', 'Temperature', 'boolean', null, null, null, null, null, false, true,
     'An enclosed printer, or a box around an open one. Keeps the air around the print warm and still, which is what stops warping.', 45),
  ('fdm','bed_plate',            'Build plate',         'Adhesion',   'enum',   null,   null,null, null,
     array['textured_pei','smooth_pei','satin_pei','cool_plate','supertack','engineering_plate','glass','garolite','buildtak','other'], false, true,
     'The plate the print went on. Bambu''s High Temp Plate is smooth PEI.', 235),
  ('fdm','surface_prep',         'Bed surface prep',    'Adhesion',   'multi_enum', null, null,null, null,
     array['none','isopropyl_clean','soap_and_water','glue_stick','hairspray','adhesive_liquid','tape'], false, true,
     'Everything you did to the plate, in any order. Cheap to log, and it explains more first-layer failures than temperature does.', 240)
on conflict (domain_id, key) do update
  set display_name            = excluded.display_name,
      group_name              = excluded.group_name,
      data_type               = excluded.data_type,
      unit                    = excluded.unit,
      min_value               = excluded.min_value,
      max_value               = excluded.max_value,
      step                    = excluded.step,
      enum_options            = excluded.enum_options,
      is_required             = excluded.is_required,
      is_calibration_relevant = excluded.is_calibration_relevant,
      help_text               = excluded.help_text,
      sort_order              = excluded.sort_order;


-- ---- 4. Existing runs ---------------------------------------------------
-- 4a. A plate type logged as surface prep moves to Build plate, unless the
--     run already has a plate recorded.
update public.runs
set parameters = (parameters - 'surface_prep')
  || case
       when parameters ? 'bed_plate' then '{}'::jsonb
       else jsonb_build_object('bed_plate',
              case parameters->>'surface_prep'
                when 'pei_textured' then 'textured_pei'
                when 'pei_smooth'   then 'smooth_pei'
                else 'glass'
              end)
     end
where jsonb_typeof(parameters->'surface_prep') = 'string'
  and parameters->>'surface_prep' in ('pei_textured', 'pei_smooth', 'glass');

-- 4b. Any other single surface prep value becomes a one-item list.
update public.runs
set parameters = jsonb_set(parameters, '{surface_prep}', jsonb_build_array(parameters->'surface_prep'))
where jsonb_typeof(parameters->'surface_prep') = 'string';


-- ---- 5. Warping, and the causes fix suggestions will start from --------
update public.defect_types
set display_name  = 'Warping: base lifts off the bed',
    description   = 'The bottom of the print, usually the corners, lifts off the plate and curls up. '
                    'Most often uneven or changing air temperature around the print (drafts, no enclosure). A brim helps hold it down.',
    likely_causes = array['enclosed','chamber_temp','bed_temp','bed_adhesion','bed_plate','surface_prep','cooling_fan_percent']
where domain_id = 'fdm' and key = 'warping';

update public.defect_types
set likely_causes = array['z_offset','bed_temp','first_layer_temp','first_layer_speed','bed_plate','surface_prep','bed_adhesion']
where domain_id = 'fdm' and key = 'first_layer_adhesion';

update public.defect_types
set likely_causes = array['bed_adhesion','bed_plate','surface_prep','z_offset','supports']
where domain_id = 'fdm' and key = 'spaghetti';
