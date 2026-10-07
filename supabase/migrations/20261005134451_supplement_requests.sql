-- Guest submissions are accepted only through the validated server endpoint.
create table public.supplement_requests (
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null unique,
  user_id uuid references auth.users(id) on delete set null,
  supplement_name text not null check (length(supplement_name) between 2 and 200),
  brand text not null default '' check (length(brand) <= 120),
  upc text not null default '' check (upc ~ '^(\d{8}|\d{12,14})?$'),
  size text not null default '' check (length(size) <= 100),
  strength text not null default '' check (length(strength) <= 100),
  form text not null default '' check (length(form) <= 100),
  customer_name text not null check (length(customer_name) between 2 and 120),
  email text not null check (length(email) between 3 and 254),
  phone text not null default '' check (length(phone) <= 32),
  notes text not null default '' check (length(notes) <= 1000),
  client_hash text not null,
  status text not null default 'new' check (status in ('new','reviewing','ordered','unavailable','completed')),
  created_at timestamptz not null default now()
);
alter table public.supplement_requests enable row level security;
revoke all on public.supplement_requests from anon, authenticated;
grant select, update on public.supplement_requests to authenticated;
grant all on public.supplement_requests to service_role;
create policy "Admins read supplement requests" on public.supplement_requests
  for select to authenticated using ((select public.is_admin()));
create policy "Admins update supplement requests" on public.supplement_requests
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create index supplement_requests_status_created_idx on public.supplement_requests(status, created_at desc);
create index supplement_requests_email_created_idx on public.supplement_requests(email, created_at desc);
create index supplement_requests_client_created_idx on public.supplement_requests(client_hash, created_at desc);
create index supplement_requests_user_idx on public.supplement_requests(user_id);

-- Atomic throttling and idempotency, including across multiple web instances.
-- SECURITY INVOKER and service-role-only EXECUTE: no public bypass of validation.
create function public.submit_supplement_request(payload jsonb, requester uuid, client_fingerprint text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare existing_id uuid; new_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('request-key:' || (payload->>'request_key'), 0));
  select id into existing_id from public.supplement_requests where request_key = (payload->>'request_key')::uuid;
  if existing_id is not null then return existing_id; end if;
  perform pg_advisory_xact_lock(hashtextextended('request-client:' || client_fingerprint, 0));
  perform pg_advisory_xact_lock(hashtextextended('request-email:' || lower(payload->>'email'), 0));
  if (select count(*) from public.supplement_requests where email = lower(payload->>'email') and created_at > now() - interval '1 hour') >= 5
     or (select count(*) from public.supplement_requests where client_hash = client_fingerprint and created_at > now() - interval '1 hour') >= 15 then
    raise exception 'request_rate_limit' using errcode = 'P0001';
  end if;
  insert into public.supplement_requests(request_key, user_id, supplement_name, brand, upc, size, strength, form, customer_name, email, phone, notes, client_hash)
  values ((payload->>'request_key')::uuid, requester, payload->>'supplement_name', payload->>'brand', payload->>'upc', payload->>'size', payload->>'strength', payload->>'form', payload->>'customer_name', lower(payload->>'email'), payload->>'phone', payload->>'notes', client_fingerprint)
  returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.submit_supplement_request(jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.submit_supplement_request(jsonb, uuid, text) to service_role;
