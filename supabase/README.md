# Supabase

Committed schema lives in `migrations/`. Apply it in order with the Supabase
CLI. Do not create tables only in the dashboard or paste only one migration,
because later migrations contain required authentication hardening.

```bash
npx supabase db push
```

## Customer authentication

Customers register at `/auth/sign-up`. Supabase Auth stores the email and
password. The database trigger intentionally waits for `email_confirmed_at`
before creating `public.profiles` and the fixed `customer` role in
`public.user_roles`.

In Supabase Dashboard:

1. Open **Authentication > Providers > Email**. Keep Email enabled and
   **Confirm email** enabled.
2. Open **Authentication > URL Configuration**. For local development, set
   Site URL to `http://localhost:3000` and add
   `http://localhost:3000/auth/callback` to Redirect URLs.
3. Open **Authentication > Email Templates > Confirm signup**. Make the
   confirmation button/link use this exact target:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">
  Confirm your email
</a>
```

For production, set `NEXT_PUBLIC_SITE_URL` to the HTTPS production origin and
add its exact `/auth/callback` URL to the Supabase Redirect URLs list. Configure
custom SMTP before launch so confirmation mail is sent from the store's domain.
Supabase's built-in sender is intended only for testing, is limited to two auth
emails per hour, and can restrict delivery to members of the Supabase project.

Do not store customer or administrator passwords in `public.profiles`,
`public.user_roles`, application environment variables, or application logs.

## Administrator provisioning

Administrators do not register through the website. Create the password-backed
user in Supabase Authentication > Users, confirm the email, then run this in
the SQL editor with the final profile values:

```sql
do $$
declare
  admin_id uuid;
begin
  select id into admin_id
  from auth.users
  where lower(email) = lower('owner@example.com');

  if admin_id is null then
    raise exception 'Create and confirm the Auth user first.';
  end if;

  insert into public.profiles (id, email, username, full_name, phone)
  values (admin_id, 'owner@example.com', 'owner', 'Store Owner', '+1 914 555 0100')
  on conflict (id) do update set
    email = excluded.email,
    username = excluded.username,
    full_name = excluded.full_name,
    phone = excluded.phone,
    updated_at = now();

  insert into public.user_roles (user_id, role)
  values (admin_id, 'admin')
  on conflict (user_id) do update set role = 'admin', updated_at = now();
end
$$;
```

Never assign admin from localStorage, query parameters, Gmail domain, or the app UI.

Import the bundled demo catalog:

```bash
node scripts/import-catalog-to-supabase.mjs
```

Requires `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Repeat runs are idempotent and skip `verification_status = verified` rows.
