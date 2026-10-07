// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ reset: vi.fn(), update: vi.fn(), signOut: vi.fn(), user: vi.fn(), verifyOtp: vi.fn(), exchange: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => null }));
vi.mock("@/lib/auth/server", () => ({ getAuthenticatedUser: mocks.user }));
vi.mock("@/lib/env/public", () => ({ publicEnv: { siteUrl: "https://store.example", supabaseUrl: "https://test.supabase.co", supabasePublishableKey: "test-key" }, supabasePublicConfigured: true }));
vi.mock("@/lib/supabase/route", async () => {
  const { NextResponse } = await import("next/server");
  return { createCookieRecordingClient: () => ({ pending: [], supabase: { auth: { resetPasswordForEmail: mocks.reset, updateUser: mocks.update, signOut: mocks.signOut } } }), jsonWithAuthCookies: (body: unknown, _pending: unknown, status: number) => NextResponse.json(body, { status }) };
});
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { verifyOtp: mocks.verifyOtp, exchangeCodeForSession: mocks.exchange } }) }));
import { POST } from "@/app/api/auth/route";
import { GET } from "@/app/(auth)/auth/callback/route";
const request = (action: string, body: unknown) => new NextRequest(`https://store.example/api/auth?action=${action}`, { method: "POST", headers: { origin: "https://store.example" }, body: JSON.stringify(body) });

beforeEach(() => { vi.clearAllMocks(); mocks.reset.mockResolvedValue({ error: null }); mocks.update.mockResolvedValue({ error: null }); mocks.user.mockResolvedValue({ id: "user" }); mocks.verifyOtp.mockResolvedValue({ error: null }); mocks.exchange.mockResolvedValue({ error: null }); });
describe("password recovery", () => {
  it("sends the recovery redirect and gives a non-enumerating response", async () => {
    const response = await POST(request("forgot-password", { email: "TEST@example.com" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toHaveProperty("message");
    expect(mocks.reset).toHaveBeenCalledWith("test@example.com", { redirectTo: "https://store.example/auth/callback?next=%2Fauth%2Freset-password" });
  });
  it("does not claim an email was sent when delivery fails", async () => {
    mocks.reset.mockResolvedValue({ error: { status: 500, message: "private backend detail" } });
    const response = await POST(request("forgot-password", { email: "test@example.com" }));
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("private backend detail");
  });
  it("requires a valid session and matching strong passwords", async () => {
    mocks.user.mockResolvedValue(null);
    expect((await POST(request("update-password", { password: "SecurePassword123", confirmPassword: "SecurePassword123" }))).status).toBe(401);
    expect((await POST(request("update-password", { password: "short", confirmPassword: "other" }))).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("revokes refresh sessions after a successful password update", async () => {
    expect((await POST(request("update-password", { password: "SecurePassword123", confirmPassword: "SecurePassword123" }))).status).toBe(200);
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "global" });
  });
  it("accepts token-hash recovery and forces the password-reset destination", async () => {
    const response = await GET(new NextRequest("https://store.example/auth/callback?token_hash=test-token&type=recovery&next=https://evil.example"));
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: "test-token", type: "recovery" });
    expect(response.headers.get("location")).toBe("https://store.example/auth/reset-password");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
  it("accepts PKCE recovery and rejects expired tokens", async () => {
    const response = await GET(new NextRequest("https://store.example/auth/callback?code=test-code&next=%2Fauth%2Freset-password"));
    expect(mocks.exchange).toHaveBeenCalledWith("test-code");
    expect(response.headers.get("location")).toBe("https://store.example/auth/reset-password");
    mocks.verifyOtp.mockResolvedValue({ error: { message: "expired" } });
    expect((await GET(new NextRequest("https://store.example/auth/callback?token_hash=expired&type=recovery"))).headers.get("location")).toContain("/auth/error?reason=expired");
  });
});
