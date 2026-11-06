import {
  allocateProportionally,
  resolveLineItems,
  type RawLineItem,
  type ResolvedLineItem,
} from "./pricing.server";

/**
 * Authoritative cart pricing.
 *
 * The app used to reproduce Shopify's discount logic by hand (percentage of the
 * subtotal), which is wrong for product/collection-scoped automatic discounts,
 * "buy X get Y" conditions and stacking rules. Here Shopify itself calculates a
 * draft order and we read the result, so the popup, the draft order and the
 * Shopify cart all agree on one number.
 */

export interface DraftPricingLine extends ResolvedLineItem {
  /** Line total after Shopify applied every eligible discount. */
  discountedLineTotal: number;
}

export interface DraftPricingResult {
  ok: boolean;
  currencyCode: string;
  lines: DraftPricingLine[];
  /** Sum of catalog prices, before discounts. */
  catalogSubtotal: number;
  /** Merchandise total after discounts, excluding shipping and tax. */
  discountedSubtotal: number;
  /** Total value of every discount Shopify applied. */
  totalDiscount: number;
  /** Codes Shopify actually accepted, in the order it returned them. */
  appliedCodes: string[];
  error?: string;
}

const EMPTY: DraftPricingResult = {
  ok: false,
  currencyCode: "INR",
  lines: [],
  catalogSubtotal: 0,
  discountedSubtotal: 0,
  totalDiscount: 0,
  appliedCodes: [],
};

const CALCULATE_MUTATION = `#graphql
  mutation CalculatePartialCodPricing($input: DraftOrderInput!) {
    draftOrderCalculate(input: $input) {
      calculatedDraftOrder {
        currencyCode
        discountCodes
        totalPriceSet { shopMoney { amount } }
        totalDiscountsSet { shopMoney { amount } }
        totalTaxSet { shopMoney { amount } }
        totalShippingPriceSet { shopMoney { amount } }
        lineItems {
          quantity
          variant { id }
          originalTotalSet { shopMoney { amount } }
          discountedTotalSet { shopMoney { amount } }
        }
      }
      userErrors { field message }
    }
  }
`;

function moneyOf(set: any): number {
  const amount = parseFloat(String(set?.shopMoney?.amount ?? ""));
  return Number.isFinite(amount) ? amount : 0;
}

function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export async function calculateDraftPricing(
  admin: { graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response> },
  rawItems: RawLineItem[],
  couponCode = ""
): Promise<DraftPricingResult> {
  const resolved = await resolveLineItems(admin, rawItems);
  if (!resolved.ok) {
    return { ...EMPTY, error: resolved.error || "Unable to price this order." };
  }

  const input: Record<string, unknown> = {
    lineItems: resolved.lines.map((line) => ({
      variantId: line.variantId,
      quantity: line.quantity,
    })),
    // Let Shopify decide which automatic discounts are eligible. This is the
    // whole point: product/collection scope, quantity conditions and stacking
    // are evaluated by Shopify, not guessed from a percentage.
    acceptAutomaticDiscounts: true,
    // The deposit invoice must charge exactly the quoted amount. Taxes depend
    // on an address collected later, so they are excluded here.
    taxExempt: true,
  };

  const code = String(couponCode || "").trim();
  if (code) input.discountCodes = [code];

  let calculated: any = null;
  let userErrors: any[] = [];

  try {
    const response = await admin.graphql(CALCULATE_MUTATION, { variables: { input } });
    const json: any = await response.json();
    calculated = json?.data?.draftOrderCalculate?.calculatedDraftOrder || null;
    userErrors = json?.data?.draftOrderCalculate?.userErrors || [];
  } catch (err: any) {
    return { ...EMPTY, error: err?.message || "Could not calculate this order." };
  }

  if (!calculated) {
    const message = userErrors.map((e: any) => e?.message).filter(Boolean).join(", ");
    return { ...EMPTY, error: message || "Could not calculate this order." };
  }

  const total = moneyOf(calculated.totalPriceSet);
  const tax = moneyOf(calculated.totalTaxSet);
  const shipping = moneyOf(calculated.totalShippingPriceSet);
  const discountedSubtotal = Math.max(0, round2(total - tax - shipping));

  const catalogSubtotal = resolved.subtotal;
  const totalDiscount = Math.max(0, round2(catalogSubtotal - discountedSubtotal));

  const calculatedLines: any[] = Array.isArray(calculated.lineItems) ? calculated.lineItems : [];
  const discountedByVariant = new Map<string, number>();
  for (const line of calculatedLines) {
    const variantId = line?.variant?.id ? String(line.variant.id) : "";
    if (!variantId) continue;
    discountedByVariant.set(
      variantId,
      (discountedByVariant.get(variantId) || 0) + moneyOf(line.discountedTotalSet)
    );
  }

  const preliminary = resolved.lines.map((line) => ({
    ...line,
    discountedLineTotal:
      discountedByVariant.get(line.variantId) ?? line.lineTotal,
  }));

  // Allocate the authoritative discounted total across lines. This keeps the
  // sum exact after cent rounding, and keeps each line proportional to the
  // discount Shopify gave that line.
  const shares = allocateProportionally(
    discountedSubtotal,
    preliminary.map((line) => ({ lineTotal: line.discountedLineTotal || line.lineTotal }))
  );

  const lines: DraftPricingLine[] = preliminary.map((line, index) => ({
    ...line,
    discountedLineTotal: shares[index] ?? 0,
  }));

  return {
    ok: true,
    currencyCode: resolved.currencyCode,
    lines,
    catalogSubtotal,
    discountedSubtotal,
    totalDiscount,
    appliedCodes: Array.isArray(calculated.discountCodes)
      ? calculated.discountCodes.map((value: any) => String(value))
      : [],
  };
}
