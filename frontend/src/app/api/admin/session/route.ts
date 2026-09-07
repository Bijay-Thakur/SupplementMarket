import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json(
      { authenticated: false },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  return NextResponse.json(
    {
      authenticated: true,
      email: user.email,
      role: user.role,
      isDemo: false,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
