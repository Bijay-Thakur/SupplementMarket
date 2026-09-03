/**
 * Integer-cents money helpers. Never use IEEE floats for final totals.
 */

export function formatCents(cents: number, currency = "USD"): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(cents));
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  const formatted = `${dollars.toLocaleString("en-US")}.${remainder.toString().padStart(2, "0")}`;
  if (currency === "USD") return `${sign}$${formatted}`;
  return `${sign}${formatted} ${currency}`;
}

/** Parse a dollars string like "19.99" or "$1,200.50" into cents. */
export function parseDollarsToCents(raw: string): number | null {
  const s = raw.trim().replace(/[$,\s]/g, "");
  if (!s) return null;
  const neg = s.startsWith("-");
  const body = s.replace("-", "");
  if (!/^\d+(\.\d{0,2})?$/.test(body)) return null;
  const [whole, frac = ""] = body.split(".");
  const cents = Number.parseInt(whole || "0", 10) * 100 + Number.parseInt((frac + "00").slice(0, 2), 10);
  return neg ? -cents : cents;
}

export function discountPercent(regularCents: number, saleCents: number | null): number | null {
  if (saleCents == null || regularCents <= 0 || saleCents >= regularCents || saleCents < 0) {
    return null;
  }
  return Math.round(((regularCents - saleCents) * 100) / regularCents);
}

export function saleFromPercent(regularCents: number, percent: number): number {
  return Math.round((regularCents * (100 - percent)) / 100);
}

export function effectivePriceCents(regularCents: number, saleCents: number | null): number {
  if (saleCents != null && saleCents >= 0 && saleCents < regularCents) return saleCents;
  return regularCents;
}
