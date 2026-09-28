import Link from "next/link";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  afterEach(() => vi.useRealTimers());

  it("lets pages show their own skeletons for normal queries", () => {
    renderPending();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("still supports explicitly blocking foreground queries", () => {
    renderPending(true);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows a delayed loader for a cold internal navigation without delaying the click", async () => {
    vi.useFakeTimers();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <GlobalActivity />
        <Link href="/brands" onClick={(event) => event.preventDefault()}>Brands</Link>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Brands" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(140));
    expect(screen.getByRole("status")).toHaveTextContent("Opening page");

    await act(async () => {
      window.history.pushState({}, "", "/brands");
      await Promise.resolve();
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
