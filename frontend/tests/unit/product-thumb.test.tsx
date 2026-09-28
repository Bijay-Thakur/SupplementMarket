import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductThumb } from "@/components/catalog/product-thumb";

describe("product thumbnail", () => {
  it("loads and decodes remote images without blocking the page", () => {
    render(
      <ProductThumb
        src="https://manufacturer.example/product.jpg"
        alt="Supplement bottle"
        className="h-40 w-40"
      />,
    );

    const image = screen.getByRole("img", { name: "Supplement bottle" });
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("decoding", "async");
    expect(image).toHaveStyle({
      background: "linear-gradient(160deg, #fff9f1 0%, #f3ead8 100%)",
    });
  });

  it("replaces a failed remote image with the accessible catalog placeholder", () => {
    render(
      <ProductThumb
        src="https://manufacturer.example/blocked-product.jpg"
        alt="Garden of Life product"
        className="h-40 w-40"
      />,
    );

    fireEvent.error(screen.getByRole("img", { name: "Garden of Life product" }));

    const placeholder = screen.getByRole("img", { name: "Garden of Life product" });
    expect(placeholder.tagName).toBe("DIV");
    expect(placeholder).toHaveClass("h-40", "w-40");
  });
});
