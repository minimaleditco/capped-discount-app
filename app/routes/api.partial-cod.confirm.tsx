import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { unauthenticated } from "../shopify.server";
import {
  getPartialCodSettings,
  getDepositById,
  getDepositByOrderId,
  normalizeShopDomain,
  saveDeposit,
} from "../db.server";
import { getGatewayAdapter } from "../services/gateways";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, { status: 405 });
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: "Invalid JSON payload" }, { status: 400 });
  }

  const {
    shop,
    depositId,
    orderId,
    gatewayPaymentId,
    gatewayOrderId,
    gatewaySignature,
  } = body;

  const cleanShop = normalizeShopDomain(shop);

  if (!cleanShop || (!depositId && !orderId) || !gatewayPaymentId) {
    return json(
      { success: false, error: "Missing required fields: shop, depositId/orderId, gatewayPaymentId" },
      { status: 400 }
    );
  }

  const depositRecord = depositId
    ? await getDepositById(depositId)
    : await getDepositByOrderId(cleanShop, orderId);

  if (!depositRecord || normalizeShopDomain(depositRecord.shop) !== cleanShop) {
    return json({ success: false, error: "Deposit record not found" }, { status: 404 });
  }

  if (depositRecord.status === "paid") {
    return json({
      success: true,
      alreadyPaid: true,
      message: "Deposit has already been confirmed.",
      depositAmount: depositRecord.depositAmount,
      remainingBalance: depositRecord.remainingBalance,
    });
  }

  const settings = await getPartialCodSettings(cleanShop);
  // Verify with the gateway that actually created the payment, not whichever
  // gateway happens to be selected now (merchants switch gateways).
  const gatewayAdapter = getGatewayAdapter(depositRecord.gateway || settings.gateway);

  // 1. Verify Payment Authenticity with Gateway
  const isValid = await gatewayAdapter.verifyPayment({
    shop: cleanShop,
    orderId: depositRecord.orderId,
    gatewayPaymentId,
    gatewayOrderId: gatewayOrderId || depositRecord.gatewayTransactionId,
    gatewaySignature,
    apiKey: settings.apiKey,
    apiSecret: settings.apiSecret,
  });

  if (!isValid) {
    depositRecord.status = "failed";
    depositRecord.updatedAt = Date.now();
    await saveDeposit(depositRecord);
    return json({ success: false, error: "Payment verification failed" }, { status: 400 });
  }

  // 2. Update Shopify Order via Admin GraphQL API
  try {
    const { admin } = await unauthenticated.admin(cleanShop);

    // Step A: Register the payment transaction (Record deposit amount as CAPTURED)
    const transactionMutation = `
      mutation OrderTransactionCreate($orderId: ID!, $transaction: OrderTransactionInput!) {
        orderTransactionCreate(orderId: $orderId, transaction: $transaction) {
          transaction {
            id
            status
            amountSet {
              presentmentMoney {
                amount
                currencyCode
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const txRes = await admin.graphql(transactionMutation, {
      variables: {
        orderId: depositRecord.orderId,
        transaction: {
          amount: depositRecord.depositAmount.toFixed(2),
          kind: "CAPTURE",
          gateway: `Partial COD (${settings.gateway.toUpperCase()})`,
          status: "SUCCESS",
        },
      },
    });

    const txData: any = await txRes.json();
    if (txData?.data?.orderTransactionCreate?.userErrors?.length > 0) {
      console.warn(
        "Transaction creation userErrors:",
        txData.data.orderTransactionCreate.userErrors
      );
    }

    // Step B: Add Tags to the Shopify Order
    const tagsMutation = `
      mutation TagsAdd($id: ID!, $tags: [String!]!) {
        tagsAdd(id: $id, tags: $tags) {
          node {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const tagList = [
      "Partial-COD-Paid",
      `Balance-Due-${Math.round(depositRecord.remainingBalance)}`,
    ];

    await admin.graphql(tagsMutation, {
      variables: {
        id: depositRecord.orderId,
        tags: tagList,
      },
    });

    // Step C: Append informative Note to Order
    const noteText = `[Partial COD Deposit Paid] Advance deposit of ${depositRecord.currency} ${depositRecord.depositAmount.toFixed(
      2
    )} received via ${settings.gateway.toUpperCase()} (Ref: ${gatewayPaymentId}). Remaining COD balance to collect upon delivery: ${depositRecord.currency} ${depositRecord.remainingBalance.toFixed(
      2
    )}.`;

    const updateNoteMutation = `
      mutation UpdateOrderNote($input: OrderInput!) {
        orderUpdate(input: $input) {
          order {
            id
            note
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    await admin.graphql(updateNoteMutation, {
      variables: {
        input: {
          id: depositRecord.orderId,
          note: noteText,
        },
      },
    });

    // 3. Mark DB Record as PAID
    depositRecord.status = "paid";
    depositRecord.gatewayTransactionId = gatewayPaymentId;
    depositRecord.updatedAt = Date.now();
    await saveDeposit(depositRecord);

    return json({
      success: true,
      message: "Deposit confirmed and Shopify order successfully updated!",
      depositAmount: depositRecord.depositAmount,
      remainingBalance: depositRecord.remainingBalance,
      currency: depositRecord.currency,
      orderName: depositRecord.orderName,
    });
  } catch (err: any) {
    console.error("Error updating Shopify order for deposit:", err);
    return json(
      {
        success: false,
        error: err?.message || "Failed to update Shopify order with deposit transaction",
      },
      { status: 500 }
    );
  }
};
