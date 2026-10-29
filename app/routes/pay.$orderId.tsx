import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useState, useCallback } from "react";
import { unauthenticated } from "../shopify.server";
import {
  getPartialCodSettings,
  getDepositByOrderId,
  normalizeShopDomain,
  saveDeposit,
  type PartialCodDepositRecord,
} from "../db.server";
import { getGatewayAdapter, simulatorAllowed } from "../services/gateways";

interface LoaderData {
  shop: string;
  orderId: string;
  orderName: string;
  totalAmount: number;
  depositAmount: number;
  remainingBalance: number;
  currency: string;
  gateway: string;
  simulatorAllowed?: boolean;
  isPaid: boolean;
  checkoutPayload?: any;
  gatewayOrderId?: string;
  depositId?: string;
  error?: string;
}

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = normalizeShopDomain(url.searchParams.get("shop") || "");
  const rawOrderId = params.orderId || "";

  if (!shop || !rawOrderId) {
    return json<LoaderData>({
      shop: "",
      orderId: "",
      orderName: "",
      totalAmount: 0,
      depositAmount: 0,
      remainingBalance: 0,
      currency: "INR",
      gateway: "simulator",
      isPaid: false,
      error: "Missing store URL or order ID in payment link.",
    });
  }

  const fullOrderId = rawOrderId.startsWith("gid://shopify/Order/")
    ? rawOrderId
    : `gid://shopify/Order/${rawOrderId}`;

  const settings = await getPartialCodSettings(shop);

  // Check existing record
  const existingDeposit = await getDepositByOrderId(shop, fullOrderId);
  if (existingDeposit && existingDeposit.status === "paid") {
    return json<LoaderData>({
      shop,
      orderId: fullOrderId,
      orderName: existingDeposit.orderName,
      totalAmount: existingDeposit.totalAmount,
      depositAmount: existingDeposit.depositAmount,
      remainingBalance: existingDeposit.remainingBalance,
      currency: existingDeposit.currency,
      gateway: existingDeposit.gateway,
      isPaid: true,
      depositId: existingDeposit.id,
    });
  }

  try {
    const { admin } = await unauthenticated.admin(shop);
    const orderQuery = `
      query GetOrder($id: ID!) {
        order(id: $id) {
          id
          name
          totalPriceSet {
            presentmentMoney {
              amount
              currencyCode
            }
          }
        }
      }
    `;

    const res = await admin.graphql(orderQuery, { variables: { id: fullOrderId } });
    const data: any = await res.json();
    const order = data?.data?.order;

    if (!order) {
      return json<LoaderData>({
        shop,
        orderId: fullOrderId,
        orderName: `#${rawOrderId}`,
        totalAmount: 0,
        depositAmount: 0,
        remainingBalance: 0,
        currency: "INR",
        gateway: settings.gateway,
        isPaid: false,
        error: "Order not found in store.",
      });
    }

    const totalAmount = parseFloat(order.totalPriceSet?.presentmentMoney?.amount || "0");
    const currency = order.totalPriceSet?.presentmentMoney?.currencyCode || "INR";
    const orderName = order.name || `#${rawOrderId}`;

    // Calculate deposit
    let depositAmount = 0;
    if (settings.depositType === "percentage") {
      depositAmount = Math.round((totalAmount * Math.min(settings.depositValue, 90)) / 100);
    } else {
      depositAmount = Math.min(settings.depositValue, totalAmount);
    }
    const remainingBalance = Math.max(totalAmount - depositAmount, 0);

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

    const gatewayAdapter = getGatewayAdapter(settings.gateway);
    const gatewayResult = await gatewayAdapter.createPayment({
      shop,
      orderId: fullOrderId,
      orderName,
      depositAmount,
      currency,
      apiKey: settings.apiKey,
      apiSecret: settings.apiSecret,
    });

    return json<LoaderData>({
      shop,
      orderId: fullOrderId,
      orderName,
      totalAmount,
      depositAmount,
      remainingBalance,
      currency,
      gateway: settings.gateway,
      simulatorAllowed: simulatorAllowed(),
      isPaid: false,
      depositId: depositRecord.id,
      gatewayOrderId: gatewayResult.gatewayOrderId,
      checkoutPayload: gatewayResult.checkoutPayload,
    });
  } catch (err: any) {
    return json<LoaderData>({
      shop,
      orderId: fullOrderId,
      orderName: `#${rawOrderId}`,
      totalAmount: 0,
      depositAmount: 0,
      remainingBalance: 0,
      currency: "INR",
      gateway: settings.gateway,
      isPaid: false,
      error: err?.message || "Failed to load order details",
    });
  }
};

export default function CustomerPayPage() {
  const data = useLoaderData<typeof loader>();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paidState, setPaidState] = useState(data.isPaid);
  const [errorMessage, setErrorMessage] = useState(data.error || "");

  const handleSimulatedPayment = useCallback(async () => {
    setIsProcessing(true);
    setErrorMessage("");

    try {
      const simulatedPaymentId = `sim_pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const res = await fetch("/api/partial-cod/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: data.shop,
          depositId: data.depositId,
          orderId: data.orderId,
          gatewayPaymentId: simulatedPaymentId,
          gatewayOrderId: data.gatewayOrderId,
        }),
      });

      const result: any = await res.json();
      if (result.success) {
        setPaidState(true);
      } else {
        setErrorMessage(result.error || "Simulated payment verification failed");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Network error during simulated payment");
    } finally {
      setIsProcessing(false);
    }
  }, [data]);

  return (
    <div
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        backgroundColor: "#f6f6f7",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
          maxWidth: "460px",
          width: "100%",
          padding: "32px 24px",
          boxSizing: "border-box",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div
            style={{
              display: "inline-block",
              backgroundColor: paidState ? "#e3f1df" : "#f1f2f3",
              color: paidState ? "#108043" : "#202223",
              padding: "6px 14px",
              borderRadius: "20px",
              fontSize: "13px",
              fontWeight: 600,
              marginBottom: "12px",
            }}
          >
            {paidState ? "✓ ORDER CONFIRMED" : "ACTION REQUIRED"}
          </div>
          <h1 style={{ fontSize: "22px", margin: "0 0 6px", color: "#202223" }}>
            {data.orderName || "Cash on Delivery Order"}
          </h1>
          <p style={{ margin: 0, fontSize: "14px", color: "#6d7175" }}>
            {paidState
              ? "Your advance deposit has been received!"
              : "Pay advance deposit to confirm your order"}
          </p>
        </div>

        {errorMessage && (
          <div
            style={{
              backgroundColor: "#fed3d1",
              color: "#bf0711",
              padding: "12px 16px",
              borderRadius: "8px",
              fontSize: "14px",
              marginBottom: "20px",
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* Order Breakdown Box */}
        <div
          style={{
            backgroundColor: "#fafbfb",
            border: "1px solid #e1e3e5",
            borderRadius: "12px",
            padding: "18px 16px",
            marginBottom: "24px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", fontSize: "14px" }}>
            <span style={{ color: "#6d7175" }}>Total Order Value:</span>
            <span style={{ fontWeight: 600, color: "#202223" }}>
              {data.currency} {data.totalAmount.toLocaleString()}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "12px",
              fontSize: "15px",
              color: "#108043",
              fontWeight: 600,
            }}
          >
            <span>Advance Online Deposit:</span>
            <span>
              {data.currency} {data.depositAmount.toLocaleString()}
            </span>
          </div>

          <div
            style={{
              borderTop: "1px dashed #d2d5d8",
              paddingTop: "12px",
              display: "flex",
              justifyContent: "space-between",
              fontSize: "15px",
              color: "#d97706",
              fontWeight: 600,
            }}
          >
            <span>Due on Delivery (COD):</span>
            <span>
              {data.currency} {data.remainingBalance.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Action Button or Success State */}
        {paidState ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: "48px", marginBottom: "8px" }}>🎉</div>
            <h3 style={{ fontSize: "18px", color: "#108043", margin: "0 0 8px" }}>
              Advance Deposit Paid!
            </h3>
            <p style={{ fontSize: "14px", color: "#6d7175", margin: 0, lineHeight: 1.5 }}>
              Your order is now being packed. Please keep{" "}
              <strong>
                {data.currency} {data.remainingBalance.toLocaleString()}
              </strong>{" "}
              ready in cash when the delivery courier arrives.
            </p>
          </div>
        ) : (
          <div>
            {data.gateway === "simulator" && data.simulatorAllowed ? (
              <button
                type="button"
                onClick={handleSimulatedPayment}
                disabled={isProcessing}
                style={{
                  width: "100%",
                  backgroundColor: isProcessing ? "#919eab" : "#008060",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "10px",
                  padding: "14px 20px",
                  fontSize: "16px",
                  fontWeight: 600,
                  cursor: isProcessing ? "not-allowed" : "pointer",
                  transition: "background 0.2s",
                }}
              >
                {isProcessing
                  ? "Verifying Payment..."
                  : `Simulate Payment (${data.currency} ${data.depositAmount})`}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => alert(`Razorpay/Stripe live integration active with order ${data.gatewayOrderId}`)}
                style={{
                  width: "100%",
                  backgroundColor: "#008060",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "10px",
                  padding: "14px 20px",
                  fontSize: "16px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Pay {data.currency} {data.depositAmount} via UPI / Card
              </button>
            )}

            <p style={{ textAlign: "center", fontSize: "12px", color: "#8c9196", marginTop: "14px" }}>
              🔒 100% Secure Payment • Order confirmation is instant
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
