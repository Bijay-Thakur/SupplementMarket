import { mediaUrl } from "@/lib/api/client";

/** Neutral supplement placeholder when no licensed image exists. */
export function ProductThumb({
  src,
  alt,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const url = mediaUrl(src);
  if (!url) {
    return (
      <div
        className={className}
        style={{
          background:
            "linear-gradient(160deg, #fff9f1 0%, #f3ead8 100%)",
        }}
        aria-hidden={!alt}
        role="img"
        aria-label={alt}
      >
        <svg viewBox="0 0 80 80" className="h-full w-full p-4 text-[color:var(--brand-green)]/40">
          <rect x="28" y="12" width="24" height="8" rx="2" fill="currentColor" />
          <rect x="24" y="20" width="32" height="48" rx="6" fill="currentColor" opacity="0.35" />
        </svg>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} className={className} />
  );
}
