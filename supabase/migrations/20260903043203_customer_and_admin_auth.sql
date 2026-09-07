-- =========================================================
-- Customer and administrator authorization foundation
-- Passwords remain exclusively inside Supabase auth.users.
-- =========================================================

do $$
begin
  create type public.app_role as enum ('customer', 'admin');
exception
  when duplicate_object then null;
end
$$;

-- Public application profile.
-- This table must never contain a password or password hash.
create table public.profiles (
  id uuid primary key
    references auth.users(id) on delete cascade,

  email text not null,
  username text,
  full_name text,
  phone text,
  avatar_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_username_ci_unique
  on public.profiles(lower(username))
  where username is not null;

-- Role is deliberately separate from profiles.
-- Customers must not be able to change this value.
create table public.user_roles (
  user_id uuid primary key
    references auth.users(id) on delete cascade,

  role public.app_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- Automatically create a customer profile after signup.
-- ---------------------------------------------------------

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
  );

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
execute function public.handle_new_auth_user();

-- Keep the duplicated profile email synchronized.
create or replace function public.handle_auth_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set
    email = new.email,
    updated_at = now()
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;

create trigger on_auth_user_email_changed
after update of email on auth.users
for each row
when (old.email is distinct from new.email)
execute function public.handle_auth_email_change();

-- ---------------------------------------------------------
-- Secure administrator-role check used by RLS.
-- ---------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------
-- Updated-at triggers
-- ---------------------------------------------------------

create or replace function public.set_auth_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_auth_updated_at();

create trigger user_roles_set_updated_at
before update on public.user_roles
for each row
execute function public.set_auth_updated_at();

-- ---------------------------------------------------------
-- Permissions and RLS
-- ---------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

revoke all on public.profiles from anon, authenticated;
revoke all on public.user_roles from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (
  username,
  full_name,
  phone,
  avatar_url,
  updated_at
) on public.profiles to authenticated;

grant select on public.user_roles to authenticated;

-- Users can view their own profile. Admins can view all.
create policy "Users read own profile and admins read all"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or (select public.is_admin())
);

-- Users may update only their own profile.
-- Column grants prevent them from changing id or email.
create policy "Users update own profile"
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- Users can inspect their role; admins can inspect all roles.
create policy "Users read own role and admins read all"
on public.user_roles
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select public.is_admin())
);

-- There are intentionally no INSERT, UPDATE, or DELETE
-- policies for user_roles.