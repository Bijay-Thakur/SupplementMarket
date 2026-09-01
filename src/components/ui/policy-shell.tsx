import { Container } from "@/components/ui/container";

/**
 * Shell for legal/policy pages. Real copy must be owner/legal-approved and is
 * managed as structured content later. In non-production we surface a visible
 * "draft placeholder" banner so unpublished policies are never mistaken for
 * approved text.
 */
export function PolicyShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const isProduction = process.env.NODE_ENV === "production";
  return (
    <Container className="py-16">
      <article className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl font-semibold text-[color:var(--brand-ink)]">
          {title}
        </h1>
        {!isProduction && (
          <div className="mt-3 rounded-[--radius] border border-dashed border-[color:var(--brand-gold)] bg-[color:var(--brand-cream)] px-4 py-3 text-sm text-[color:var(--muted)]">
            Draft placeholder — this policy has not been reviewed or approved by
            the owner/legal and must not be treated as final.
          </div>
        )}
        <div className="prose mt-6 max-w-none text-[color:var(--muted)]">
          {children}
        </div>
      </article>
    </Container>
  );
}
