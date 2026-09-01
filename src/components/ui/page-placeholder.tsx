import { Container } from "@/components/ui/container";

/**
 * Branded placeholder for routes whose full implementation lands in a later
 * phase. Keeps navigation functional and communicates status honestly rather
 * than showing a broken or empty page.
 */
export function PagePlaceholder({
  title,
  description,
  phase,
}: {
  title: string;
  description?: string;
  phase?: string;
}) {
  return (
    <Container className="py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-display text-3xl font-semibold text-[color:var(--brand-ink)]">
          {title}
        </h1>
        {description && (
          <p className="mt-4 text-[color:var(--muted)]">{description}</p>
        )}
        {phase && (
          <p className="mt-6 inline-block rounded-full bg-[color:var(--brand-cream)] px-4 py-1 text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">
            Implemented in {phase}
          </p>
        )}
      </div>
    </Container>
  );
}
