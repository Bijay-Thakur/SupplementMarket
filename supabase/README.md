# Supabase

Committed schema lives in `migrations/`. Apply it with the Supabase CLI or SQL editor. Do not create tables only in the dashboard.

```bash
npx supabase db push
```

Or paste `migrations/20260902120000_init_commerce.sql` into the SQL editor.

Admin bootstrap (service role / SQL editor only):

```sql
insert into public.user_roles (user_id, role)
values ('<auth user uuid>', 'admin')
on conflict (user_id) do update set role = 'admin';
```

Never assign admin from localStorage, query parameters, Gmail domain, or the app UI.

Import the bundled demo catalog:

```bash
node scripts/import-catalog-to-supabase.mjs
```

Requires `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Repeat runs are idempotent and skip `verification_status = verified` rows.
