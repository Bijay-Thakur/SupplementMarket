-- First-administrator activation. The web app may mark an unconfirmed Auth
-- user in app_metadata, but only this service-role-only transaction can grant
-- the first administrator role after email confirmation.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is null then
    return new;
  end if;

  begin
    insert into public.profiles (id, email, username, full_name, phone, avatar_url)
    values (
      new.id,
      new.email,
      nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'avatar_url'), '')
    )
    on conflict (id) do update set
      email = excluded.email,
      full_name = coalesce(excluded.full_name, public.profiles.full_name),
      phone = coalesce(excluded.phone, public.profiles.phone),
      avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
      updated_at = now();
  exception
    when unique_violation then
      insert into public.profiles (id, email, username, full_name, phone, avatar_url)
      values (
        new.id,
        new.email,
        null,
        nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'avatar_url'), '')
      )
      on conflict (id) do update set
        email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        phone = coalesce(excluded.phone, public.profiles.phone),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
        updated_at = now();
  end;

  insert into public.user_roles (user_id, role)
  values (new.id, 'customer')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create or replace function public.finalize_first_admin(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target auth.users%rowtype;
begin
  perform pg_advisory_xact_lock(725946201135041);

  select * into target
  from auth.users
  where id = target_user_id
  for update;

  if not found
    or target.email_confirmed_at is null
    or coalesce(target.raw_app_meta_data ->> 'admin_setup_pending', 'false') <> 'true'
  then
    return false;
  end if;

  if exists (select 1 from public.user_roles where role = 'admin') then
    return false;
  end if;

  insert into public.profiles (id, email, username, full_name, phone, avatar_url)
  values (
    target.id,
    target.email,
    nullif(trim(target.raw_user_meta_data ->> 'username'), ''),
    nullif(trim(target.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(target.raw_user_meta_data ->> 'phone'), ''),
    nullif(trim(target.raw_user_meta_data ->> 'avatar_url'), '')
  )
  on conflict (id) do update set
    email = excluded.email,
    username = coalesce(excluded.username, public.profiles.username),
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    phone = coalesce(excluded.phone, public.profiles.phone),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();

  insert into public.user_roles (user_id, role)
  values (target.id, 'admin')
  on conflict (user_id) do update set role = 'admin', updated_at = now();

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('admin_setup_pending', false, 'admin_bootstrapped_at', now())
  where id = target.id;

  return true;
end;
$$;

revoke all on function public.finalize_first_admin(uuid) from public, anon, authenticated;
grant execute on function public.finalize_first_admin(uuid) to service_role;
