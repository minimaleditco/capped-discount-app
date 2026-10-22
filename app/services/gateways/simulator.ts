import type {
  PaymentGatewayAdapter,
  CreatePaymentParams,
  GatewayOrderResult,
  VerifyPaymentParams,
} from "./types";

export class SimulatorGatewayAdapter implements PaymentGatewayAdapter {
  async createPayment(params: CreatePaymentParams): Promise<GatewayOrderResult> {
    const gatewayOrderId = `sim_order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      success: true,
      gatewayOrderId,
      amount: params.depositAmount,
      currency: params.currency,
      checkoutPayload: {
        isSimulator: true,
        orderName: params.orderName,
        depositAmount: params.depositAmount,
        currency: params.currency,
      },
    };
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<boolean> {
    // Simulator automatically accepts payments beginning with 'sim_' or 'test_'
    if (!params.gatewayPaymentId) return false;
    return (
      params.gatewayPaymentId.startsWith("sim_") ||
      params.gatewayPaymentId.startsWith("test_") ||
      params.gatewayPaymentId.includes("mock")
    );
  }
}

export const simulatorGateway = new SimulatorGatewayAdapter();
