-- Fix the role guard.
--
-- The first version was SECURITY DEFINER, and inside a definer function
-- `current_user` is the function's owner (postgres) rather than the role that
-- actually made the request. The service-role bypass therefore matched every
-- caller and the guard never fired. Running as INVOKER makes `current_user`
-- the real request role ('authenticated', 'service_role', 'postgres').
-- is_owner() is itself SECURITY DEFINER, so it still reads profiles fine.

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
      raise exception 'Only the owner can change a role.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;
