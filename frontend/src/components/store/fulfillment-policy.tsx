"use client";

import { useQuery } from "@tanstack/react-query";
import { getStoreSettings } from "@/lib/api/catalog";
import { PolicyShell } from "@/components/ui/policy-shell";

export function FulfillmentPolicy() {
  const q = useQuery({ queryKey: ["store-settings"], queryFn: getStoreSettings });
  const s = q.data;
  return (
    <PolicyShell title="Store Pickup & Local Delivery">
      <p>
        Order online, then pick up at Bronxville Natural Market, 86 Pondfield Rd,
        or request local delivery. The store confirms timing, fees, and ZIP
        eligibility.
      </p>
      {s?.pickup_instructions && (
        <p className="mt-4">
          <strong>Pickup. </strong>
          {s.pickup_instructions}
        </p>
      )}
      {s?.delivery_note && (
        <p className="mt-4">
          <strong>Delivery. </strong>
          {s.delivery_note}
        </p>
      )}
      <p className="mt-4 text-sm">
        Online card payment is not enabled in this demonstration. Submitting checkout
        sends an order request only.
      </p>
    </PolicyShell>
  );
}
