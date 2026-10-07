import { FulfillmentPolicy } from "@/components/store/fulfillment-policy";
import { pageMetadata } from "@/lib/seo/site";

export const metadata = pageMetadata(
  "Store Pickup & Local Delivery",
  "Pick up orders at 86 Pondfield Rd in Bronxville or ask about local delivery.",
  "/shipping-pickup",
);

export default function ShippingPickupPage() {
  return <FulfillmentPolicy />;
}
