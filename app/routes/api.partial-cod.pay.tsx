import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { unauthenticated } from "../shopify.server";
import {
  getPartialCodSettings,
  getDepositByOrderId,
  normalizeShopDomain,
  saveDeposit,
  type PartialCodDepositRecord,
} from "../db.server";
import { getGatewayAdapter } from "../services/gateways";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return handlePayRequest(request);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  return handlePayRequest(request);
};

async function handlePayRequest(request: Request) {
  const url = new URL(request.url);
  let shop = url.searchParams.get("shop") || "";
  let orderId = url.searchParams.get("order_id") || "";

  if (request.method === "POST") {
    try {
      const body = await request.json();
      shop = body.shop || shop;
      orderId = body.order_id || body.orderId || orderId;
    } catch {
      // not JSON
    }
  }

  shop = normalizeShopDomain(shop);

  if (!shop) {
    return json({ success: false, error: "Missing required parameter: shop" }, { status: 400 });
  }

  const settings = await getPartialCodSettings(shop);

  if (orderId === "preview" || !orderId) {
    return json({
      success: true,
      settings: {
        enabled: settings.enabled,
        depositType: settings.depositType,
        depositValue: settings.depositValue,
        gateway: settings.gateway,
      },
    }, {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  if (!settings.enabled) {
    return json({ success: false, error: "Partial COD is not enabled on this store" }, { status: 400 });
  }

  // Format order GID
  const fullOrderId = orderId.startsWith("gid://shopify/Order/")
    ? orderId
    : `gid://shopify/Order/${orderId}`;

  // Check if already paid
  const existingDeposit = await getDepositByOrderId(shop, fullOrderId);
  if (existingDeposit && existingDeposit.status === "paid") {
    return json({
      success: true,
      alreadyPaid: true,
      depositAmount: existingDeposit.depositAmount,
      remainingBalance: existingDeposit.remainingBalance,
      currency: existingDeposit.currency,
      message: "Deposit already paid for this order.",
    });
  }

  try {
    const { admin } = await unauthenticated.admin(shop);

    const orderQuery = `
      query GetOrderForDeposit($id: ID!) {
        order(id: $id) {
          id
          name
          displayFinancialStatus
          totalPriceSet {
            presentmentMoney {
              amount
              currencyCode
            }
          }
          customer {
            displayName
            email
            phone
          }
        }
      }
    `;

    const res = await admin.graphql(orderQuery, { variables: { id: fullOrderId } });
    const data: any = await res.json();
    const order = data?.data?.order;

    if (!order) {
      return json({ success: false, error: "Order not found in Shopify" }, { status: 404 });
    }

    const totalAmount = parseFloat(order.totalPriceSet?.presentmentMoney?.amount || "0");
    const currency = order.totalPriceSet?.presentmentMoney?.currencyCode || "INR";
    const orderName = order.name || `#${orderId}`;

    // Minimum subtotal threshold check
    if (settings.minOrderSubtotal > 0 && totalAmount < settings.minOrderSubtotal) {
      return json({
        success: true,
        notRequired: true,
        message: "Order does not require an advance deposit based on minimum subtotal.",
      });
    }

    // Calculate deposit amount
    let depositAmount = 0;
    if (settings.depositType === "percentage") {
      depositAmount = Math.round((totalAmount * Math.min(settings.depositValue, 90)) / 100);
    } else {
      depositAmount = Math.min(settings.depositValue, totalAmount);
    }
    const remainingBalance = Math.max(totalAmount - depositAmount, 0);

    // Save pending deposit in DB
    const depositRecord: PartialCodDepositRecord = {
      id: existingDeposit?.id || `dep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      shop,
      orderId: fullOrderId,
      orderName,
      totalAmount,
      depositAmount,
      remainingBalance,
      currency,
      status: "pending",
      gateway: settings.gateway,
      createdAt: existingDeposit?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    await saveDeposit(depositRecord);

    // Call Gateway Adapter
    const gatewayAdapter = getGatewayAdapter(settings.gateway);
    const gatewayResult = await gatewayAdapter.createPayment({
      shop,
      orderId: fullOrderId,
      orderName,
      depositAmount,
      currency,
      customerEmail: order.customer?.email,
      customerPhone: order.customer?.phone,
      customerName: order.customer?.displayName,
      apiKey: settings.apiKey,
      apiSecret: settings.apiSecret,
    });

    if (!gatewayResult.success) {
      return json({ success: false, error: gatewayResult.error || "Gateway order creation failed" }, { status: 500 });
    }

    // Store gateway order id
    depositRecord.gatewayTransactionId = gatewayResult.gatewayOrderId;
    await saveDeposit(depositRecord);

    return json({
      success: true,
      depositId: depositRecord.id,
      orderName,
      totalAmount,
      depositAmount,
      remainingBalance,
      currency,
      gateway: settings.gateway,
      gatewayOrderId: gatewayResult.gatewayOrderId,
      checkoutPayload: gatewayResult.checkoutPayload,
    });
  } catch (err: any) {
    console.error("Error in api.partial-cod.pay:", err);
    return json({ success: false, error: err?.message || "Failed to initialize payment" }, { status: 500 });
  }
}
