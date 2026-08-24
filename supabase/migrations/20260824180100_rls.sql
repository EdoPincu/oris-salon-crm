-- Ori's Salon CRM — row level security
--
-- Two real principals in v1: the salon owner (full access) and a client
-- (their own record and their own appointments, nothing else). Anonymous
-- visitors on the booking page may read only what the booking form needs:
-- the shop settings, the service menu, the tech list and working hours.
-- They can never read `clients`, `appointments` or `payments`.

-- ------------------------------------------------------- helper functions
-- SECURITY DEFINER so these bypass RLS. That is what makes it safe to call
-- them from a policy on `profiles` itself without infinite recursion.
create or replace function public.app_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()),
    'client'::public.user_role
  );
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.app_role() = 'owner'::public.user_role;
$$;

-- The client row belonging to the signed-in user, if any.
create or replace function public.my_client_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.clients where profile_id = auth.uid();
$$;

-- ------------------------------------------------------------ enable RLS
alter table public.settings             enable row level security;
alter table public.profiles             enable row level security;
alter table public.staff                enable row level security;
alter table public.services             enable row level security;
alter table public.clients              enable row level security;
alter table public.appointments         enable row level security;
alter table public.appointment_services enable row level security;
alter table public.payments             enable row level security;
alter table public.availability_rules   enable row level security;
alter table public.time_off             enable row level security;

-- ------------------------------------------------------------- settings
create policy settings_read_all on public.settings
  for select to anon, authenticated using (true);
create policy settings_owner_write on public.settings
  for update to authenticated using (public.is_owner()) with check (public.is_owner());

-- -------------------------------------------------------------- profiles
create policy profiles_self_read on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_owner());
create policy profiles_self_update on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_owner_all on public.profiles
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- ----------------------------------------------------------------- staff
-- Public: the booking page lets a client pick a tech.
create policy staff_read_all on public.staff
  for select to anon, authenticated using (true);
create policy staff_owner_write on public.staff
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- -------------------------------------------------------------- services
create policy services_read_all on public.services
  for select to anon, authenticated using (true);
create policy services_owner_write on public.services
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- --------------------------------------------------------------- clients
create policy clients_owner_all on public.clients
  for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy clients_self_read on public.clients
  for select to authenticated using (profile_id = auth.uid());
create policy clients_self_update on public.clients
  for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ---------------------------------------------------------- appointments
create policy appointments_owner_all on public.appointments
  for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy appointments_self_read on public.appointments
  for select to authenticated using (client_id = public.my_client_id());
-- A client may only ever move their own appointment to `cancelled`.
-- Creating one goes through public.book_appointment(), never a direct insert.
create policy appointments_self_cancel on public.appointments
  for update to authenticated
  using (client_id = public.my_client_id())
  with check (client_id = public.my_client_id() and status = 'cancelled');

-- ------------------------------------------------- appointment_services
create policy appt_services_owner_all on public.appointment_services
  for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy appt_services_self_read on public.appointment_services
  for select to authenticated using (
    exists (
      select 1 from public.appointments a
      where a.id = appointment_id and a.client_id = public.my_client_id()
    )
  );

-- -------------------------------------------------------------- payments
-- Money is owner-only. Clients never read the payments table.
create policy payments_owner_all on public.payments
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- ----------------------------------------------------- availability rules
-- Working hours are public information; the booking page needs them.
create policy availability_read_all on public.availability_rules
  for select to anon, authenticated using (true);
create policy availability_owner_write on public.availability_rules
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- -------------------------------------------------------------- time off
-- Owner-only: the reason is private. The slot function is SECURITY DEFINER
-- so it still sees these rows when computing availability.
create policy time_off_owner_all on public.time_off
  for all to authenticated using (public.is_owner()) with check (public.is_owner());
