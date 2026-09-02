import { describe, it, expect } from "vitest";
import {
  DEFAULT_STORE_CONFIG,
  formatAddress,
  formatHours,
} from "@/lib/config/store";

describe("store config", () => {
  it("uses the verified business address", () => {
    expect(formatAddress(DEFAULT_STORE_CONFIG.address)).toBe(
      "86 Pondfield Rd, Bronxville, NY 10708",
    );
    expect(DEFAULT_STORE_CONFIG.address.verified).toBe(true);
  });

  it("uses the owner-provided phone, email, and hours", () => {
    expect(DEFAULT_STORE_CONFIG.contact.phone).toBe("+19147793552");
    expect(DEFAULT_STORE_CONFIG.contact.phoneIsPlaceholder).toBe(false);
    expect(DEFAULT_STORE_CONFIG.contact.email).toBe("bronxvillenatural@gmail.com");
    expect(formatHours()).toMatch(/Monday–Saturday/);
    expect(formatHours()).toMatch(/Sunday/);
  });
});
