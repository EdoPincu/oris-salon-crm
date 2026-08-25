-- Hebrew UI conversion — translate messages Postgres surfaces directly to a
-- browser (booking errors, the role guard). Business logic, column names,
-- and every errcode are unchanged.
--
-- errcode is untouched deliberately: app/(public)/book/wizard.tsx recovers
-- from a lost-slot race by checking `error.code === '23P01'`, not the
-- message text, so translating the message here cannot break that path.
-- (Both raise sites below keep 23P01.)

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
    raise exception 'עליך לאמת את כתובת האימייל שלך לפני קביעת תור.'
      using errcode = '28000';
  end if;

  select * into s from public.settings where id;
  select email into v_email from public.profiles where id = v_uid;

  v_duration := public.services_duration(p_service_ids);
  if v_duration <= 0 then
    raise exception 'יש לבחור לפחות שירות אחד.' using errcode = '22023';
  end if;
  v_ends_at := p_starts_at + make_interval(mins => v_duration);

  if p_starts_at < now() + make_interval(hours => s.booking_lead_hours) then
    raise exception 'המועד קרוב מדי — אנא בחרו שעה מאוחרת יותר.'
      using errcode = '22023';
  end if;

  if p_starts_at > now() + make_interval(days => s.booking_horizon_days) then
    raise exception 'התאריך רחוק מדי מהיום.' using errcode = '22023';
  end if;

  -- The slot must be one the availability rules actually offer.
  if not exists (
    select 1 from public.get_available_slots(
      p_staff_id, (p_starts_at at time zone s.timezone)::date, p_service_ids
    ) av
    where av.slot_start = p_starts_at
  ) then
    raise exception 'המועד הזה כבר לא פנוי.' using errcode = '23P01';
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
    raise exception 'מישהו אחר תפס את המועד הזה עכשיו — נסו לבחור מועד אחר.'
      using errcode = '23P01';
end;
$$;

create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if current_user in ('service_role', 'postgres', 'supabase_admin') then
      return new;
    end if;

    if not public.is_owner() then
      raise exception 'רק בעל/ת העסק יכולים לשנות הרשאות.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;
