-- Administrator accounts are provisioned out-of-band in Supabase. Remove the
-- retired web bootstrap functions and any temporary Auth metadata they used.

drop function if exists public.mark_first_admin_pending(uuid);
drop function if exists public.finalize_first_admin(uuid);

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  - 'admin_setup_pending'
  - 'admin_bootstrapped_at'
where coalesce(raw_app_meta_data, '{}'::jsonb) ?| array[
  'admin_setup_pending',
  'admin_bootstrapped_at'
];
