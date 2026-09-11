import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

describe("Vercel backend boundary", () => {
  it("deploys Python below a non-conflicting API path", () => {
    const entrypoint = read("api/backend.py");
    expect(entrypoint).toContain('@backend_api.get("/api/backend"');
    expect(entrypoint).toContain('request.query_params.get("__path")');
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
    expect(proxy).toContain("encodeURIComponent(upstreamPath)");
    expect(proxy).not.toContain("supabaseServiceRoleKey");
  });

  it("uses the same-deployment Python function instead of a local port on Vercel", () => {
    const serverEnv = read("src/lib/env/server.ts");
    const vercelOrigin = serverEnv.indexOf("const vercelHost");
    const configuredOrigin = serverEnv.indexOf("if (data.FASTAPI_ORIGIN)");

    expect(vercelOrigin).toBeGreaterThan(-1);
    expect(configuredOrigin).toBeGreaterThan(vercelOrigin);
    expect(serverEnv).toContain("https://${vercelHost}/api/backend");
  });

  it("never defaults a production deploy to the bundled demo catalog", () => {
    const serverEnv = read("src/lib/env/server.ts");
    expect(serverEnv).toContain(
      'process.env.NODE_ENV === "production" ? "supabase" : "snapshot"',
    );
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
