import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { GlobalActivity } from "@/components/ui/global-activity";

function PendingQuery({ globalLoader }: { globalLoader?: boolean }) {
  useQuery({
    queryKey: ["pending", globalLoader ?? "default"],
    queryFn: () => new Promise<never>(() => undefined),
    meta: globalLoader === undefined ? undefined : { globalLoader },
  });
  return null;
}

function renderPending(globalLoader?: boolean) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PendingQuery globalLoader={globalLoader} />
      <GlobalActivity />
    </QueryClientProvider>,
  );
}

describe("global activity overlay", () => {
  it("lets pages show their own skeletons for normal queries", () => {
    renderPending();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("still supports explicitly blocking foreground queries", () => {
    renderPending(true);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
