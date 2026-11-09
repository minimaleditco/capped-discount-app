import { describe, it, expect } from "vitest";
import { currencySymbol, formatMoney } from "../app/services/money";

describe("formatMoney", () => {
  it("uses the store currency, not a hard-coded rupee symbol", () => {
    expect(formatMoney(44, "USD")).toBe("$44.00");
    expect(formatMoney(400, "USD")).toBe("$400.00");
    expect(formatMoney(187.49, "USD")).toBe("$187.49");
  });

  it("keeps INR correct", () => {
    expect(formatMoney(1176.82, "INR")).toBe("₹1,176.82");
  });

  it("handles other currencies and minor units", () => {
    expect(formatMoney(1234.5, "EUR")).toBe("€1,234.50");
    expect(formatMoney(1000, "JPY")).toBe("¥1,000");
  });

  it("falls back to the code for an invalid currency", () => {
    expect(formatMoney(10, "NOTACURRENCY")).toContain("NOTACURRENCY");
  });

  it("returns a symbol for input prefixes", () => {
    expect(currencySymbol("USD")).toBe("$");
    expect(currencySymbol("INR")).toBe("₹");
    expect(currencySymbol("EUR")).toBe("€");
    expect(currencySymbol("NOTACURRENCY")).toBe("NOTACURRENCY");
  });

  it("never returns NaN", () => {
    expect(formatMoney(Number.NaN, "USD")).toBe("$0.00");
    expect(formatMoney(Number.POSITIVE_INFINITY, "USD")).toBe("$0.00");
  });
});
