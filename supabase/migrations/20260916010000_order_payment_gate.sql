-- Fulfillment cannot reach a shipped/delivered/completed state while unpaid
-- unless an administrator has explicitly recorded a payment-requirement bypass.

alter table public.orders
  add column if not exists payment_requirement_bypassed boolean not null default false,
  add column if not exists payment_bypassed_at timestamptz,
  add column if not exists payment_bypassed_by uuid references auth.users(id) on delete set null,
  add column if not exists payment_bypass_reason text;

-- Preserve any legacy order that had already advanced before this invariant
-- existed, while making that exception visible instead of silently invalid.
update public.orders
set
  payment_requirement_bypassed = true,
  payment_bypassed_at = coalesce(updated_at, now()),
  payment_bypass_reason = coalesce(
    payment_bypass_reason,
    'Legacy order was already fulfilled before the payment gate was enabled.'
  )
where payment_status <> 'paid'
  and status in ('shipped', 'out_for_delivery', 'delivered', 'completed')
  and payment_requirement_bypassed = false;

alter table public.orders
  drop constraint if exists orders_payment_before_fulfillment_check;
alter table public.orders
  add constraint orders_payment_before_fulfillment_check check (
    payment_status = 'paid'
    or status not in ('shipped', 'out_for_delivery', 'delivered', 'completed')
    or payment_requirement_bypassed = true
  );

comment on column public.orders.payment_requirement_bypassed is
  'True only when an administrator explicitly permits fulfillment before payment.';
comment on column public.orders.payment_bypassed_by is
  'Administrator who explicitly permitted fulfillment before payment.';

notify pgrst, 'reload schema';
