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
  const total = totalAmount?.amount ? Number(totalAmount.amount) : 1000;
  const currency = totalAmount?.currencyCode || "INR";
  const currencySymbol = currency === "INR" ? "₹" : `${currency} `;

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
