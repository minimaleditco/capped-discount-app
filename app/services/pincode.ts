/**
 * Postal-code helpers shared by the deposit-rule engine, the admin UI and the
 * storefront API.
 *
 * A single rule may list several codes separated by commas (newlines and
 * semicolons work too), because merchants price whole delivery zones. Every
 * entry keeps the prefix behaviour the engine has always had: "4000" matches
 * every 4000xx pincode, and a trailing "*" is accepted as documentation.
 */

export const MAX_PINCODE_TARGETS = 500;

export function cleanPincode(value?: string | null): string {
  if (!value) return "";
  return String(value)
    .replace(/[^a-zA-Z0-9]/g, "")
    .trim()
    .toLowerCase();
}

/** Splits "400053, 400054, 5600*" into clean, de-duplicated prefixes. */
export function parsePincodeList(value?: string | null): string[] {
  const seen = new Set<string>();
  const targets: string[] = [];

  for (const part of String(value ?? "").split(/[,\n;]+/)) {
    const cleaned = cleanPincode(part.replace(/\*/g, ""));
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    targets.push(cleaned);
    if (targets.length >= MAX_PINCODE_TARGETS) break;
  }

  return targets;
}

/** Canonical form saved to the database, e.g. "400053, 400054, 5600". */
export function normalizePincodeList(value?: string | null): string {
  return parsePincodeList(value).join(", ");
}

/** True when the customer's pincode matches any entry in the rule. */
export function matchesPincodeList(
  value: string | undefined | null,
  customerPin: string
): boolean {
  const pin = cleanPincode(customerPin);
  if (!pin) return false;

  return parsePincodeList(value).some(
    (target) => pin === target || pin.startsWith(target)
  );
}
