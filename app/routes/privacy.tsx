import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "Privacy Policy | Capped Discount & COD Fee" },
    {
      name: "description",
      content:
        "How Capped Discount & COD Fee processes merchant and customer data.",
    },
  ];
};

const section = { marginBottom: "28px" } as const;
const h2 = { fontSize: "1.25rem", marginBottom: "12px" } as const;
const list = { paddingLeft: "24px" } as const;

export default function PrivacyPolicy() {
  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        maxWidth: "800px",
        margin: "40px auto",
        padding: "0 20px",
        color: "#202223",
        lineHeight: 1.6,
      }}
    >
      <h1 style={{ fontSize: "2rem", marginBottom: "8px" }}>Privacy Policy</h1>
      <p style={{ color: "#6d7175", marginBottom: "32px" }}>
        Last updated: 2 November 2026
      </p>

      <section style={section}>
        <h2 style={h2}>1. About this policy</h2>
        <p>
          Capped Discount &amp; COD Fee (“the App”) is a Shopify app that
          provides capped percentage discounts, Partial Cash on Delivery
          deposits, risk-based deposit rules, phone verification and optional
          Meta conversion tracking. This policy explains what data the App
          processes, why, and how long it is kept.
        </p>
      </section>

      <section style={section}>
        <h2 style={h2}>2. Data we process</h2>
        <p>
          <strong>Merchant data.</strong> Store domain, Shopify access tokens,
          app settings (deposit rules, discount settings, delivery-rule
          pincodes, SMS/WhatsApp configuration, and the merchant’s own Meta
          Pixel ID and Conversions API token).
        </p>
        <p>
          <strong>Customer and order data.</strong> To run Partial COD, the App
          receives the customer’s phone number, delivery pincode, order value,
          line items and order status. When the merchant enables Meta
          Conversions API, the App also receives the customer’s name, email,
          phone, city, province, postal code and country from Shopify and sends
          them to Meta as SHA-256 hashed identifiers.
        </p>
        <p>
          <strong>What we store ourselves.</strong> The App does not keep a
          customer profile, address book or order history. The only
          customer-level record stored by the App is a short-lived one-time
          passcode (OTP) record containing the phone number and code. Order
          notes and tags are written to the merchant’s Shopify admin, not to the
          App’s database.
        </p>
        <p>
          <strong>Technical data.</strong> Standard server logs (request path,
          time, status) without customer names, phone numbers or OTP codes.
        </p>
      </section>

      <section style={section}>
        <h2 style={h2}>3. Why we process it</h2>
        <ul style={list}>
          <li>To provide the App’s features and save the merchant’s settings.</li>
          <li>To verify a customer’s phone before a Partial COD order.</li>
          <li>To calculate and record the advance deposit and cash balance.</li>
          <li>
            To send purchase conversion events to the merchant’s own Meta
            dataset, only when the merchant configures it.
          </li>
          <li>To provide support and investigate errors or abuse.</li>
        </ul>
      </section>

      <section style={section}>
        <h2 style={h2}>4. Legal basis and consent</h2>
        <p>
          The merchant installs the App and configures its features. Customers
          choose Partial COD and provide their phone number for verification.
          Meta tracking is off unless the merchant enters their own Pixel ID and
          access token. The merchant is responsible for obtaining any consent
          required in their jurisdiction for marketing and conversion tracking.
        </p>
      </section>

      <section style={section}>
        <h2 style={h2}>5. Sharing and subprocessors</h2>
        <ul style={list}>
          <li><strong>Shopify</strong> — the platform the App runs on.</li>
          <li><strong>Neon</strong> — managed PostgreSQL database, encrypted at rest.</li>
          <li><strong>Render</strong> — application hosting.</li>
          <li>
            <strong>SMS/WhatsApp provider</strong> — chosen and configured by the
            merchant, used only to deliver verification codes.
          </li>
          <li>
            <strong>Meta Platforms</strong> — only when the merchant enables
            Conversions API; identifiers are hashed before transmission.
          </li>
        </ul>
        <p>
          We do not sell, rent or share data with data brokers or advertisers.
          We do not use customer data for our own marketing.
        </p>
      </section>

      <section style={section}>
        <h2 style={h2}>6. Retention</h2>
        <ul style={list}>
          <li>
            <strong>OTP records:</strong> valid for 10 minutes. Expired records
            are deleted automatically on the next OTP request or when the
            merchant opens the App.
          </li>
          <li>
            <strong>Settings and sessions:</strong> kept while the App is
            installed. Sessions are deleted on uninstall; all shop data is
            deleted when Shopify sends the mandatory <code>shop/redact</code>{" "}
            request (48 hours after uninstall).
          </li>
          <li>
            <strong>Customer redaction:</strong> on a{" "}
            <code>customers/redact</code> request we delete the OTP record for
            that phone number.
          </li>
          <li>
            <strong>Order and customer data:</strong> remains in the merchant’s
            Shopify admin under the merchant’s own retention policy.
          </li>
        </ul>
      </section>

      <section style={section}>
        <h2 style={h2}>7. Security</h2>
        <p>
          Data is encrypted in transit with TLS and at rest by our managed
          database provider. Access is limited to the developer maintaining the
          App, secrets are stored in environment variables, and logs do not
          contain OTP codes or customer contact details.
        </p>
      </section>

      <section style={section}>
        <h2 style={h2}>8. Your rights</h2>
        <p>
          Merchants can request access, correction or deletion of their store
          data by contacting us. Customers can exercise their rights through the
          merchant’s store; the merchant can forward a{" "}
          <code>customers/data_request</code> or <code>customers/redact</code>{" "}
          request through Shopify, which the App handles automatically.
        </p>
      </section>

      <section style={section}>
        <h2 style={h2}>9. International transfers</h2>
        <p>
          Our hosting and database providers may process data outside the
          merchant’s country. Transfers rely on the providers’ standard
          contractual safeguards and encryption.
        </p>
      </section>

      <section style={section}>
        <h2 style={h2}>10. Changes</h2>
        <p>
          We may update this policy as the App changes. The “last updated” date
          above always reflects the current version.
        </p>
      </section>

      <section style={section}>
        <h2 style={h2}>11. Contact</h2>
        <p>
          Questions or data requests:{" "}
          <strong>support@minimaledit.co</strong>
        </p>
      </section>
    </div>
  );
}
