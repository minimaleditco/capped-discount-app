import { simulatorGateway } from "./simulator";
import { razorpayGateway } from "./razorpay";
import { stripeGateway } from "./stripe";
import type { PaymentGatewayAdapter } from "./types";

export * from "./types";
export * from "./simulator";
export * from "./razorpay";
export * from "./stripe";

export function getGatewayAdapter(gateway: string): PaymentGatewayAdapter {
  switch (gateway.toLowerCase()) {
    case "razorpay":
      return razorpayGateway;
    case "stripe":
      return stripeGateway;
    case "simulator":
    default:
      return simulatorGateway;
  }
}
