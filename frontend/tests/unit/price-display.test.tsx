import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PriceDisplay } from "@/components/catalog/price-display";

describe("labeled product pricing", () => {
  it("shows Store SRP and a crossed-out MSRP when a discount exists", () => {
    const html = renderToStaticMarkup(
      <PriceDisplay regularCents={3699} saleCents={2589} showLabels />,
    );

    expect(html).toContain("Store SRP");
    expect(html).toContain("$25.89");
    expect(html).toContain("MSRP");
    expect(html).toContain("$36.99");
    expect(html).toContain("line-through");
  });

  it("shows only MSRP when there is no discount", () => {
    const html = renderToStaticMarkup(
      <PriceDisplay regularCents={3699} saleCents={null} showLabels />,
    );

    expect(html).not.toContain("Store SRP");
    expect(html).toContain("MSRP");
    expect(html).not.toContain("line-through");
  });
});
