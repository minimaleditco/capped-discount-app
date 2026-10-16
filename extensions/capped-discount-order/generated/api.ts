export interface RunInput {
  cart: {
    cost: {
      subtotalAmount: {
        amount: string;
        currencyCode: string;
      };
    };
    lines?: Array<{
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

export interface Target {
  orderSubtotal?: {
    excludedVariantIds?: string[];
  };
}

export interface FixedAmount {
  amount: string;
}

export interface Value {
  fixedAmount?: FixedAmount;
  percentage?: {
    value: string;
  };
}

export interface Discount {
  targets: Target[];
  value: Value;
  message?: string;
}

export enum DiscountApplicationStrategy {
  First = "FIRST",
  Maximum = "MAXIMUM",
}

export interface FunctionRunResult {
  discountApplicationStrategy: DiscountApplicationStrategy | string;
  discounts: Discount[];
}
