import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "Privacy Policy | Capped Percentage Discounts" },
    { name: "description", content: "Privacy policy for Capped Percentage Discounts Shopify App" },
  ];
};

export default function PrivacyPolicy() {
  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif", maxWidth: "800px", margin: "40px auto", padding: "0 20px", color: "#202223", lineHeight: "1.6" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "8px" }}>Privacy Policy</h1>
      <p style={{ color: "#6d7175", marginBottom: "32px" }}>Last updated: October 17, 2026</p>

      <section style={{ marginBottom: "28px" }}>
        <h2 style={{ fontSize: "1.25rem", marginBottom: "12px" }}>1. Overview</h2>
        <p>
          Capped Percentage Discounts ("the App") is developed to provide Shopify merchants with the ability to create percentage-based discounts with an upper dollar or currency cap limit. We respect your privacy and are committed to protecting the privacy of merchants and their customers.
        </p>
      </section>

      <section style={{ marginBottom: "28px" }}>
        <h2 style={{ fontSize: "1.25rem", marginBottom: "12px" }}>2. Information We Collect</h2>
        <p>
          The App collects and stores only the minimum information necessary to provide discount management functionality:
        </p>
        <ul style={{ paddingLeft: "24px" }}>
          <li><strong>Shop Information:</strong> Shopify store domain and OAuth access tokens required to communicate with the Shopify Admin API.</li>
          <li><strong>Discount Configurations:</strong> Discount titles, percentage rates, maximum cap amounts, minimum cart subtotal thresholds, and validity dates.</li>
        </ul>
        <p style={{ marginTop: "12px" }}>
          <strong>No Customer Personal Data:</strong> The App does not collect, track, or store any customer personally identifiable information (PII), names, email addresses, phone numbers, or credit card information. All discount calculations are executed natively inside Shopify's checkout engine via Shopify Functions WebAssembly.
        </p>
      </section>

      <section style={{ marginBottom: "28px" }}>
        <h2 style={{ fontSize: "1.25rem", marginBottom: "12px" }}>3. Data Retention and Deletion (GDPR & CCPA Compliance)</h2>
        <p>
          We strictly adhere to Shopify's compliance guidelines:
        </p>
        <ul style={{ paddingLeft: "24px" }}>
          <li><strong>App Uninstall:</strong> When a merchant uninstalls the App from their store, Shopify sends an <code>app/uninstalled</code> webhook. Upon receipt, all stored store credentials and sessions are immediately purged.</li>
          <li><strong>Shop Redact:</strong> When requested by Shopify via <code>shop/redact</code>, all remaining store metadata is permanently deleted within 48 hours.</li>
          <li><strong>Customer Data Requests & Redactions:</strong> The App does not retain any customer records. When <code>customers/data_request</code> or <code>customers/redact</code> webhooks are received, we acknowledge the request and confirm that zero customer data is held.</li>
        </ul>
      </section>

      <section style={{ marginBottom: "28px" }}>
        <h2 style={{ fontSize: "1.25rem", marginBottom: "12px" }}>4. Third-Party Sharing</h2>
        <p>
          We do not sell, rent, or share any merchant data with third-party advertisers, data brokers, or external analytics services.
        </p>
      </section>

      <section style={{ marginBottom: "28px" }}>
        <h2 style={{ fontSize: "1.25rem", marginBottom: "12px" }}>5. Contact Us</h2>
        <p>
          If you have any questions about this Privacy Policy or wish to make an inquiry, please contact our support team at:
        </p>
        <p style={{ fontWeight: 600 }}>support@minimaledit.co</p>
      </section>
    </div>
  );
}
