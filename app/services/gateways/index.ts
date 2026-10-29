import { simulatorGateway } from "./simulator";
import { razorpayGateway } from "./razorpay";
import { stripeGateway } from "./stripe";
import type {
  CreatePaymentParams,
  GatewayOrderResult,
  PaymentGatewayAdapter,
  VerifyPaymentParams,
} from "./types";

export * from "./types";
export * from "./simulator";
export * from "./razorpay";
export * from "./stripe";

/**
 * The simulator accepts any payment id starting with `sim_`/`test_` as proof
 * of payment. That is fine on a dev machine and catastrophic in production,
 * so it is now hard-disabled there unless explicitly opted in.
 */
export function simulatorAllowed(): boolean {
  if (process.env.ALLOW_SIMULATOR_GATEWAY === "true") return true;
  return process.env.NODE_ENV !== "production";
}

const disabledGateway: PaymentGatewayAdapter = {
  async createPayment(params: CreatePaymentParams): Promise<GatewayOrderResult> {
    return {
      success: false,
      gatewayOrderId: "",
      amount: params.depositAmount,
      currency: params.currency,
      error:
        "The payment simulator is disabled in production. Configure Razorpay (or another live gateway) in Partial COD settings.",
    };
  },
  async verifyPayment(_params: VerifyPaymentParams): Promise<boolean> {
    return false;
  },
};

export function getGatewayAdapter(gateway: string): PaymentGatewayAdapter {
  switch (String(gateway || "").toLowerCase()) {
    case "razorpay":
      return razorpayGateway;
    case "stripe":
      return stripeGateway;
    case "simulator":
    default:
      return simulatorAllowed() ? simulatorGateway : disabledGateway;
  }
}
