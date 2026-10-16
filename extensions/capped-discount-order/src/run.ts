import type {
  RunInput,
  FunctionRunResult,
} from "../generated/api";

interface CappedDiscountConfig {
  percentage: number;
  maxCapAmount: number;
  currencyCode?: string;
  minSubtotal?: number;
  discountMessage?: string;
}

const EMPTY_RESULT: FunctionRunResult = {
  discountApplicationStrategy: "FIRST" as any,
  discounts: [],
};

export function run(input: RunInput): FunctionRunResult {
  // 1. Parse metafield configuration with safe fallback
  const rawValue = input?.discountNode?.metafield?.value;
  if (!rawValue) {
    return EMPTY_RESULT;
  }

  let config: CappedDiscountConfig;
  try {
    config = JSON.parse(rawValue);
  } catch {
    return EMPTY_RESULT;
  }

  const {
    percentage,
    maxCapAmount,
    currencyCode,
    minSubtotal = 0,
    discountMessage,
  } = config;

  // 2. Validate required config values
  if (
    typeof percentage !== "number" ||
    typeof maxCapAmount !== "number" ||
    percentage <= 0 ||
    percentage > 100 ||
    maxCapAmount <= 0
  ) {
    return EMPTY_RESULT;
  }

  // 3. Read cart subtotal
  const subtotalStr = input.cart.cost.subtotalAmount.amount;
  const cartCurrency = input.cart.cost.subtotalAmount.currencyCode;
  const subtotal = parseFloat(subtotalStr);

  if (isNaN(subtotal) || subtotal <= 0) {
    return EMPTY_RESULT;
  }

  // 4. Currency validation (if configured)
  if (currencyCode && currencyCode !== cartCurrency) {
    return EMPTY_RESULT;
  }

  // 5. Minimum subtotal check
  if (subtotal < minSubtotal) {
    return EMPTY_RESULT;
  }

  // 6. Calculate capped discount
  const rawDiscount = subtotal * (percentage / 100);
  const finalDiscount = Math.min(rawDiscount, maxCapAmount);

  // 7. Build display message
  const message =
    discountMessage ||
    `${percentage}% OFF (Max ${currencyCode || cartCurrency} ${maxCapAmount})`;

  // 8. Return discount result as fixedAmount
  return {
    discountApplicationStrategy: "FIRST" as any,
    discounts: [
      {
        targets: [
          {
            orderSubtotal: {
              excludedVariantIds: [],
            },
          },
        ],
        value: {
          fixedAmount: {
            amount: finalDiscount.toFixed(2),
          },
        },
        message,
      },
    ],
  };
}
