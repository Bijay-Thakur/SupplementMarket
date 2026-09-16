"use client";

import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { ActivityOverlay } from "./activity-overlay";

/** Covers foreground React Query work without flashing during background polling. */
export function GlobalActivity() {
  const initialFetches = useIsFetching({
    predicate: (query) =>
      query.state.fetchStatus === "fetching" &&
      query.state.data === undefined &&
      query.options.meta?.globalLoader !== false,
  });
  const mutations = useIsMutating({
    predicate: (mutation) => mutation.options.meta?.globalLoader !== false,
  });

  return <ActivityOverlay visible={initialFetches + mutations > 0} label="Loading…" />;
}
