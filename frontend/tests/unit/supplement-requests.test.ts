// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { supplementRequestSchema } from "@/lib/requests/schema";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), user: vi.fn(), requireAdmin: vi.fn(), client: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({ getAuthenticatedUser: mocks.user, requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: mocks.client }));
vi.mock("@/lib/env/server", () => ({ serverEnv: { supabaseServiceRoleKey: "test-only-not-a-secret" } }));
import { POST } from "@/app/api/supplement-requests/route";
import { GET, PATCH } from "@/app/api/admin/supplement-requests/route";
import { ApiHttpError } from "@/lib/demo-store/engine";

const payload = { request_key: "60e28bea-1410-4f29-a31b-ecbb112e8093", supplement_name: "Magnesium", customer_name: "Test Customer", email: "shopper@example.com", upc: "000123456789" };
const req = (body: unknown, origin = "https://store.example") => new NextRequest("https://store.example/api/supplement-requests", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => { vi.clearAllMocks(); mocks.user.mockResolvedValue(null); mocks.rpc.mockResolvedValue({ error: null }); });
describe("special requests", () => {
  it("accepts guests, preserves leading-zero UPCs, and never echoes private details", async () => {
    const response = await POST(req(payload));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.rpc).toHaveBeenCalledWith("submit_supplement_request", expect.objectContaining({ requester: null, payload: expect.objectContaining({ upc: "000123456789" }), client_fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/) }));
  });
  it("uses the verified user, not a caller-supplied owner", async () => {
    expect((await POST(req({ ...payload, user_id: "attacker-choice" }))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.user.mockResolvedValue({ id: "verified-user" });
    await POST(req(payload));
    expect(mocks.rpc).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ requester: "verified-user" }));
  });
  it("rejects cross-origin posts, overlong input and the honeypot", async () => {
    expect((await POST(req(payload, "https://evil.example"))).status).toBe(403);
    expect((await POST(req({ ...payload, notes: "x".repeat(13000) }))).status).toBe(413);
    expect((await POST(req({ ...payload, website: "spam" }))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("returns retryable failure and throttling instead of false success", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "request_rate_limit" } });
    expect((await POST(req(payload))).status).toBe(429);
    mocks.rpc.mockResolvedValue({ error: { message: "database unavailable" } });
    expect((await POST(req(payload))).status).toBe(503);
  });
  it("requires an administrator to read or update requests", async () => {
    mocks.requireAdmin.mockRejectedValue(new ApiHttpError(403, "Administrator access is required.", "forbidden"));
    expect((await GET(new NextRequest("https://store.example/api/admin/supplement-requests"))).status).toBe(403);
    expect((await PATCH(new NextRequest("https://store.example/api/admin/supplement-requests", { method: "PATCH", body: JSON.stringify({ id: payload.request_key, status: "completed" }) }))).status).toBe(403);
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("validates optional unknown product details without inventing values", () => {
    const result = supplementRequestSchema.parse(payload);
    expect(result.brand).toBe("");
    expect(supplementRequestSchema.safeParse({ ...payload, upc: "bad-code" }).success).toBe(false);
    expect(supplementRequestSchema.safeParse({ ...payload, status: "completed" }).success).toBe(false);
  });
});
