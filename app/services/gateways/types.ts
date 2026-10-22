export interface CreatePaymentParams {
  shop: string;
  orderId: string;
  orderName: string;
  depositAmount: number;
  currency: string;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
  apiKey?: string;
  apiSecret?: string;
}

export interface GatewayOrderResult {
  success: boolean;
  gatewayOrderId: string;
  amount: number;
  currency: string;
  checkoutPayload?: Record<string, any>;
  paymentUrl?: string;
  error?: string;
}

export interface VerifyPaymentParams {
  shop: string;
  orderId: string;
  gatewayPaymentId: string;
  gatewayOrderId?: string;
  gatewaySignature?: string;
  apiKey?: string;
  apiSecret?: string;
}

export interface PaymentGatewayAdapter {
  createPayment(params: CreatePaymentParams): Promise<GatewayOrderResult>;
  verifyPayment(params: VerifyPaymentParams): Promise<boolean>;
}
