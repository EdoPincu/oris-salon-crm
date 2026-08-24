-- Close a privilege-escalation hole.
--
-- `profiles_self_update` let a signed-in user update their own profile row so
-- they could fix their name or phone. RLS has no column granularity, so that
-- also let them set `role = 'owner'` on themselves — which would hand any
-- client the whole admin app: every client record, every appointment, all
-- revenue. A BEFORE UPDATE trigger is the fix, because it can see both the old
-- and the new value and judge who is asking.

create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    -- Migrations, and the promote-owner bootstrap script, connect as one of
    -- these roles and are allowed through.
    if current_user in ('service_role', 'postgres', 'supabase_admin') then
      return new;
    end if;

    if not public.is_owner() then
      raise exception 'Only the owner can change a role.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();
