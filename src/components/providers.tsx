"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { RoleProvider } from "@/components/demo/role-provider";
import { RoleChooser } from "@/components/demo/role-chooser";
import { DemoModeBar } from "@/components/demo/demo-mode-bar";
import { CartProvider } from "@/components/cart/cart-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <RoleProvider>
        <CartProvider>
          <DemoModeBar />
          <RoleChooser />
          {children}
        </CartProvider>
      </RoleProvider>
    </QueryClientProvider>
  );
}
