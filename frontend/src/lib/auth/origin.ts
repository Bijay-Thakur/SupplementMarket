import { NextRequest } from "next/server";
import { publicEnv } from "@/lib/env/public";

/** Reject cross-site POST/PATCH/DELETE from an unexpected Origin. */
export function assertSameOrigin(req: NextRequest): void {
  const origin = req.headers.get("origin");
  if (!origin) return;
  if (origin !== new URL(publicEnv.siteUrl).origin) {
    throw new Error("origin");
  }
}
