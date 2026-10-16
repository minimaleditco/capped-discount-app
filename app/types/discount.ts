/**
 * TypeScript types and interfaces for the Capped Discount Shopify App.
 *
 * Defines configuration payload structures, form handling states,
 * and GraphQL response models for order and product discount functions.
 */

export interface CappedDiscountConfig {
  /** Percentage value 0-100 */
  percentage: number;
  /** Maximum discount amount cap */
  maxCapAmount: number;
  /** ISO 4217 currency code (e.g. INR, USD) */
  currencyCode?: string;
  /** Minimum cart subtotal required */
  minSubtotal?: number;
  /** Custom message shown to customers */
  discountMessage?: string;
}

export type DiscountMethod = "code" | "automatic";

export interface DiscountFormData {
  title: string;
  method: DiscountMethod;
  code?: string;
  percentage: number;
  maxCapAmount: number;
  currencyCode: string;
  minSubtotal: number;
  startsAt: string;
  endsAt?: string;
  combinesWithOrderDiscounts: boolean;
  combinesWithProductDiscounts: boolean;
  combinesWithShippingDiscounts: boolean;
}

export interface DiscountNodeSummary {
  id: string;
  title: string;
  status: string;
  method: DiscountMethod;
  startsAt: string;
  endsAt?: string | null;
  percentage: number;
  maxCapAmount: number;
  currencyCode: string;
}

/**
 * GraphQL Discount User Error shape returned from Shopify Admin API mutations
 */
export interface DiscountUserError {
  field: string[] | null;
  message: string;
  code?: string;
}

/**
 * Combining rules representation matching Shopify's DiscountCombinesWithInput
 */
export interface DiscountCombinesWithInput {
  orderDiscounts?: boolean;
  productDiscounts?: boolean;
  shippingDiscounts?: boolean;
}
