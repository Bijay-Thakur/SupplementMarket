"use client";

import { useEffect, useRef, useState } from "react";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { ActivityOverlay } from "./activity-overlay";

const NAVIGATION_LOADER_DELAY_MS = 140;
const NAVIGATION_LOADER_TIMEOUT_MS = 15_000;

function isPlainInternalNavigation(event: MouseEvent) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return false;
  }
  const anchor = (event.target as Element | null)?.closest("a[href]") as HTMLAnchorElement | null;
  if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return false;
  const destination = new URL(anchor.href, window.location.href);
  if (destination.origin !== window.location.origin) return false;
  return `${destination.pathname}${destination.search}` !== `${window.location.pathname}${window.location.search}`;
}

/**
 * Shows feedback only when a client navigation lasts long enough to be noticed.
 * It watches the existing navigation; it never blocks or adds a minimum delay.
 */
function useNavigationActivity() {
  const [visible, setVisible] = useState(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearTimers = () => {
      if (showTimer.current) clearTimeout(showTimer.current);
      if (safetyTimer.current) clearTimeout(safetyTimer.current);
      showTimer.current = null;
      safetyTimer.current = null;
    };
    const finish = () => {
      clearTimers();
      setVisible(false);
    };
    const finishAfterRouterCommit = () => queueMicrotask(finish);
    const begin = (event: MouseEvent) => {
      if (!isPlainInternalNavigation(event)) return;
      clearTimers();
      showTimer.current = setTimeout(() => setVisible(true), NAVIGATION_LOADER_DELAY_MS);
      safetyTimer.current = setTimeout(finish, NAVIGATION_LOADER_TIMEOUT_MS);
    };

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;
    window.history.pushState = function (...args) {
      originalPushState.apply(this, args);
      finishAfterRouterCommit();
    };
    window.history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      finishAfterRouterCommit();
    };

    document.addEventListener("click", begin, true);
    window.addEventListener("pagehide", finish);
    return () => {
      clearTimers();
      document.removeEventListener("click", begin, true);
      window.removeEventListener("pagehide", finish);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []);

  return visible;
}

/**
 * Ordinary page reads keep their local skeletons. The overlay is reserved for
 * slow client navigations, mutations, and explicitly opted-in foreground reads.
 */
export function GlobalActivity() {
  const navigation = useNavigationActivity();
  const initialFetches = useIsFetching({
    predicate: (query) =>
      query.state.fetchStatus === "fetching" &&
      query.state.data === undefined &&
      query.options.meta?.globalLoader === true,
  });
  const mutations = useIsMutating({
    predicate: (mutation) => mutation.options.meta?.globalLoader !== false,
  });

  return (
    <ActivityOverlay
      visible={navigation || initialFetches + mutations > 0}
      label={navigation ? "Opening page…" : "Loading…"}
    />
  );
}
