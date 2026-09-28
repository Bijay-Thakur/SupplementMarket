"use client";

import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { ActivityOverlay } from "./activity-overlay";

/**
 * Covers only explicitly opted-in foreground queries. Pages own their loading
 * skeletons, so ordinary reads never hide already-rendered navigation/content.
 */
export function GlobalActivity() {
  const initialFetches = useIsFetching({
    predicate: (query) =>
      query.state.fetchStatus === "fetching" &&
      query.state.data === undefined &&
      query.options.meta?.globalLoader === true,
  });
  const mutations = useIsMutating({
    predicate: (mutation) => mutation.options.meta?.globalLoader !== false,
  });

  return <ActivityOverlay visible={initialFetches + mutations > 0} label="Loading…" />;
}
