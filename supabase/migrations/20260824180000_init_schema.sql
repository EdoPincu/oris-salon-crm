-- Ori's Salon CRM — core schema
-- Money is stored as integer cents. All instants are timestamptz;
-- wall-clock rules (working hours) are stored as `time` and interpreted
-- in the shop timezone held in public.settings.

create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- ---------------------------------------------------------------- enums
create type public.user_role          as enum ('owner', 'staff', 'client');
create type public.appointment_status as enum ('pending', 'confirmed', 'completed', 'cancelled', 'no_show');
create type public.appointment_source as enum ('admin', 'online');
create type public.payment_method     as enum ('cash', 'card', 'transfer', 'other');

-- ------------------------------------------------------------- settings
-- Single-row table. The `id` check pins it to exactly one row.
create table public.settings (
  id                       boolean primary key default true check (id),
  display_name             text        not null default 'Ori''s Salon',
  timezone                 text        not null default 'Europe/Berlin',
  currency                 text        not null default 'EUR',
  booking_lead_hours       integer     not null default 12  check (booking_lead_hours >= 0),
  booking_horizon_days     integer     not null default 60  check (booking_horizon_days > 0),
  slot_granularity_minutes integer     not null default 15  check (slot_granularity_minutes > 0),
  refill_interval_weeks    integer     not null default 3   check (refill_interval_weeks > 0),
  auto_confirm_online      boolean     not null default false,
  updated_at               timestamptz not null default now()
);
comment on column public.settings.auto_confirm_online is
  'false = online bookings land as pending for the owner to approve.';

insert into public.settings (id) values (true);

-- ------------------------------------------------------------- profiles
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  role       public.user_role not null default 'client',
  full_name  text,
  email      text,
  phone      text,
  created_at timestamptz not null default now()
);
create index profiles_email_idx on public.profiles (lower(email));

-- Every auth user gets a profile, defaulting to the least-privileged role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- staff
-- profile_id is nullable on purpose: a tech can exist as a calendar
-- resource without ever having a login (v1 has no staff logins).
create table public.staff (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid unique references public.profiles (id) on delete set null,
  display_name text        not null,
  color        text        not null default '#C98B8B',
  active       boolean     not null default true,
  sort_order   integer     not null default 0,
  created_at   timestamptz not null default now()
);

-- ------------------------------------------------------------- services
create table public.services (
  id               uuid primary key default gen_random_uuid(),
  name             text        not null,
  description      text,
  duration_minutes integer     not null check (duration_minutes > 0),
  price_cents      integer     not null check (price_cents >= 0),
  active           boolean     not null default true,
  sort_order       integer     not null default 0,
  created_at       timestamptz not null default now()
);

-- -------------------------------------------------------------- clients
-- profile_id is nullable so the owner can add walk-ins who never log in.
create table public.clients (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles (id) on delete set null,
  full_name  text        not null,
  email      text,
  phone      text,
  notes      text,
  allergies  text,
  birthday   date,
  archived   boolean     not null default false,
  created_at timestamptz not null default now()
);
create index clients_email_idx on public.clients (lower(email));
create index clients_name_idx  on public.clients (lower(full_name));

-- --------------------------------------------------------- appointments
create table public.appointments (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients (id) on delete restrict,
  staff_id   uuid          references public.staff (id)   on delete set null,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  status     public.appointment_status not null default 'pending',
  source     public.appointment_source not null default 'admin',
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_time_order check (ends_at > starts_at)
);
create index appointments_starts_at_idx on public.appointments (starts_at);
create index appointments_client_idx    on public.appointments (client_id, starts_at desc);
create index appointments_status_idx    on public.appointments (status) where status = 'pending';

-- The real double-booking guard. Enforced by the database, so it holds even
-- if two requests race or someone writes directly via SQL. Cancelled and
-- no-show appointments are excluded so their slots free up.
alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('pending', 'confirmed', 'completed'));

-- ------------------------------------------------- appointment_services
-- Price and duration are snapshotted at booking time so that changing a
-- service's price never rewrites historical revenue.
create table public.appointment_services (
  id               uuid primary key default gen_random_uuid(),
  appointment_id   uuid    not null references public.appointments (id) on delete cascade,
  service_id       uuid            references public.services (id)     on delete set null,
  name             text    not null,
  price_cents      integer not null check (price_cents >= 0),
  duration_minutes integer not null check (duration_minutes > 0)
);
create index appointment_services_appt_idx on public.appointment_services (appointment_id);

-- ------------------------------------------------------------- payments
create table public.payments (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid    not null references public.appointments (id) on delete cascade,
  amount_cents   integer not null check (amount_cents >= 0),
  tip_cents      integer not null default 0 check (tip_cents >= 0),
  method         public.payment_method not null default 'cash',
  paid_at        timestamptz not null default now(),
  note           text
);
create index payments_paid_at_idx on public.payments (paid_at);
create index payments_appt_idx    on public.payments (appointment_id);

-- ---------------------------------------------------- availability rules
-- weekday: 0 = Sunday .. 6 = Saturday, matching Postgres `extract(dow)`.
create table public.availability_rules (
  id         uuid primary key default gen_random_uuid(),
  staff_id   uuid     not null references public.staff (id) on delete cascade,
  weekday    smallint not null check (weekday between 0 and 6),
  start_time time     not null,
  end_time   time     not null,
  constraint availability_time_order check (end_time > start_time)
);
create index availability_staff_idx on public.availability_rules (staff_id, weekday);

-- -------------------------------------------------------------- time off
create table public.time_off (
  id        uuid primary key default gen_random_uuid(),
  staff_id  uuid not null references public.staff (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at   timestamptz not null,
  reason    text,
  constraint time_off_order check (ends_at > starts_at)
);
create index time_off_staff_idx on public.time_off (staff_id, starts_at);

-- ------------------------------------------------------- updated_at glue
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger appointments_touch_updated_at
  before update on public.appointments
  for each row execute function public.touch_updated_at();
