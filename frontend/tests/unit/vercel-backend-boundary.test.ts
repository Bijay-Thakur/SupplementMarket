import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

describe("Vercel backend boundary", () => {
  it("deploys Python below a non-conflicting API path", () => {
    const entrypoint = read("api/backend/index.py");
    expect(entrypoint).toContain('app.mount("/api/backend", backend_api)');
    expect(entrypoint).toContain('prefix="/api/v1"');
    expect(entrypoint).toContain("routes_admin_csv.router");
    expect(entrypoint).not.toContain("routes_dev.router");
  });

  it("keeps service credentials server-only", () => {
    const serverEnv = read("src/lib/env/server.ts");
    const proxy = read("src/lib/admin/fastapi-proxy.ts");
    expect(serverEnv).toContain("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY");
    expect(serverEnv).toContain("must never be prefixed with NEXT_PUBLIC_");
    expect(proxy).toContain("getVerifiedAccessToken");
    expect(proxy).toContain('headers.set("Authorization"');
    expect(proxy).not.toContain("supabaseServiceRoleKey");
  });

  it("excludes local secrets, databases, tests, and storage", () => {
    const ignore = read(".vercelignore");
    expect(ignore).toMatch(/^\.env$/m);
    expect(ignore).toContain("**/.env.*");
    expect(ignore).toContain("backend/**/*.db");
    expect(ignore).toContain("backend/storage/");
    expect(ignore).toContain("backend/tests/");
  });
});
