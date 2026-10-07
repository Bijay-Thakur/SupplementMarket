"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PackagePlus } from "lucide-react";
import { requestJson } from "@/lib/requests/client";

export function AdminRequestNotifications() {
  const query = useQuery({
    queryKey: ["admin-request-count"],
    queryFn: () => requestJson<{ unread: number }>("/api/admin/supplement-requests?summary=1"),
    refetchInterval: 15_000,
    retry: false,
  });
  const count = query.data?.unread ?? 0;
  return <Link href="/admin/requests" className="inline-flex h-11 items-center gap-2 rounded-xl border border-[color:var(--border)] bg-white px-3 text-sm" aria-label={`Special requests${count ? `, ${count} new` : ""}`}>
    <PackagePlus className="h-4 w-4" aria-hidden /> Requests
    <span aria-live="polite">{query.isError ? "!" : count > 0 ? <span className="rounded-full bg-[color:var(--brand-magenta)] px-2 py-1 text-xs text-white">{count > 99 ? "99+" : count}</span> : null}</span>
  </Link>;
}
