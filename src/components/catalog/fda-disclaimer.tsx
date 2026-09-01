export function FdaDisclaimer({ className }: { className?: string }) {
  return (
    <p className={className ?? "text-xs text-[color:var(--muted)]"}>
      These statements have not been evaluated by the Food and Drug
      Administration. Products are not intended to diagnose, treat, cure, or
      prevent any disease.
    </p>
  );
}
