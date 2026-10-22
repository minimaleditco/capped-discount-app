import type {
  PaymentGatewayAdapter,
  CreatePaymentParams,
  GatewayOrderResult,
  VerifyPaymentParams,
} from "./types";

export class StripeGatewayAdapter implements PaymentGatewayAdapter {
  async createPayment(params: CreatePaymentParams): Promise<GatewayOrderResult> {
    if (!params.apiSecret) {
      return {
        success: false,
        gatewayOrderId: "",
        amount: params.depositAmount,
        currency: params.currency,
        error: "Stripe Secret Key is not configured.",
      };
    }

    try {
      const amountInCents = Math.round(params.depositAmount * 100);
      const body = new URLSearchParams();
      body.append("amount", amountInCents.toString());
      body.append("currency", (params.currency || "usd").toLowerCase());
      body.append("description", `Advance Deposit for ${params.orderName}`);
      body.append("metadata[orderId]", params.orderId);
      body.append("metadata[shop]", params.shop);

      const res = await fetch("https://api.stripe.com/v1/payment_intents", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${params.apiSecret}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      const data: any = await res.json();
      if (!res.ok) {
        return {
          success: false,
          gatewayOrderId: "",
          amount: params.depositAmount,
          currency: params.currency,
          error: data.error?.message || `Stripe error HTTP ${res.status}`,
        };
      }

      return {
        success: true,
        gatewayOrderId: data.id,
        amount: params.depositAmount,
        currency: data.currency,
        checkoutPayload: {
          clientSecret: data.client_secret,
          publishableKey: params.apiKey || "",
        },
      };
    } catch (err: any) {
      return {
        success: false,
        gatewayOrderId: "",
        amount: params.depositAmount,
        currency: params.currency,
        error: err.message || "Failed to create Stripe payment intent",
      };
    }
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<boolean> {
    if (!params.apiSecret || !params.gatewayPaymentId) {
      return false;
    }

    try {
      const res = await fetch(`https://api.stripe.com/v1/payment_intents/${params.gatewayPaymentId}`, {
        headers: {
          Authorization: `Bearer ${params.apiSecret}`,
        },
      });

      const data: any = await res.json();
      return data.status === "succeeded";
    } catch {
      return false;
    }
  }
}

export const stripeGateway = new StripeGatewayAdapter();
