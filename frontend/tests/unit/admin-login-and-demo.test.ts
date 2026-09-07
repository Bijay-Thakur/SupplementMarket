import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { resolvePasswordSignIn } from "@/lib/auth/password-sign-in";
import { ADMIN_FORBIDDEN_MESSAGE, AUTH_GENERIC_ERROR } from "@/lib/auth/types";
import { SAMPLE_CATALOG_NOTICE } from "@/lib/catalog/sample-notice";
import { ENTRY_MODE_STORAGE_KEY, readEntryMode, writeEntryMode, clearEntryMode } from "@/lib/entry-mode";
import { createOrder, resetDemoStore } from "@/lib/demo-store/engine";
import { safeNextPath } from "@/lib/auth/schemas";

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "coverage") continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx|js|jsx)$/.test(name)) acc.push(full);
  }
  return acc;
}

function mockSupabase(opts: {
  signIn?: { data: { user: { id: string } | null }; error: { message: string } | null };
  claimsSub?: string | null;
  role?: "admin" | "customer" | null;
}) {
  const signOut = vi.fn();
  return {
    auth: {
      signInWithPassword: vi.fn(async () => opts.signIn ?? { data: { user: { id: "u1" } }, error: null }),
      getClaims: vi.fn(async () => ({
        data: opts.claimsSub === null ? { claims: {} } : { claims: { sub: opts.claimsSub ?? "u1" } },
        error: null,
      })),
      getUser: vi.fn(async () => ({ data: { user: { id: "u1" } } })),
      signOut,
    },
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: opts.role ? { role: opts.role } : null,
          }),
        }),
      }),
    })),
    signOut,
  };
}

describe("first-attempt administrator login", () => {
  it("authenticates, reads role on the same client, and returns /admin without a second request", async () => {
    const supabase = mockSupabase({ role: "admin" });
    const result = await resolvePasswordSignIn({
      supabase: supabase as never,
      email: "owner@example.com",
      password: "validpass1",
      portal: "admin",
    });
    expect(result).toEqual({ redirectTo: "/admin", userId: "u1", role: "admin" });
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledTimes(1);
    expect(supabase.from).toHaveBeenCalledWith("user_roles");
    expect(supabase.auth.signOut).not.toHaveBeenCalled();

    const homeAttempt = await resolvePasswordSignIn({
      supabase: mockSupabase({ role: "admin" }) as never,
      email: "owner@example.com",
      password: "validpass1",
      portal: "admin",
      next: "/",
    });
    expect(homeAttempt).toEqual({ redirectTo: "/admin", userId: "u1", role: "admin" });
  });

  it("rejects invalid credentials with a generic error and does not look up roles by email", async () => {
    const supabase = mockSupabase({
      signIn: { data: { user: null }, error: { message: "Invalid login credentials" } },
    });
    const result = await resolvePasswordSignIn({
      supabase: supabase as never,
      email: "nobody@example.com",
      password: "wrong",
      portal: "admin",
    });
    expect(result).toEqual({ error: AUTH_GENERIC_ERROR });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("denies customers on the administrator portal and signs them out of that flow", async () => {
    const supabase = mockSupabase({ role: "customer" });
    const result = await resolvePasswordSignIn({
      supabase: supabase as never,
      email: "shopper@example.com",
      password: "validpass1",
      portal: "admin",
    });
    expect(result).toEqual({ error: ADMIN_FORBIDDEN_MESSAGE });
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
  });
});

describe("production source has no mock credentials or global Demo Mode", () => {
  const srcRoot = path.join(process.cwd(), "src");
  const files = walk(srcRoot);
  const production = files
    .filter((file) => !file.includes(`${path.sep}tests${path.sep}`))
    .map((file) => ({ file, text: readFileSync(file, "utf8") }));

  it("does not hardcode administrator credentials", () => {
    const joined = production.map((p) => p.text).join("\n");
    expect(joined).not.toMatch(/admin@gmail\.com/i);
    expect(joined).not.toMatch(/admin123/);
    expect(joined).not.toMatch(/DEMO_ADMIN_EMAIL/);
    expect(joined).not.toMatch(/DEMO_ADMIN_PASSWORD/);
    expect(joined).not.toMatch(/DEMO_ADMIN_AUTH_ENABLED/);
    expect(joined).not.toMatch(/DEMO_ADMIN_SESSION_SECRET/);
  });

  it("does not present the website as Demo Mode", () => {
    const ui = production.filter((p) => !p.file.includes(`${path.sep}demo-store${path.sep}`));
    for (const item of ui) {
      expect(item.text, item.file).not.toMatch(/Demo mode/i);
      expect(item.text, item.file).not.toMatch(/Demo Mode/);
      expect(item.text, item.file).not.toMatch(/authentication disabled/i);
      expect(item.text, item.file).not.toMatch(/placeholder authentication/i);
    }
  });

  it("signs in through a route handler redirect that writes session cookies", () => {
    const form = readFileSync(path.join(srcRoot, "components/auth/sign-in-form.tsx"), "utf8");
    const session = readFileSync(path.join(srcRoot, "app/api/auth/session/route.ts"), "utf8");
    const cookiesHelper = readFileSync(path.join(srcRoot, "lib/supabase/cookies.ts"), "utf8");
    const signIn = readFileSync(path.join(srcRoot, "lib/auth/password-sign-in.ts"), "utf8");
    const server = readFileSync(path.join(srcRoot, "lib/auth/server.ts"), "utf8");
    expect(form).toMatch(/action="\/api\/auth\/session"/);
    expect(form).not.toMatch(/router\.push/);
    expect(form).not.toMatch(/setTimeout/);
    expect(session).toMatch(/createCookieRecordingClient/);
    expect(session).toMatch(/redirectWithAuthCookies/);
    expect(cookiesHelper).toMatch(/response\.cookies\.set/);
    expect(signIn).toMatch(/signInWithPassword\(/);
    expect(signIn).toMatch(/getClaims/);
    expect(server).toMatch(/getUser\(\)/);
  });

  it("does not implement OTP authentication", () => {
    const authRoute = readFileSync(path.join(srcRoot, "app/api/auth/route.ts"), "utf8");
    expect(authRoute).not.toMatch(/verifyOtp/);
    expect(authRoute).not.toMatch(/signInWithOtp/);
    expect(authRoute).not.toMatch(/shouldCreateUser:\s*true/);
  });

  it("does not mount the customer/admin interface chooser", () => {
    const providers = readFileSync(path.join(srcRoot, "components/providers.tsx"), "utf8");
    expect(providers).not.toMatch(/RoleChooser/);
    expect(providers).not.toMatch(/RoleProvider/);
    expect(providers).not.toMatch(/CartProvider/);
  });

  it("keeps the administrator shell free of storefront chrome", () => {
    const layout = readFileSync(path.join(srcRoot, "app/(admin)/layout.tsx"), "utf8");
    const proxy = readFileSync(path.join(srcRoot, "proxy.ts"), "utf8");
    const server = readFileSync(path.join(srcRoot, "lib/auth/server.ts"), "utf8");
    expect(layout).not.toMatch(/CartLink/);
    expect(layout).not.toMatch(/PhoneCta/);
    expect(layout).not.toMatch(/SiteHeader/);
    expect(layout).not.toMatch(/SiteFooter/);
    expect(layout).not.toMatch(/StoreAnnouncement/);
    expect(layout).not.toMatch(/My Account/);
    expect(layout).toMatch(/requireAdmin\(/);
    expect(server).toMatch(/lookupAppRole/);
    expect(server).not.toMatch(/localStorage/);
    expect(proxy).not.toMatch(/requireAdmin/);
    const entry = readFileSync(path.join(srcRoot, "app/(entry)/page.tsx"), "utf8");
    expect(entry).toMatch(/role === "admin"\) redirect\("\/admin"\)/);
    expect(entry).toMatch(/cookies\(\)/);
    expect(entry).toMatch(/parseEntryMode/);
    expect(entry).not.toMatch(/EntryExperience>\{storefront\}/);
    const storeLayout = readFileSync(path.join(srcRoot, "app/(store)/layout.tsx"), "utf8");
    const authLayout = readFileSync(path.join(srcRoot, "app/(auth)/layout.tsx"), "utf8");
    const rootLayout = readFileSync(path.join(srcRoot, "app/layout.tsx"), "utf8");
    expect(storeLayout).toMatch(/StoreShell/);
    expect(storeLayout).not.toMatch(/StoreAnnouncement/);
    expect(authLayout).not.toMatch(/SiteHeader|CartLink|AdminNav/);
    expect(rootLayout).not.toMatch(/SiteHeader|SiteFooter|StoreAnnouncement/);
    const signIn = readFileSync(path.join(srcRoot, "lib/auth/password-sign-in.ts"), "utf8");
    expect(signIn).toMatch(/adminDestination/);
    expect(signIn).not.toMatch(/setTimeout/);
  });
});

describe("email-link confirmation", () => {
  it("exchanges the confirmation code and rejects external redirects", () => {
    const callback = readFileSync(path.join(process.cwd(), "src/app/(auth)/auth/callback/route.ts"), "utf8");
    expect(callback).toMatch(/exchangeCodeForSession\(code!?\)/);
    expect(callback).toMatch(/verifyOtp/);
    expect(callback).toMatch(/token_hash/);
    expect(callback).toMatch(/applyAuthCookies/);
    expect(safeNextPath("https://evil.example")).toBe("/account");
    expect(safeNextPath("//evil.example")).toBe("/account");
    expect(safeNextPath("/checkout")).toBe("/checkout");
  });
});

describe("deferred profile until email verification", () => {
  it("creates application rows only after email_confirmed_at is set", () => {
    const sql = readFileSync(
      path.join(process.cwd(), "../supabase/migrations/20260903060000_defer_profile_until_email_verified.sql"),
      "utf8",
    );
    expect(sql).toMatch(/if new\.email_confirmed_at is null then/);
    expect(sql).toMatch(/on_auth_user_email_confirmed/);
    expect(sql).toMatch(/when \(new\.email_confirmed_at is not null\)/);
  });
});

describe("entry preference is not authorization", () => {
  it("uses a versioned sessionStorage key and cannot be read by requireAdmin", () => {
    expect(ENTRY_MODE_STORAGE_KEY).toBe("bronxville-entry-mode-v3");
    const server = readFileSync(path.join(process.cwd(), "src/lib/auth/server.ts"), "utf8");
    expect(server).not.toMatch(/bronxville-entry-mode/);
    expect(server).not.toMatch(/sessionStorage/);
    expect(server).not.toMatch(/localStorage/);
    const fastapi = readFileSync(path.join(process.cwd(), "backend/app/api/deps.py"), "utf8");
    expect(fastapi).not.toMatch(/bronxville-entry-mode/);
    expect(fastapi).toMatch(/user_roles/);
  });

  it("stores only guest, customer, or admin in sessionStorage", () => {
    sessionStorage.clear();
    localStorage.setItem("bnm-demo-role", "admin");
    localStorage.setItem("bronxville-interface-mode-v2", "admin");
    expect(readEntryMode()).toBeNull();
    expect(localStorage.getItem("bnm-demo-role")).toBeNull();
    writeEntryMode("guest");
    expect(sessionStorage.getItem(ENTRY_MODE_STORAGE_KEY)).toBe("guest");
    expect(sessionStorage.getItem(ENTRY_MODE_STORAGE_KEY)).not.toBe("admin");
    writeEntryMode("admin");
    expect(readEntryMode()).toBe("admin");
    clearEntryMode();
    expect(readEntryMode()).toBeNull();
  });
});

describe("sample catalog notice", () => {
  it("is the approved catalog-only disclosure", () => {
    expect(SAMPLE_CATALOG_NOTICE).toBe(
      "Product information and pricing are currently sample data and will be verified before launch.",
    );
    const home = readFileSync(path.join(process.cwd(), "src/app/(entry)/page.tsx"), "utf8");
    const storeHome = readFileSync(path.join(process.cwd(), "src/components/home/storefront-home.tsx"), "utf8");
    const notice = readFileSync(path.join(process.cwd(), "src/components/catalog/sample-catalog-notice.tsx"), "utf8");
    const browser = readFileSync(path.join(process.cwd(), "src/components/catalog/catalog-browser.tsx"), "utf8");
    expect(home).not.toMatch(/SampleCatalogNotice/);
    expect(storeHome).not.toMatch(/SampleCatalogNotice/);
    expect(notice).toMatch(/SAMPLE_CATALOG_NOTICE/);
    expect(browser).toMatch(/SampleCatalogNotice/);
  });
});

describe("orders require a signed-in customer with address and phone", () => {
  it("rejects anonymous orders and incomplete addresses", () => {
    resetDemoStore();
    expect(() =>
      createOrder({
        customer_name: "Guest",
        customer_email: "g@example.com",
        customer_phone: "555-0100",
        items: [{ product_id: 54, quantity: 1 }],
      }),
    ).toThrow(/Sign in is required/i);
    expect(() =>
      createOrder({
        user_id: "00000000-0000-4000-a000-000000000001",
        customer_name: "Guest",
        customer_email: "g@example.com",
        customer_phone: "555-0100",
        items: [{ product_id: 54, quantity: 1 }],
      }),
    ).toThrow(/Address and phone are required/i);
  });
});

describe("customer removal confirmation", () => {
  it("requires an exact CONFIRM payload in the administrator API", () => {
    const route = readFileSync(
      path.join(process.cwd(), "src/app/api/admin/customers/[customerId]/route.ts"),
      "utf8",
    );
    expect(route).toMatch(/requireAdmin/);
    expect(route).toMatch(/confirmation !== "CONFIRM"/);
    expect(route).toMatch(/auth\.admin\.deleteUser/);
    expect(route).toMatch(/role === "admin"/);
  });
});
