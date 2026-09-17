import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductThumb } from "@/components/catalog/product-thumb";

describe("product thumbnail", () => {
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
