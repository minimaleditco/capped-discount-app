/**
 * One money formatter for the whole app.
 *
 * Every amount shown to a merchant or shopper must use the store's own
 * currency. Hard-coded rupee symbols were the root of the "Synchronize data
 * accurately" review finding: a USD store saw `₹44` in the popup while Shopify
 * charged `$400`.
 *
 * Pure module (Intl only) so routes, services and tests share the same output.
 */
export function formatMoney(value: number, currencyCode = "INR"): string {
  const amount = Number(value);
  const safe = Number.isFinite(amount) ? amount : 0;
  const currency = String(currencyCode || "INR").toUpperCase();

  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).format(safe);
  } catch {
    // Unknown/invalid currency code: still readable, never throws.
    return `${currency} ${safe.toFixed(2)}`;
  }
}

/**
 * Currency symbol for inputs that render a prefix instead of a full amount
 * (Polaris TextField `prefix`, for example).
 */
export function currencySymbol(currencyCode = "INR"): string {
  const currency = String(currencyCode || "INR").toUpperCase();
  try {
    const parts = new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).formatToParts(0);
    return parts.find((part) => part.type === "currency")?.value || currency;
  } catch {
    return currency;
  }
}
