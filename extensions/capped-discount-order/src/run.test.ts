import { describe, it, expect } from "vitest";
import { run } from "./run";

// Manually mock RunInput structure since generated types won't exist prior to build
export interface MockRunInput {
  cart: {
    cost: {
      subtotalAmount: {
        amount: string;
        currencyCode: string;
      };
    };
    lines: Array<{
      id: string;
      quantity: number;
      cost: {
        amountPerQuantity: {
          amount: string;
          currencyCode: string;
        };
      };
      merchandise: {
        __typename: string;
        id?: string;
      };
    }>;
  };
  discountNode?: {
    metafield?: {
      value?: string | null;
    } | null;
  } | null;
}

export interface MockInputOverrides {
  subtotal?: number | string;
  currencyCode?: string;
  lines?: MockRunInput["cart"]["lines"];
  metafieldValue?: string | null;
  config?: {
    percentage?: number;
    maxCapAmount?: number;
    currencyCode?: string;
    minSubtotal?: number;
    discountMessage?: string;
    [key: string]: unknown;
  } | null;
  omitMetafield?: boolean;
  omitDiscountNode?: boolean;
}

/**
 * Helper to construct a mock RunInput payload with sensible defaults and customizable overrides.
 */
export function createMockInput(overrides: MockInputOverrides = {}): any {
  const {
    subtotal = "100.00",
    currencyCode = "USD",
    lines = [],
    config = {
      percentage: 80,
      maxCapAmount: 200,
    },
    metafieldValue,
    omitMetafield = false,
    omitDiscountNode = false,
  } = overrides;

  let value: string | null = null;
  if (!omitMetafield) {
    if (metafieldValue !== undefined) {
      value = metafieldValue;
    } else if (config !== null) {
      value = JSON.stringify(config);
    }
  }

  const discountNode = omitDiscountNode
    ? null
    : omitMetafield
    ? null
    : {
        metafield: value !== null ? { value } : null,
      };

  const formattedSubtotal =
    typeof subtotal === "number" ? subtotal.toFixed(2) : subtotal;

  return {
    cart: {
      cost: {
        subtotalAmount: {
          amount: formattedSubtotal,
          currencyCode,
        },
      },
      lines,
    },
    discountNode,
  };
}

describe("capped-discount-order function", () => {
  // 1. Subtotal 1000, 80% capped at 200 → expect 200.00 discount
  it("should cap discount at 200.00 when raw percentage discount (800.00) exceeds cap for subtotal 1000", () => {
    const input = createMockInput({
      subtotal: 1000,
      config: {
        percentage: 80,
        maxCapAmount: 200,
      },
    });

    const result = run(input);

    expect(result.discounts).toHaveLength(1);
    expect(result.discounts[0].value.fixedAmount?.amount).toBe("200.00");
    expect(result.discounts[0].targets[0].orderSubtotal?.excludedVariantIds).toEqual([]);
    expect(result.discounts[0].message).toBe("80% OFF (Max USD 200)");
  });

  // 2. Subtotal 100, 80% capped at 200 → expect 80.00 discount
  it("should apply percentage discount of 80.00 when raw discount is below cap for subtotal 100", () => {
    const input = createMockInput({
      subtotal: 100,
      config: {
        percentage: 80,
        maxCapAmount: 200,
      },
    });

    const result = run(input);

    expect(result.discounts).toHaveLength(1);
    expect(result.discounts[0].value.fixedAmount?.amount).toBe("80.00");
    expect(result.discounts[0].message).toBe("80% OFF (Max USD 200)");
  });

  // 3. Subtotal 250, 80% capped at 200 → expect 200.00 discount
  it("should apply 200.00 discount when 80% of 250 equals exactly the cap amount of 200", () => {
    const input = createMockInput({
      subtotal: 250,
      config: {
        percentage: 80,
        maxCapAmount: 200,
      },
    });

    const result = run(input);

    expect(result.discounts).toHaveLength(1);
    expect(result.discounts[0].value.fixedAmount?.amount).toBe("200.00");
  });

  // 4. Below minimum subtotal → expect empty discounts
  it("should return empty discounts when subtotal is below minimum subtotal", () => {
    const input = createMockInput({
      subtotal: 99.99,
      config: {
        percentage: 80,
        maxCapAmount: 200,
        minSubtotal: 100.0,
      },
    });

    const result = run(input);

    expect(result.discounts).toEqual([]);
  });

  // 5. Missing metafield → expect empty discounts
  it("should return empty discounts when metafield is missing", () => {
    // Missing discountNode
    expect(run(createMockInput({ omitDiscountNode: true })).discounts).toEqual([]);

    // Missing metafield on discountNode
    expect(run(createMockInput({ omitMetafield: true })).discounts).toEqual([]);

    // Empty string metafield value
    expect(run(createMockInput({ metafieldValue: "" })).discounts).toEqual([]);

    // Null metafield value
    expect(run(createMockInput({ metafieldValue: null })).discounts).toEqual([]);
  });

  // 6. Invalid/corrupt JSON in metafield → expect empty discounts
  it("should return empty discounts when metafield has invalid or corrupt JSON", () => {
    const inputCorruptedJson = createMockInput({
      metafieldValue: "{ invalid json: 123",
    });

    const result = run(inputCorruptedJson);

    expect(result.discounts).toEqual([]);
  });

  // 7. Currency mismatch → expect empty discounts
  it("should return empty discounts on currency mismatch between cart and config", () => {
    const input = createMockInput({
      currencyCode: "CAD",
      config: {
        percentage: 80,
        maxCapAmount: 200,
        currencyCode: "USD",
      },
    });

    const result = run(input);

    expect(result.discounts).toEqual([]);
  });

  // 8. Percentage = 0 or > 100 → expect empty discounts
  it("should return empty discounts when percentage is 0 or greater than 100", () => {
    // percentage = 0
    expect(
      run(createMockInput({ config: { percentage: 0, maxCapAmount: 200 } })).discounts
    ).toEqual([]);

    // percentage < 0
    expect(
      run(createMockInput({ config: { percentage: -10, maxCapAmount: 200 } })).discounts
    ).toEqual([]);

    // percentage > 100
    expect(
      run(createMockInput({ config: { percentage: 100.5, maxCapAmount: 200 } })).discounts
    ).toEqual([]);

    // maxCapAmount <= 0
    expect(
      run(createMockInput({ config: { percentage: 80, maxCapAmount: 0 } })).discounts
    ).toEqual([]);
    expect(
      run(createMockInput({ config: { percentage: 80, maxCapAmount: -50 } })).discounts
    ).toEqual([]);

    // Non-number percentage or maxCapAmount
    expect(
      run(
        createMockInput({
          metafieldValue: JSON.stringify({ percentage: "80", maxCapAmount: 200 }),
        })
      ).discounts
    ).toEqual([]);
  });

  // 9. Custom discount message → expect message in output
  it("should output custom discount message when configured", () => {
    const customMessage = "Special Black Friday Capped Deal";
    const input = createMockInput({
      subtotal: 500,
      config: {
        percentage: 80,
        maxCapAmount: 200,
        discountMessage: customMessage,
      },
    });

    const result = run(input);

    expect(result.discounts).toHaveLength(1);
    expect(result.discounts[0].message).toBe(customMessage);
  });

  // 10. Exact boundary: subtotal 250, 80% = exactly 200, cap 200 → expect 200.00
  it("should handle exact boundary: subtotal 250, 80% = exactly 200, cap 200 → expect 200.00", () => {
    const input = createMockInput({
      subtotal: 250.0,
      currencyCode: "USD",
      config: {
        percentage: 80,
        maxCapAmount: 200,
      },
    });

    const result = run(input);

    expect(result.discounts).toHaveLength(1);
    expect(result.discounts[0].value.fixedAmount?.amount).toBe("200.00");
    expect(result.discounts[0].message).toBe("80% OFF (Max USD 200)");
  });

  // Additional edge cases
  it("should return empty discounts when subtotal is <= 0 or invalid NaN", () => {
    expect(run(createMockInput({ subtotal: "0.00" })).discounts).toEqual([]);
    expect(run(createMockInput({ subtotal: "-25.00" })).discounts).toEqual([]);
    expect(run(createMockInput({ subtotal: "abc" })).discounts).toEqual([]);
  });

  it("should use cart currency in default message when currencyCode is omitted in config", () => {
    const input = createMockInput({
      subtotal: 200,
      currencyCode: "GBP",
      config: {
        percentage: 25,
        maxCapAmount: 50,
      },
    });

    const result = run(input);

    expect(result.discounts).toHaveLength(1);
    expect(result.discounts[0].value.fixedAmount?.amount).toBe("50.00");
    expect(result.discounts[0].message).toBe("25% OFF (Max GBP 50)");
  });
});
