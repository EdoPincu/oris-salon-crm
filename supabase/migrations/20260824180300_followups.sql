-- Ori's Salon CRM — follow-up lists
--
-- "Due for a refill" means: the client has been in before, their last visit is
-- older than the interval the owner set, and they have nothing booked. That
-- last condition is what stops the list nagging about people already returning.

create or replace function public.clients_due_for_refill()
returns table (
  client_id     uuid,
  full_name     text,
  phone         text,
  email         text,
  last_visit    timestamptz,
  weeks_since   integer,
  usual_service text
)
language sql
stable
security invoker
set search_path = public
as $$
  with s as (select * from public.settings where id),
  last_visits as (
    select a.client_id, max(a.starts_at) as last_visit
    from public.appointments a
    where a.status = 'completed'
    group by a.client_id
  ),
  upcoming as (
    select distinct a.client_id
    from public.appointments a
    where a.status in ('pending', 'confirmed')
      and a.starts_at >= now()
  )
  select
    c.id,
    c.full_name,
    c.phone,
    c.email,
    lv.last_visit,
    (extract(epoch from (now() - lv.last_visit)) / 604800)::integer as weeks_since,
    (
      select asv.name
      from public.appointment_services asv
      join public.appointments a2 on a2.id = asv.appointment_id
      where a2.client_id = c.id and a2.status = 'completed'
      group by asv.name
      order by count(*) desc, max(a2.starts_at) desc
      limit 1
    ) as usual_service
  from public.clients c
  join last_visits lv on lv.client_id = c.id
  cross join s
  where not c.archived
    and lv.last_visit < now() - make_interval(weeks => s.refill_interval_weeks)
    and c.id not in (select client_id from upcoming)
  order by lv.last_visit asc;
$$;

-- Clients who have drifted away: no visit in three times the refill interval.
create or replace function public.clients_lapsed()
returns table (
  client_id   uuid,
  full_name   text,
  phone       text,
  email       text,
  last_visit  timestamptz,
  weeks_since integer
)
language sql
stable
security invoker
set search_path = public
as $$
  with s as (select * from public.settings where id),
  last_visits as (
    select a.client_id, max(a.starts_at) as last_visit
    from public.appointments a
    where a.status = 'completed'
    group by a.client_id
  ),
  upcoming as (
    select distinct a.client_id
    from public.appointments a
    where a.status in ('pending', 'confirmed') and a.starts_at >= now()
  )
  select c.id, c.full_name, c.phone, c.email, lv.last_visit,
         (extract(epoch from (now() - lv.last_visit)) / 604800)::integer
  from public.clients c
  join last_visits lv on lv.client_id = c.id
  cross join s
  where not c.archived
    and lv.last_visit < now() - make_interval(weeks => s.refill_interval_weeks * 3)
    and c.id not in (select client_id from upcoming)
  order by lv.last_visit asc;
$$;

-- security invoker: these read `clients` and `appointments`, so RLS applies
-- and only the owner ever gets rows back.
revoke all on function public.clients_due_for_refill() from public;
revoke all on function public.clients_lapsed() from public;
grant execute on function public.clients_due_for_refill() to authenticated;
grant execute on function public.clients_lapsed() to authenticated;
