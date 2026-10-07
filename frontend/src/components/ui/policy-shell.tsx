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
  published = false,
}: {
  title: string;
  children: React.ReactNode;
  published?: boolean;
}) {
  const showDraft = !published && process.env.NODE_ENV !== "production";
  return (
    <Container className="py-12 sm:py-16">
      <article className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl font-semibold text-[color:var(--brand-ink)]">
          {title}
        </h1>
        {showDraft && (
          <div className="mt-3 rounded-[--radius] border border-dashed border-[color:var(--brand-gold)] bg-[color:var(--brand-cream)] px-4 py-3 text-sm text-[color:var(--brand-ink)]">
            Draft placeholder — this policy has not been reviewed or approved by
            the owner/legal and must not be treated as final.
          </div>
        )}
        <div className="mt-6 space-y-4 text-base leading-relaxed text-[color:var(--brand-ink)] [&_a]:font-medium [&_a]:text-[color:var(--brand-magenta-strong)] [&_a]:underline [&_h2]:pt-2 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-2">
          {children}
        </div>
      </article>
    </Container>
  );
}
