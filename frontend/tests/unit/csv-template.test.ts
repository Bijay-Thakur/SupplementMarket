import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CSV_TEMPLATE } from "@/lib/demo-store/engine";

describe("product CSV download template", () => {
  it("matches the canonical public template and contains no fake product rows", () => {
    const publicTemplate = fs.readFileSync(
      path.join(process.cwd(), "public", "templates", "product-import-template.csv"),
      "utf8",
    );
    expect(CSV_TEMPLATE).toBe(publicTemplate);
    expect(CSV_TEMPLATE.trim().split(/\r?\n/)).toHaveLength(1);
    expect(CSV_TEMPLATE).toContain("product_full_name,brand,category");
    expect(CSV_TEMPLATE).toContain("msrp,store_srp");
  });
});
