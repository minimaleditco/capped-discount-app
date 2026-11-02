import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "Support | Partio" },
    {
      name: "description",
      content: "Contact Partio support for help with capped discounts and Partial COD.",
    },
  ];
};

export default function Support() {
  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        maxWidth: "760px",
        margin: "48px auto",
        padding: "0 20px",
        color: "#202223",
        lineHeight: 1.65,
      }}
    >
      <h1 style={{ fontSize: "2rem", marginBottom: "8px" }}>Support</h1>
      <p style={{ color: "#6d7175", marginBottom: "28px" }}>
        Help with Partio — capped discounts, Partial COD deposits and order
        verification.
      </p>

      <section style={{ marginBottom: "26px" }}>
        <h2 style={{ fontSize: "1.2rem", marginBottom: "10px" }}>Email us</h2>
        <p>
          <strong>hello@minimaledit.com</strong>
        </p>
        <p>
          We reply within one business day. To help us resolve your issue faster,
          include:
        </p>
        <ul style={{ paddingLeft: "22px" }}>
          <li>your store domain (for example, your-store.myshopify.com)</li>
          <li>the order or draft order number, if relevant</li>
          <li>a short description and a screenshot if possible</li>
        </ul>
      </section>

      <section style={{ marginBottom: "26px" }}>
        <h2 style={{ fontSize: "1.2rem", marginBottom: "10px" }}>
          Common questions
        </h2>
        <p>
          <strong>Where do I enable the storefront widget?</strong> Open the app
          from Shopify Admin, then use the “Enable the storefront widget” card on
          the home page to open the theme editor.
        </p>
        <p>
          <strong>Why is phone verification off?</strong> OTP is optional and
          off by default. Enable it in Partial COD settings after configuring an
          SMS or WhatsApp provider.
        </p>
        <p>
          <strong>Why does Meta report the full order value?</strong> Partio
          sends the full cart value (deposit plus cash balance) to the merchant’s
          own Meta dataset when Conversions API is configured.
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: "1.2rem", marginBottom: "10px" }}>Privacy</h2>
        <p>
          Read how we handle merchant and customer data in our{" "}
          <a href="/privacy" style={{ color: "#2C6ECB" }}>
            privacy policy
          </a>
          .
        </p>
      </section>
    </div>
  );
}
