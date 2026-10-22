import crypto from "node:crypto";
import type {
  PaymentGatewayAdapter,
  CreatePaymentParams,
  GatewayOrderResult,
  VerifyPaymentParams,
} from "./types";

export class RazorpayGatewayAdapter implements PaymentGatewayAdapter {
  async createPayment(params: CreatePaymentParams): Promise<GatewayOrderResult> {
    if (!params.apiKey || !params.apiSecret) {
      return {
        success: false,
        gatewayOrderId: "",
        amount: params.depositAmount,
        currency: params.currency,
        error: "Razorpay Key ID and Secret are not configured.",
      };
    }

    try {
      const auth = Buffer.from(`${params.apiKey}:${params.apiSecret}`).toString("base64");
      const amountInPaise = Math.round(params.depositAmount * 100);

      const res = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: params.currency.toUpperCase() || "INR",
          receipt: params.orderName.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 40),
          notes: {
            orderId: params.orderId,
            shop: params.shop,
            type: "partial_cod_deposit",
          },
        }),
      });

      const data: any = await res.json();
      if (!res.ok) {
        return {
          success: false,
          gatewayOrderId: "",
          amount: params.depositAmount,
          currency: params.currency,
          error: data.error?.description || `Razorpay error HTTP ${res.status}`,
        };
      }

      return {
        success: true,
        gatewayOrderId: data.id,
        amount: params.depositAmount,
        currency: data.currency,
        checkoutPayload: {
          key: params.apiKey,
          order_id: data.id,
          amount: amountInPaise,
          currency: data.currency,
          name: params.shop,
          description: `Advance Deposit for ${params.orderName}`,
          prefill: {
            email: params.customerEmail || "",
            contact: params.customerPhone || "",
            name: params.customerName || "",
          },
        },
      };
    } catch (err: any) {
      return {
        success: false,
        gatewayOrderId: "",
        amount: params.depositAmount,
        currency: params.currency,
        error: err.message || "Failed to create Razorpay order",
      };
    }
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<boolean> {
    if (!params.apiSecret || !params.gatewayPaymentId) {
      return false;
    }

    if (!params.gatewayOrderId || !params.gatewaySignature) {
      return false;
    }

    try {
      const expectedSignature = crypto
        .createHmac("sha256", params.apiSecret)
        .update(`${params.gatewayOrderId}|${params.gatewayPaymentId}`)
        .digest("hex");

      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(params.gatewaySignature)
      );
    } catch {
      return false;
    }
  }
}

export const razorpayGateway = new RazorpayGatewayAdapter();
