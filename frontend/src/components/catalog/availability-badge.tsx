import { Badge } from "@/components/ui/badge";
import { AVAILABILITY_LABELS } from "@/lib/catalog-copy";

const variantMap = {
  in_stock: "success",
  low_stock: "low",
  out_of_stock: "outofstock",
  coming_soon: "neutral",
} as const;

export function AvailabilityBadge({ value }: { value: string }) {
  const variant = variantMap[value as keyof typeof variantMap] ?? "neutral";
  return <Badge variant={variant}>{AVAILABILITY_LABELS[value] ?? value}</Badge>;
}
