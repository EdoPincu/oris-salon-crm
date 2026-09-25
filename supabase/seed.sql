-- Local development seed. Applied automatically by `supabase db reset`.
--
-- Production starts empty by design — the salon enters its own real data, and
-- that principle has not changed. This file exists only so a *local* database
-- is immediately usable: `/book` refuses to open until at least one service,
-- one tech and some working hours exist, so without a seed every reset would
-- mean re-entering all three by hand before you could test anything.
--
-- Deliberately obvious fake data. Nothing here should ever be mistaken for
-- Ori's real menu, and the Supabase CLI only runs this against the local
-- stack — `supabase db push` does not apply it to the linked project.

-- Shop settings: the row already exists (id is a one-row check constraint),
-- so update rather than insert. Israel locale, matching production.
update public.settings
set display_name             = 'סלון בדיקות (מקומי)',
    timezone                 = 'Asia/Jerusalem',
    currency                 = 'ILS',
    booking_lead_hours       = 0,   -- 0 locally so a slot later today is bookable
    booking_horizon_days     = 60,
    slot_granularity_minutes = 15,
    auto_confirm_online      = false
where id;

-- One tech.
insert into public.staff (id, display_name, color, active, sort_order)
values ('11111111-1111-1111-1111-111111111111', 'אורי (בדיקות)', '#C98B8B', true, 0)
on conflict (id) do nothing;

-- A small menu, priced in agorot.
insert into public.services (id, name, description, duration_minutes, price_cents, sort_order)
values
  ('22222222-2222-2222-2222-222222222201', 'מניקור ג''ל',   'שירות בדיקה מקומי', 60, 12000, 0),
  ('22222222-2222-2222-2222-222222222202', 'לק ג''ל',        'שירות בדיקה מקומי', 45,  9000, 1),
  ('22222222-2222-2222-2222-222222222203', 'בניית ציפורניים','שירות בדיקה מקומי', 90, 20000, 2)
on conflict (id) do nothing;

-- Working hours for all seven days, Sunday (0) through Saturday (6).
--
-- Production is currently Sunday–Friday because Saturday was never ticked in
-- Settings; locally every day is open on purpose, so a test booking never
-- fails merely because of which day you happen to run it.
insert into public.availability_rules (staff_id, weekday, start_time, end_time)
select '11111111-1111-1111-1111-111111111111', d, '09:00', '18:00'
from generate_series(0, 6) as d
on conflict do nothing;
