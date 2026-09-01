"use client";

import { useQuery } from "@tanstack/react-query";
import { getStoreSettings } from "@/lib/api/catalog";
import { AnnouncementBar } from "./announcement-bar";

export function StoreAnnouncement() {
  const q = useQuery({ queryKey: ["store-settings"], queryFn: getStoreSettings });
  return <AnnouncementBar id="launch" message={q.data?.announcement ?? null} />;
}
