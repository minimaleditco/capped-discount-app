import '@shopify/ui-extensions/preact';
import { render } from "preact";

export default async () => {
  render(<CheckoutExtension />, document.body);
};

function CheckoutExtension() {
  const totalAmount = shopify.cost?.totalAmount?.value;
  const total = totalAmount?.amount ? Number(totalAmount.amount) : 1000;
  const currency = totalAmount?.currencyCode || "INR";
  const currencySymbol = currency === "INR" ? "₹" : `${currency} `;

  // Standard Partial COD split: ₹100 deposit (or 10% if order < 1000)
  const deposit = total > 100 ? (total >= 1000 ? 100 : Math.round(total * 0.1)) : Math.round(total * 0.1);
  const balance = Math.max(0, total - deposit);

  return (
    <s-box
      border="base"
      border-radius="base"
      padding="base"
      background="subdued"
    >
      <s-stack gap="tight">
        <s-stack direction="inline" alignment="space-between" block-alignment="center">
          <s-heading level="3">
            📦 Partial Cash on Delivery
          </s-heading>
          <s-badge tone="success">
            {currencySymbol}{deposit} + {currencySymbol}{balance} on Delivery
          </s-badge>
        </s-stack>

        <s-divider />

        <s-stack direction="inline" alignment="space-between">
          <s-text appearance="subdued">Order Total:</s-text>
          <s-text type="emphasis">{currencySymbol}{total.toLocaleString()}</s-text>
        </s-stack>

        <s-stack direction="inline" alignment="space-between">
          <s-text tone="success" type="emphasis">1. Pay Online (Advance Deposit):</s-text>
          <s-text tone="success" type="emphasis">{currencySymbol}{deposit.toLocaleString()}</s-text>
        </s-stack>

        <s-stack direction="inline" alignment="space-between">
          <s-text tone="warning" type="emphasis">2. Pay on Delivery (Cash):</s-text>
          <s-text tone="warning" type="emphasis">{currencySymbol}{balance.toLocaleString()}</s-text>
        </s-stack>

        <s-divider />

        <s-banner tone="info">
          Select <strong>Partial Cash on Delivery</strong> at payment. Pay {currencySymbol}{deposit} deposit online to confirm shipment, and pay {currencySymbol}{balance} at your doorstep.
        </s-banner>
      </s-stack>
    </s-box>
  );
}