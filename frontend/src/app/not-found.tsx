import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="font-display text-6xl font-semibold text-[color:var(--brand-magenta)]">
        404
      </p>
      <h1 className="mt-2 font-display text-2xl font-semibold text-[color:var(--brand-ink)]">
        Page not found
      </h1>
      <p className="mt-3 max-w-md text-[color:var(--muted)]">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <Link
        href="/"
        className={`${buttonVariants({ variant: "primary" })} mt-6`}
      >
        Back to home
      </Link>
    </div>
  );
}
