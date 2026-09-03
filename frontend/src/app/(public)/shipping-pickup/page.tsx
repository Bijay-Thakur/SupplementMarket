import type { Metadata } from "next";
import { FulfillmentPolicy } from "@/components/store/fulfillment-policy";

export const metadata: Metadata = { title: "Store Pickup & Local Delivery" };

export default function ShippingPickupPage() {
  return <FulfillmentPolicy />;
}
