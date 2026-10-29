export interface RawLineItem {
  variantId?: string | number;
  id?: string | number;
  quantity?: number | string;
  price?: number | string;
  title?: string;
}

export interface ResolvedLineItem {
  variantId: string;
  quantity: number;
  title: string;
  sku: string;
  unitPrice: number;
  lineTotal: number;
}

export interface ResolveResult {
  ok: boolean;
  lines: ResolvedLineItem[];
  subtotal: number;
  currencyCode: string;
  error?: string;
}

export const MAX_LINE_QUANTITY = 99;

/**
 * Converts a numeric or gid variant id into a canonical Shopify GID.
 */
export function toVariantGid(raw: unknown): string | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  if (/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(value)) return value;
  if (/^\d+$/.test(value)) return `gid://shopify/ProductVariant/${value}`;
  return null;
}

export function normalizeQuantity(raw: unknown): number {
  const qty = Math.floor(Number(raw));
  if (!Number.isFinite(qty) || qty < 1) return 1;
  return Math.min(qty, MAX_LINE_QUANTITY);
}

interface PricingAdmin {
  graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;
}

const VARIANTS_QUERY = `#graphql
  query GetVariantPrices($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on ProductVariant {
        id
        title
        sku
        price
      }
    }
    shop {
      currencyCode
    }
  }
`;

/**
 * Prices are ALWAYS read from Shopify, never from the request body.
 *
 * The storefront used to send `price` (and `deposit`, and `couponDiscount`)
 * straight through to the draft order, which let anyone choose what to pay.
 * Every billable value is now derived server-side from this lookup.
 */
export async function resolveLineItems(
  admin: PricingAdmin,
  rawItems: RawLineItem[]
): Promise<ResolveResult> {
  const ids: string[] = [];
  const quantityByGid = new Map<string, number>();
  const order: string[] = [];

  for (const item of rawItems) {
    const gid = toVariantGid(item?.variantId ?? item?.id);
    if (!gid) continue;
    quantityByGid.set(gid, (quantityByGid.get(gid) || 0) + normalizeQuantity(item?.quantity));
    if (!ids.includes(gid)) {
      ids.push(gid);
      order.push(gid);
    }
  }

  if (ids.length === 0) {
    return {
      ok: false,
      lines: [],
      subtotal: 0,
      currencyCode: "INR",
      error: "No valid product variant provided.",
    };
  }

  if (ids.length > 250) {
    return {
      ok: false,
      lines: [],
      subtotal: 0,
      currencyCode: "INR",
      error: "Too many distinct products in this order.",
    };
  }

  let nodes: any[] = [];
  let currencyCode = "INR";

  try {
    const res = await admin.graphql(VARIANTS_QUERY, { variables: { ids } });
    const json: any = await res.json();
    nodes = json?.data?.nodes || [];
    currencyCode = json?.data?.shop?.currencyCode || "INR";
  } catch (err: any) {
    return {
      ok: false,
      lines: [],
      subtotal: 0,
      currencyCode: "INR",
      error: err?.message || "Could not load product pricing from Shopify.",
    };
  }

  const priceByGid = new Map<string, { price: number; title: string; sku: string }>();
  for (const node of nodes) {
    if (!node?.id) continue;
    const price = parseFloat(String(node.price ?? ""));
    if (!Number.isFinite(price)) continue;
    priceByGid.set(node.id, {
      price,
      title: node.title || "Item",
      sku: node.sku || "",
    });
  }

  const lines: ResolvedLineItem[] = [];
  const missing: string[] = [];

  for (const gid of order) {
    const found = priceByGid.get(gid);
    if (!found) {
      missing.push(gid);
      continue;
    }
    const quantity = quantityByGid.get(gid) || 1;
    lines.push({
      variantId: gid,
      quantity,
      title: found.title,
      sku: found.sku,
      unitPrice: found.price,
      lineTotal: Math.round(found.price * quantity * 100) / 100,
    });
  }

  if (missing.length > 0) {
    return {
      ok: false,
      lines,
      subtotal: 0,
      currencyCode,
      error: `One or more products are no longer available (${missing.length}).`,
    };
  }

  const subtotal = Math.round(lines.reduce((sum, l) => sum + l.lineTotal, 0) * 100) / 100;

  return { ok: true, lines, subtotal, currencyCode };
}

/** Splits a money amount across lines proportionally to their value. */
export function allocateProportionally(
  total: number,
  lines: Array<{ lineTotal: number }>
): number[] {
  const safeTotal = Math.max(0, Number(total) || 0);
  const lineSum = lines.reduce((s, l) => s + Math.max(0, l.lineTotal), 0);

  if (lineSum <= 0 || lines.length === 0) {
    const even = lines.length > 0 ? safeTotal / lines.length : 0;
    return lines.map(() => Math.round(even * 100) / 100);
  }

  const allocated = lines.map((l) => Math.round((safeTotal * (l.lineTotal / lineSum)) * 100) / 100);
  // Push rounding drift onto the last line so the sum matches exactly.
  const drift = Math.round((safeTotal - allocated.reduce((s, v) => s + v, 0)) * 100) / 100;
  if (allocated.length > 0 && drift !== 0) {
    allocated[allocated.length - 1] = Math.round((allocated[allocated.length - 1] + drift) * 100) / 100;
  }
  return allocated;
}
