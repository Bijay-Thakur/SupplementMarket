"use client";

import { clearEntryMode } from "@/lib/entry-mode";

export function SignOutForm({
  next = "/",
  className,
  children = "Sign Out",
}: {
  next?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <form
      action="/api/auth/sign-out"
      method="post"
      onSubmit={() => {
        clearEntryMode();
      }}
    >
      <input type="hidden" name="next" value={next} />
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  );
}
