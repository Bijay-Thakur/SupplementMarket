import { describe, it, expect } from "vitest";
import {
  DEFAULT_STORE_CONFIG,
  formatAddress,
} from "@/lib/config/store";

describe("store config", () => {
  it("uses the verified business address", () => {
    expect(formatAddress(DEFAULT_STORE_CONFIG.address)).toBe(
      "86 Pondfield Road, Bronxville, NY 10708",
    );
    expect(DEFAULT_STORE_CONFIG.address.verified).toBe(true);
  });

  it("treats the phone number as an unverified placeholder", () => {
    expect(DEFAULT_STORE_CONFIG.contact.phone).toBeNull();
    expect(DEFAULT_STORE_CONFIG.contact.phoneIsPlaceholder).toBe(true);
  });
});
