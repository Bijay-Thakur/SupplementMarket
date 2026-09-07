-- Mark the one pending first-administrator Auth user without depending on an
-- eventually-consistent Auth Admin HTTP update. Only the service role may call
-- this function; anonymous and authenticated browser roles are denied.

create or replace function public.mark_first_admin_pending(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  confirmed_at timestamptz;
begin
  perform pg_advisory_xact_lock(725946201135041);

  if exists (select 1 from public.user_roles where role = 'admin') then
    return false;
  end if;

  select email_confirmed_at into confirmed_at
  from auth.users
  where id = target_user_id
  for update;

  if not found or confirmed_at is not null then
    return false;
  end if;

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('admin_setup_pending', true)
  where id = target_user_id;

  return true;
end;
$$;

revoke all on function public.mark_first_admin_pending(uuid) from public, anon, authenticated;
grant execute on function public.mark_first_admin_pending(uuid) to service_role;
