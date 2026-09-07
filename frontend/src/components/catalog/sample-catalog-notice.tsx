import { SAMPLE_CATALOG_NOTICE } from "@/lib/catalog/sample-notice";

export function SampleCatalogNotice({ className }: { className?: string }) {
  return (
    <p className={className ?? "mt-2 max-w-2xl text-xs text-[color:var(--muted)]"}>
      {SAMPLE_CATALOG_NOTICE}
    </p>
  );
}
