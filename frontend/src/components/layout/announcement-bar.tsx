"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

/**
 * Dismissible announcement bar. In Phase 5 the message/schedule/enabled state
 * come from `store_settings`; here it accepts props and remembers dismissal in
 * sessionStorage. Renders nothing when no message is provided.
 */
export function AnnouncementBar({
  message,
  id = "default",
}: {
  message?: string | null;
  id?: string;
}) {
  const [dismissed, setDismissed] = useState(true);
  const storageKey = `bnm-announcement-dismissed:${id}`;

  useEffect(() => {
    // Read persisted dismissal on mount. sessionStorage is unavailable during
    // SSR, so this must run in an effect; the initial `true` avoids a flash.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(sessionStorage.getItem(storageKey) === "1");
  }, [storageKey]);

  if (!message || dismissed) return null;

  return (
    <div
      role="region"
      aria-label="Store announcement"
      className="bg-[color:var(--brand-green)] text-white"
    >
      <div className="mx-auto flex max-w-7xl items-start justify-center gap-3 px-4 py-2 text-center text-sm sm:items-center">
        <p className="min-w-0 flex-1 text-pretty font-medium leading-snug">{message}</p>
        <button
          type="button"
          onClick={() => {
            sessionStorage.setItem(storageKey, "1");
            setDismissed(true);
          }}
          className="rounded-full p-1 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          aria-label="Dismiss announcement"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
