import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { getPartialCodSettings } from "../db.server";
import { evaluateDepositRules } from "../services/deposit-rules.server";
import { getGatewayAdapter } from "../services/gateways";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  return handleInit(request);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  return handleInit(request);
};

async function handleInit(request: Request) {
  try {
    let body: any = {};
    if (request.method === "POST") {
      try {
        body = await request.json();
      } catch {
        // empty or not JSON
      }
    } else {
      const url = new URL(request.url);
      body.shop = url.searchParams.get("shop");
    }

    const shop = body.shop;
    if (!shop) {
      return json({ success: false, error: "Missing required parameter: shop" }, { status: 400, headers: corsHeaders });
    }

    const settings = await getPartialCodSettings(shop);
    if (!settings.enabled) {
      return json({ success: false, error: "Partial COD is not enabled on this store" }, { status: 400, headers: corsHeaders });
    }

    const items = Array.isArray(body.items) ? body.items : [];
    let subtotal = 0;
    for (const item of items) {
      const price = Number(item.price) || 0;
      const qty = Number(item.quantity) || 1;
      subtotal += price * qty;
    }

    // Default to at least item price if not specified
    if (subtotal <= 0 && body.total) {
      subtotal = Number(body.total) || 1000;
    }
    if (subtotal <= 0) {
      subtotal = 1000;
    }

    // Check discount
    let discount = Number(body.discount) || 0;
    let shipping = Number(body.shipping) || 0;
    let total = Math.max(0, subtotal - discount + shipping);

    // Evaluate dynamic risk-based deposit rules
    const evaluation = await evaluateDepositRules(shop, {
      totalPrice: total,
      currency: "INR",
      lineItems: items.map((it: any) => ({
        title: it.title,
        sku: it.sku,
        variantId: it.variantId || it.id,
        price: Number(it.price) || 0,
        quantity: Number(it.quantity) || 1,
      })),
      pincode: body.pincode,
      shippingAddress: body.shippingAddress,
    });

    const deposit = evaluation.deposit;
    const balance = evaluation.balance;

    // Initialize Gateway Session
    const adapter = getGatewayAdapter(settings.gateway);
    const sessionOrderId = `fc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const gatewayOrder = await adapter.createPayment({
      shop,
      orderId: sessionOrderId,
      orderName: sessionOrderId,
      depositAmount: deposit,
      currency: "INR",
      apiKey: settings.apiKey,
      apiSecret: settings.apiSecret,
    });

    return json({
      success: true,
      shop,
      settings: {
        enabled: settings.enabled,
        gateway: settings.gateway,
        depositType: settings.depositType,
        depositValue: settings.depositValue,
      },
      subtotal,
      discount,
      shipping,
      total,
      deposit,
      balance,
      ruleSummary: evaluation.ruleSummary,
      matchedRule: evaluation.matchedRule
        ? { id: evaluation.matchedRule.id, conditionType: evaluation.matchedRule.conditionType }
        : null,
      currency: "INR",
      gateway: settings.gateway,
      gatewayOrderId: gatewayOrder.gatewayOrderId || sessionOrderId,
      keyId: settings.gateway === "razorpay" ? settings.apiKey : undefined,
    }, {
      headers: corsHeaders,
    });
  } catch (error: any) {
    console.error("[Fast Checkout Init Error]:", error);
    return json({ success: false, error: error.message || "Failed to initialize fast checkout" }, { status: 500, headers: corsHeaders });
  }
}
