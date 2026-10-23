import '@shopify/ui-extensions/preact';
import { render } from "preact";

export default async () => {
  render(<ThankYouExtension />, document.body);
};

function ThankYouExtension() {
  const orderConfirmation = shopify.orderConfirmation?.value;
  const rawOrderId = orderConfirmation?.order?.id || "";
  const numericOrderId = rawOrderId.replace(/^gid:\/\/shopify\/Order\//, "");
  const shopDomain = shopify.shop?.myshopifyDomain || "minimal-discount-test-3.myshopify.com";

  const totalAmount = shopify.cost?.totalAmount?.value;
  const total = totalAmount?.amount ? Number(totalAmount.amount) : 100;
  const currency = totalAmount?.currencyCode || "INR";
  const currencySymbol = currency === "INR" ? "₹" : `${currency} `;

  // If order was paid via Native Checkout / Bogus Gateway
  const financialStatus = orderConfirmation?.order?.financialStatus;
  const isPaid = financialStatus === "PAID" || financialStatus === "PARTIALLY_PAID";

  if (isPaid) {
    return (
      <s-banner tone="success" heading="🎉 Partial COD: Advance Deposit Received!">
        <s-stack gap="base">
          <s-paragraph>
            Thank you! Your advance deposit of <strong>{currencySymbol}{total.toLocaleString("en-IN")}</strong> has been received online. Your order is confirmed and sent to our fulfillment warehouse.
          </s-paragraph>
          <s-paragraph>
            📦 The remaining balance will be collected in cash by our delivery courier upon doorstep delivery.
          </s-paragraph>
        </s-stack>
      </s-banner>
    );
  }

  const deposit = total > 100 ? 100 : Math.round(total * 0.1);
  const remaining = Math.max(0, total - deposit);
  const payUrl = `https://capped-discount-app.onrender.com/pay/${numericOrderId}?shop=${shopDomain}`;

  return (
    <s-banner tone="warning" heading="⚡ Action Required: Pay Deposit to Confirm Order">
      <s-stack gap="base">
        <s-paragraph>
          Your order has been placed! To confirm shipping, please complete your advance deposit of <strong>{currencySymbol}{deposit}</strong>. The remaining balance of <strong>{currencySymbol}{remaining}</strong> will be collected in cash upon delivery.
        </s-paragraph>

        <s-button
          variant="primary"
          href={payUrl}
        >
          👉 Pay {currencySymbol}{deposit} Advance Deposit Now
        </s-button>
      </s-stack>
    </s-banner>
  );
}
