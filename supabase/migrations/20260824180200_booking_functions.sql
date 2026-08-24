-- Ori's Salon CRM — booking logic
--
-- Both functions are SECURITY DEFINER so the public booking page never needs
-- read access to `appointments`, `clients` or `time_off`. A visitor can learn
-- which slots are free, and nothing about who is in them.

-- --------------------------------------------------------------- helpers
create or replace function public.services_duration(p_service_ids uuid[])
returns integer
language sql
stable
as $$
  select coalesce(sum(duration_minutes), 0)::integer
  from public.services
  where id = any(p_service_ids) and active;
$$;

-- --------------------------------------------------- get_available_slots
-- Returns the free start times for `p_date` that can fit the whole booking.
create or replace function public.get_available_slots(
  p_staff_id    uuid,
  p_date        date,
  p_service_ids uuid[]
)
returns table (slot_start timestamptz, slot_end timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s              public.settings%rowtype;
  v_duration     integer;
  v_step         interval;
begin
  select * into s from public.settings where id;

  v_duration := public.services_duration(p_service_ids);
  if v_duration <= 0 then
    return;                      -- nothing selected: no slots to offer
  end if;

  -- Refuse dates outside the bookable horizon.
  if p_date > (now() at time zone s.timezone)::date + s.booking_horizon_days then
    return;
  end if;

  v_step := make_interval(mins => s.slot_granularity_minutes);

  return query
  with windows as (
    -- Working hours are wall-clock in the shop's timezone; convert to instants.
    select
      ((p_date + ar.start_time) at time zone s.timezone) as win_start,
      ((p_date + ar.end_time)   at time zone s.timezone) as win_end
    from public.availability_rules ar
    where ar.staff_id = p_staff_id
      and ar.weekday  = extract(dow from p_date)::smallint
  ),
  candidates as (
    select g.ts as c_start,
           g.ts + make_interval(mins => v_duration) as c_end
    from windows w
    cross join lateral generate_series(w.win_start, w.win_end, v_step) as g(ts)
    where g.ts + make_interval(mins => v_duration) <= w.win_end
  )
  select c.c_start, c.c_end
  from candidates c
  where
    -- honour the minimum notice the owner set
    c.c_start >= now() + make_interval(hours => s.booking_lead_hours)
    -- not colliding with an appointment that still holds its slot
    and not exists (
      select 1 from public.appointments a
      where a.staff_id = p_staff_id
        and a.status in ('pending', 'confirmed', 'completed')
        and tstzrange(a.starts_at, a.ends_at, '[)')
            && tstzrange(c.c_start, c.c_end, '[)')
    )
    -- not inside a block of time off
    and not exists (
      select 1 from public.time_off t
      where t.staff_id = p_staff_id
        and tstzrange(t.starts_at, t.ends_at, '[)')
            && tstzrange(c.c_start, c.c_end, '[)')
    )
  order by c.c_start;
end;
$$;

-- ------------------------------------------------------ book_appointment
-- Called by a signed-in (email-verified) client. Everything happens in one
-- transaction; the exclusion constraint on `appointments` is what actually
-- prevents two people claiming the same slot, so a lost race raises rather
-- than silently double-booking.
create or replace function public.book_appointment(
  p_staff_id    uuid,
  p_starts_at   timestamptz,
  p_service_ids uuid[],
  p_full_name   text,
  p_phone       text default null,
  p_notes       text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  s            public.settings%rowtype;
  v_uid        uuid := auth.uid();
  v_email      text;
  v_duration   integer;
  v_ends_at    timestamptz;
  v_client_id  uuid;
  v_appt_id    uuid;
  v_status     public.appointment_status;
begin
  if v_uid is null then
    raise exception 'You must verify your email before booking.'
      using errcode = '28000';
  end if;

  select * into s from public.settings where id;
  select email into v_email from public.profiles where id = v_uid;

  v_duration := public.services_duration(p_service_ids);
  if v_duration <= 0 then
    raise exception 'Select at least one service.' using errcode = '22023';
  end if;
  v_ends_at := p_starts_at + make_interval(mins => v_duration);

  if p_starts_at < now() + make_interval(hours => s.booking_lead_hours) then
    raise exception 'That time is too soon — please choose a later slot.'
      using errcode = '22023';
  end if;

  if p_starts_at > now() + make_interval(days => s.booking_horizon_days) then
    raise exception 'That date is too far ahead.' using errcode = '22023';
  end if;

  -- The slot must be one the availability rules actually offer.
  if not exists (
    select 1 from public.get_available_slots(
      p_staff_id, (p_starts_at at time zone s.timezone)::date, p_service_ids
    ) av
    where av.slot_start = p_starts_at
  ) then
    raise exception 'That slot is no longer available.' using errcode = '23P01';
  end if;

  -- Attach to the caller's client record, creating or claiming one by email.
  select id into v_client_id from public.clients where profile_id = v_uid;

  if v_client_id is null and v_email is not null then
    update public.clients
       set profile_id = v_uid,
           phone      = coalesce(nullif(p_phone, ''), phone)
     where profile_id is null
       and lower(email) = lower(v_email)
     returning id into v_client_id;
  end if;

  if v_client_id is null then
    insert into public.clients (profile_id, full_name, email, phone)
    values (v_uid, p_full_name, v_email, nullif(p_phone, ''))
    returning id into v_client_id;
  end if;

  v_status := case when s.auto_confirm_online then 'confirmed' else 'pending' end;

  insert into public.appointments
    (client_id, staff_id, starts_at, ends_at, status, source, notes)
  values
    (v_client_id, p_staff_id, p_starts_at, v_ends_at, v_status, 'online', nullif(p_notes, ''))
  returning id into v_appt_id;

  -- Snapshot name, price and duration so later price changes don't rewrite history.
  insert into public.appointment_services
    (appointment_id, service_id, name, price_cents, duration_minutes)
  select v_appt_id, sv.id, sv.name, sv.price_cents, sv.duration_minutes
  from public.services sv
  where sv.id = any(p_service_ids) and sv.active;

  return v_appt_id;

exception
  when exclusion_violation then
    raise exception 'Someone just took that slot — please pick another.'
      using errcode = '23P01';
end;
$$;

-- ------------------------------------------------------------- privileges
revoke all on function public.get_available_slots(uuid, date, uuid[]) from public;
revoke all on function public.book_appointment(uuid, timestamptz, uuid[], text, text, text) from public;

-- Anyone may see free slots; only a verified (signed-in) user may book.
grant execute on function public.get_available_slots(uuid, date, uuid[]) to anon, authenticated;
grant execute on function public.book_appointment(uuid, timestamptz, uuid[], text, text, text) to authenticated;
