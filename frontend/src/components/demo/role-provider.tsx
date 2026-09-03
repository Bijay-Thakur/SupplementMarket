"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import type { DemoRole } from "@/lib/demo-role";
import {
  DEMO_ROLE_STORAGE_KEY,
  clearDemoRole,
  readDemoRole,
  writeDemoRole,
} from "@/lib/demo-role";

type RoleContextValue = {
  role: DemoRole | null;
  ready: boolean;
  setRole: (role: DemoRole) => void;
  switchRole: () => void;
};

const RoleContext = createContext<RoleContextValue | null>(null);

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): DemoRole | null {
  return readDemoRole();
}

const SERVER_ROLE: DemoRole | null = null;

function getServerSnapshot(): DemoRole | null {
  return SERVER_ROLE;
}

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const role = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setRole = useCallback((next: DemoRole) => {
    writeDemoRole(next);
    emit();
  }, []);

  const switchRole = useCallback(() => {
    clearDemoRole();
    emit();
  }, []);

  const value = useMemo(
    () => ({ role, ready: true, setRole, switchRole }),
    [role, setRole, switchRole],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useDemoRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useDemoRole must be used within RoleProvider");
  return ctx;
}

export { DEMO_ROLE_STORAGE_KEY };
