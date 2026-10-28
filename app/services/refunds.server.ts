import { prisma, normalizeShopDomain, type PartialCodDepositRecord } from "../db.server";

export interface FormattedPartialCodOrder {
  id: string;
  name: string;
  createdAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  displayFinancialStatus: string;
  displayFulfillmentStatus: string;
  totalPrice: number;
  currency: string;
  depositAmount: number;
  remainingBalance: number;
  totalRefunded: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  tags: string[];
  note: string;
  isCancelled: boolean;
  isRefunded: boolean;
  canRefund: boolean;
  refundableDeposit: number;
  parentTransactionId?: string;
  gateway?: string;
}

export interface RefundResult {
  success: boolean;
  orderId: string;
  orderName?: string;
  refundedAmount?: number;
  currency?: string;
  cancelled?: boolean;
  restocked?: boolean;
  error?: string;
}

/**
 * Extracts numeric money value from string or object (e.g. "₹108.00" -> 108)
 */
export function parseCurrencyAmount(val: any): number {
  if (typeof val === "number") return val;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Parses and normalizes a Shopify order into a Partial COD order structure
 */
export function formatShopifyOrder(node: any): FormattedPartialCodOrder {
  const customAttrs: { key: string; value: string }[] = node.customAttributes || [];
  const tags: string[] = node.tags || [];

  // 1. Try to find Advance Deposit Paid from custom attributes or tags
  let depositPaid = 0;
  const depositAttr = customAttrs.find((a) => a.key === "Advance Deposit Paid");
  if (depositAttr) {
    depositPaid = parseCurrencyAmount(depositAttr.value);
  } else {
    const depositTag = tags.find((t) => t.toLowerCase().startsWith("deposit paid:"));
    if (depositTag) {
      depositPaid = parseCurrencyAmount(depositTag);
    }
  }

  // 2. Try to find Doorstep COD Balance Due
  let balanceDue = 0;
  const balanceAttr = customAttrs.find((a) => a.key === "Doorstep COD Balance Due" || a.key === "Remaining Doorstep Balance Due");
  if (balanceAttr) {
    balanceDue = parseCurrencyAmount(balanceAttr.value);
  } else {
    const balanceTag = tags.find((t) => t.toLowerCase().startsWith("doorstep balance:"));
    if (balanceTag) {
      balanceDue = parseCurrencyAmount(balanceTag);
    }
  }

  const totalPrice = parseFloat(node.totalPriceSet?.shopMoney?.amount || "0");
  const currency = node.totalPriceSet?.shopMoney?.currencyCode || "INR";
  const totalRefunded = parseFloat(node.totalRefundedSet?.shopMoney?.amount || "0");

  // 3. Fallback: If deposit was not in attributes, look at successful capture/sale transactions
  const txs: any[] = node.transactions || [];
  const successfulTx = txs.find(
    (t: any) =>
      (t.status === "SUCCESS" || t.status === "success") &&
      (t.kind === "SALE" || t.kind === "CAPTURE" || t.kind === "sale" || t.kind === "capture")
  );

  const txAmount = successfulTx ? parseFloat(successfulTx.amountSet?.shopMoney?.amount || "0") : 0;
  if (depositPaid <= 0 && txAmount > 0) {
    depositPaid = txAmount;
  }

  const isCancelled = Boolean(node.cancelledAt);
  const isRefunded = totalRefunded > 0 && totalRefunded >= depositPaid;
  const refundableDeposit = Math.max(0, Math.round((depositPaid - totalRefunded) * 100) / 100);
  const canRefund = !isRefunded && refundableDeposit > 0 && Boolean(successfulTx);

  let phone = node.customer?.phone || "";
  if (!phone) {
    const phoneAttr = customAttrs.find((a) => a.key === "Verified Mobile");
    if (phoneAttr) phone = phoneAttr.value;
  }

  return {
    id: node.id,
    name: node.name || "Order",
    createdAt: node.createdAt,
    cancelledAt: node.cancelledAt,
    cancelReason: node.cancelReason,
    displayFinancialStatus: node.displayFinancialStatus || "UNKNOWN",
    displayFulfillmentStatus: node.displayFulfillmentStatus || "UNFULFILLED",
    totalPrice,
    currency,
    depositAmount: depositPaid,
    remainingBalance: balanceDue,
    totalRefunded,
    customerName: node.customer?.displayName || "Guest Customer",
    customerEmail: node.customer?.email || "",
    customerPhone: phone,
    tags,
    note: node.note || "",
    isCancelled,
    isRefunded,
    canRefund,
    refundableDeposit,
    parentTransactionId: successfulTx?.id,
    gateway: successfulTx?.gateway || "shopify_payments",
  };
}

/**
 * Fetch all Partial COD orders for the store via Shopify GraphQL
 */
export async function getPartialCodOrders(
  admin: any,
  queryFilter = ""
): Promise<FormattedPartialCodOrder[]> {
  const searchQuery = queryFilter
    ? `tag:'Partial COD' AND ${queryFilter}`
    : "tag:'Partial COD' OR tag:'Partially Paid' OR tag:'Partial COD Cancelled'";

  const query = `#graphql
    query GetPartialCodOrders($first: Int!, $query: String) {
      orders(first: $first, query: $query, sortKey: CREATED_AT, reverse: true) {
        edges {
          node {
            id
            name
            createdAt
            cancelledAt
            cancelReason
            displayFinancialStatus
            displayFulfillmentStatus
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            totalRefundedSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            customer {
              displayName
              email
              phone
            }
            tags
            note
            customAttributes {
              key
              value
            }
            transactions {
              id
              kind
              status
              gateway
              amountSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const res = await admin.graphql(query, {
      variables: { first: 50, query: searchQuery },
    });
    const resJson: any = await res.json();
    const edges = resJson.data?.orders?.edges || [];
    return edges.map((e: any) => formatShopifyOrder(e.node));
  } catch (err) {
    console.error("[Refunds Service] Error fetching partial COD orders:", err);
    return [];
  }
}

/**
 * Executes One-Click Deposit Cancellation & Refund atomically
 */
export async function cancelAndRefundDeposit(
  admin: any,
  shop: string,
  params: {
    orderId: string;
    reason?: "CUSTOMER" | "DECLINED" | "FRAUD" | "INVENTORY" | "OTHER";
    staffNote?: string;
    restock?: boolean;
    notifyCustomer?: boolean;
  }
): Promise<RefundResult> {
  const {
    orderId,
    reason = "CUSTOMER",
    staffNote = "Partial COD deposit refund initiated from App Support Dashboard",
    restock = true,
    notifyCustomer = true,
  } = params;

  // 1. Fetch current order details & transactions
  const singleOrderQuery = `#graphql
    query GetSingleOrderForRefund($id: ID!) {
      order(id: $id) {
        id
        name
        cancelledAt
        totalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        totalRefundedSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        customAttributes {
          key
          value
        }
        tags
        transactions {
          id
          kind
          status
          gateway
          amountSet {
            shopMoney {
              amount
              currencyCode
            }
          }
        }
      }
    }
  `;

  const orderRes = await admin.graphql(singleOrderQuery, {
    variables: { id: orderId },
  });
  const orderJson: any = await orderRes.json();
  const orderNode = orderJson.data?.order;

  if (!orderNode) {
    return {
      success: false,
      orderId,
      error: "Order not found in Shopify.",
    };
  }

  const formatted = formatShopifyOrder(orderNode);
  const depositToRefund = formatted.refundableDeposit;
  const currency = formatted.currency;

  if (depositToRefund <= 0 && formatted.isRefunded) {
    return {
      success: false,
      orderId,
      orderName: formatted.name,
      error: "Deposit has already been refunded for this order.",
    };
  }

  // 2. Step 1: Cancel order in Shopify with restock (if not already cancelled)
  let cancelled = formatted.isCancelled;
  let restocked = false;

  if (!formatted.isCancelled) {
    const cancelMutation = `#graphql
      mutation CancelOrder($orderId: ID!, $reason: OrderCancelReason!, $restock: Boolean!, $staffNote: String) {
        orderCancel(
          orderId: $orderId
          reason: $reason
          restock: $restock
          staffNote: $staffNote
        ) {
          job {
            id
            done
          }
          orderCancelUserErrors {
            code
            field
            message
          }
        }
      }
    `;

    try {
      const cancelRes = await admin.graphql(cancelMutation, {
        variables: {
          orderId,
          reason,
          restock,
          staffNote,
        },
      });
      const cancelJson: any = await cancelRes.json();
      const cancelErrors = cancelJson.data?.orderCancel?.orderCancelUserErrors || [];
      if (cancelErrors.length > 0) {
        console.warn("[Refunds Service] Order cancel userErrors:", cancelErrors);
        // Continue if the order is already in a cancelled state
        const isAlreadyCancelled = cancelErrors.some(
          (e: any) => e.code === "CANNOT_CANCEL" || e.message?.toLowerCase().includes("cancelled")
        );
        if (!isAlreadyCancelled) {
          return {
            success: false,
            orderId,
            orderName: formatted.name,
            error: cancelErrors.map((e: any) => e.message).join(", "),
          };
        }
      }
      cancelled = true;
      restocked = restock;
    } catch (cancelErr: any) {
      console.error("[Refunds Service] Error cancelling order:", cancelErr);
      return {
        success: false,
        orderId,
        orderName: formatted.name,
        error: cancelErr.message || "Failed to cancel order.",
      };
    }
  }

  // 3. Step 2: Issue Refund specifically for the Online Deposit Transaction
  let refundId: string | null = null;
  if (formatted.parentTransactionId && depositToRefund > 0) {
    const refundMutation = `#graphql
      mutation CreateDepositRefund($input: RefundInput!) {
        refundCreate(input: $input) {
          refund {
            id
            createdAt
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const refundInput = {
      orderId,
      note: staffNote,
      notify: notifyCustomer,
      currency,
      transactions: [
        {
          orderId,
          amount: depositToRefund.toFixed(2),
          kind: "REFUND",
          gateway: formatted.gateway || "shopify_payments",
          parentId: formatted.parentTransactionId,
        },
      ],
    };

    try {
      const refundRes = await admin.graphql(refundMutation, {
        variables: { input: refundInput },
      });
      const refundJson: any = await refundRes.json();
      const refundErrors = refundJson.data?.refundCreate?.userErrors || [];
      if (refundErrors.length > 0) {
        console.warn("[Refunds Service] Refund creation userErrors:", refundErrors);
        return {
          success: false,
          orderId,
          orderName: formatted.name,
          error: refundErrors.map((e: any) => e.message).join(", "),
        };
      }
      refundId = refundJson.data?.refundCreate?.refund?.id || null;
    } catch (refundErr: any) {
      console.error("[Refunds Service] Error issuing refund:", refundErr);
      return {
        success: false,
        orderId,
        orderName: formatted.name,
        error: refundErr.message || "Failed to issue refund transaction.",
      };
    }
  }

  // 4. Step 3: Update Order Tags (Remove pending COD tags and add authoritative Cancelled/Refunded tags)
  const tagsMutation = `#graphql
    mutation UpdateOrderTags($id: ID!, $tagsToAdd: [String!]!, $tagsToRemove: [String!]!) {
      tagsAdd(id: $id, tags: $tagsToAdd) {
        userErrors {
          field
          message
        }
      }
      tagsRemove(id: $id, tags: $tagsToRemove) {
        userErrors {
          field
          message
        }
      }
    }
  `;

  try {
    await admin.graphql(tagsMutation, {
      variables: {
        id: orderId,
        tagsToAdd: [
          "Partial COD Cancelled",
          `Deposit Refunded: ₹${depositToRefund.toFixed(2)}`,
        ],
        tagsToRemove: [
          "Partially Paid",
          "Partial COD",
          "Partial COD Pending Delivery",
        ],
      },
    });
  } catch (tagsErr) {
    console.warn("[Refunds Service] Tags update warning:", tagsErr);
  }

  // 5. Step 4: Record refund event in local database (if record exists)
  const cleanShop = normalizeShopDomain(shop);
  try {
    await prisma.partialCodDeposit.updateMany({
      where: {
        shop: cleanShop,
        orderId: String(orderId).replace(/[^0-9]/g, ""),
      },
      data: {
        status: "cancelled",
      },
    });
  } catch (dbErr) {
    console.warn("[Refunds Service] DB status update fallback:", dbErr);
  }

  return {
    success: true,
    orderId,
    orderName: formatted.name,
    refundedAmount: depositToRefund,
    currency,
    cancelled,
    restocked,
  };
}
