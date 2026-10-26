import {
  getDepositRules,
  getPartialCodSettings,
  type DepositRuleRecord,
} from "../db.server";

export interface CartLineItem {
  title?: string;
  sku?: string;
  variantId?: string | number;
  price?: number;
  quantity?: number;
}

export interface CartContext {
  totalPrice: number;
  currency?: string;
  lineItems?: CartLineItem[];
  pincode?: string;
  shippingAddress?: {
    zip?: string;
    city?: string;
    province?: string;
    country?: string;
  };
}

export interface CalculatedDepositResult {
  deposit: number;
  balance: number;
  matchedRule: DepositRuleRecord | null;
  ruleSummary: string;
  appliedType: "rule" | "store_default";
}

/**
 * Normalizes postal code / pincode string
 */
function cleanPincode(pin?: string): string {
  if (!pin) return "";
  return String(pin).replace(/[^a-zA-Z0-9]/g, "").trim().toLowerCase();
}

/**
 * Evaluates active dynamic deposit rules for a shop against the cart context.
 * Rules are evaluated in descending priority order. If a rule matches, its
 * deposit requirement is calculated and returned.
 * If no rule matches, the store's global default deposit settings are applied.
 */
export async function evaluateDepositRules(
  shop: string,
  context: CartContext
): Promise<CalculatedDepositResult> {
  const totalPrice = Math.max(0, Number(context.totalPrice) || 0);

  if (totalPrice <= 0) {
    return {
      deposit: 0,
      balance: 0,
      matchedRule: null,
      ruleSummary: "Zero total cart value",
      appliedType: "store_default",
    };
  }

  // 1. Fetch active rules ordered by priority DESC, createdAt ASC
  const rules = await getDepositRules(shop);
  const items = Array.isArray(context.lineItems) ? context.lineItems : [];
  const customerPin = cleanPincode(context.pincode || context.shippingAddress?.zip);

  let matchedRule: DepositRuleRecord | null = null;

  for (const rule of rules) {
    const rawVal = rule.conditionValue.trim();

    if (rule.conditionType === "Cart Value") {
      const threshold = parseFloat(rawVal);
      if (!isNaN(threshold) && totalPrice >= threshold) {
        matchedRule = rule;
        break;
      }
    } else if (rule.conditionType === "SKU") {
      const targetSku = rawVal.toLowerCase();
      const hasMatchingItem = items.some((item) => {
        const itemSku = (item.sku || "").trim().toLowerCase();
        const itemVariant = String(item.variantId || "").trim();
        return itemSku === targetSku || itemVariant === rawVal;
      });
      if (hasMatchingItem) {
        matchedRule = rule;
        break;
      }
    } else if (rule.conditionType === "Pincode") {
      const targetPin = cleanPincode(rawVal);
      if (customerPin && targetPin && customerPin.startsWith(targetPin)) {
        matchedRule = rule;
        break;
      }
    }
  }

  // 2. If a rule matched, compute deposit from the rule
  if (matchedRule) {
    let deposit = 0;
    if (matchedRule.depositType === "Flat") {
      deposit = Math.round(Number(matchedRule.depositValue) || 100);
    } else if (matchedRule.depositType === "Percentage") {
      const pct = Math.max(1, Math.min(100, Number(matchedRule.depositValue) || 10));
      deposit = Math.round((totalPrice * pct) / 100);
    }

    deposit = Math.max(1, Math.min(totalPrice, deposit));
    const balance = Math.max(0, Math.round((totalPrice - deposit) * 100) / 100);
    const summary = `Rule [${matchedRule.conditionType}: ${matchedRule.conditionValue}] -> ${
      matchedRule.depositType === "Flat" ? "₹" : ""
    }${matchedRule.depositValue}${matchedRule.depositType === "Percentage" ? "%" : ""} Deposit`;

    return {
      deposit,
      balance,
      matchedRule,
      ruleSummary: summary,
      appliedType: "rule",
    };
  }

  // 3. Fallback to Store Global Default Settings
  const settings = await getPartialCodSettings(shop);
  let defaultDeposit = 100;

  if (settings.depositType === "percentage") {
    const pct = Math.max(1, Math.min(100, Number(settings.depositValue) || 10));
    defaultDeposit = Math.round((totalPrice * pct) / 100);
  } else if (settings.depositType === "fixed") {
    defaultDeposit = Math.round(Number(settings.depositValue) || 100);
  }

  if (defaultDeposit <= 0) defaultDeposit = 100;
  defaultDeposit = Math.max(1, Math.min(totalPrice, defaultDeposit));
  const defaultBalance = Math.max(0, Math.round((totalPrice - defaultDeposit) * 100) / 100);
  const defaultSummary = `Store Default (${
    settings.depositType === "fixed" ? "₹" : ""
  }${settings.depositValue}${settings.depositType === "percentage" ? "%" : ""})`;

  return {
    deposit: defaultDeposit,
    balance: defaultBalance,
    matchedRule: null,
    ruleSummary: defaultSummary,
    appliedType: "store_default",
  };
}
