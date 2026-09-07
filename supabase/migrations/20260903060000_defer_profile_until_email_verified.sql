-- Do not create public.profiles or public.user_roles until the email
-- confirmation link has been verified. Unconfirmed auth.users rows remain
-- only in Supabase Auth.

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
    insert into public.profiles (
      id,
      email,
      username,
      full_name,
      avatar_url
    )
    values (
      new.id,
      new.email,
      nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'avatar_url'), '')
    )
    on conflict (id) do nothing;
  exception
    when unique_violation then
      insert into public.profiles (id, email, username, full_name, avatar_url)
      values (
        new.id,
        new.email,
        null,
        nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'avatar_url'), '')
      )
      on conflict (id) do nothing;
  end;

  insert into public.user_roles (user_id, role)
  values (new.id, 'customer')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
when (new.email_confirmed_at is not null)
execute function public.handle_new_auth_user();

drop trigger if exists on_auth_user_email_confirmed on auth.users;

create trigger on_auth_user_email_confirmed
after update of email_confirmed_at on auth.users
for each row
when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
execute function public.handle_new_auth_user();
