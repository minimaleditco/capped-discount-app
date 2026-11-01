# Data Protection & Security Policy

**App:** Capped Discount & COD Fee  
**Last reviewed:** 2 November 2026  
**Owner:** the developer maintaining the app (single-person organisation)

This document supports the Shopify protected customer data access request and
describes how the app handles personal data.

## 1. Data inventory

| Data | Where it lives | Purpose | Retention |
|---|---|---|---|
| Store domain, offline access tokens | Neon `Session` | Authenticate Admin API calls | Until uninstall; deleted on `app/uninstalled` |
| App settings (deposits, rules, SMS/WhatsApp config, Meta pixel + token) | Neon `PartialCodSettings`, `DepositRule` | Provide the app features | Until `shop/redact` |
| OTP phone number + code | Neon `OtpSession` | Verify the customer before a Partial COD order | 10 minutes; expired rows pruned on each OTP request and on admin load |
| Delivery pincode, deposit/balance, rule label | Shopify order tags/notes (not the app DB) | Merchant support and cash collection | Merchant's Shopify retention |
| Customer name/email/phone/city/zip | Not stored; read from Shopify and SHA-256 hashed for Meta CAPI | Merchant's own ad attribution | Not retained by the app |
| Server logs | Render | Diagnostics and abuse prevention | 7 days (provider default); no OTP codes or contact details |
| Access log | Neon `AuditLog` | Record app actions that touch customer data (shop, action, time only) | 90 days |

The app does not store customer profiles, addresses, order history, or payment
card data.

## 2. Data minimisation

- Only the phone number and a 10-minute code are stored for verification.
- Meta CAPI identifiers are hashed before leaving the app.
- OTP codes are never written to logs.
- No analytics SDKs, tracking pixels, or third-party advertising code runs in
  the app.

## 3. Encryption

- In transit: HTTPS/TLS for Shopify, the admin UI, the storefront API and the
  database connection (`sslmode=require`).
- At rest: Neon managed PostgreSQL storage encryption; provider-managed
  encrypted backups.
- Secrets: environment variables in Render; never committed to git.

## 4. Access control

- One developer has access to Render, Neon and the Shopify app configuration.
- Strong passwords and two-factor authentication are enabled on Shopify,
  GitHub, Render and Neon.
- No shared accounts, no staff or contractor access.
- The app has no bulk export feature; data is viewed only through the admin UI
  for support.

## 5. Logging

- Application logs contain topic, store domain, status codes and error
  messages.
- They never contain OTP codes, phone numbers, emails, names or addresses.
- Access to provider dashboards is limited to the owner and protected by 2FA.
- **Access log:** every app action that touches customer data is recorded in
  `AuditLog` with the shop, action and timestamp — never the customer fields.
  Events: order list view, refund, OTP send/verify, draft checkout creation and
  Meta CAPI dispatch. Entries older than 90 days are deleted automatically.

## 6. Data loss prevention

- No production data is copied to laptops or third-party services.
- Local development and automated tests use a separate SQLite database, not
  the production Neon database.
- The production database is reachable only with the connection string stored
  in Render's encrypted environment variables.
- Destructive database operations are scoped by shop.
- Backups are managed and encrypted by Neon; restores are performed through the
  provider console.

## 7. Retention and deletion

- OTP rows: deleted when expired (on the next OTP request or admin load).
- `app/uninstalled`: sessions deleted immediately.
- `shop/redact`: every row for the shop is deleted (`Session`,
  `PartialCodSettings`, `DepositRule`, `PartialCodDeposit`, `DiscountSavings`,
  `OtpSession`).
- `customers/redact`: OTP and deposit rows matching the customer's phone are
  deleted.
- `customers/data_request`: the app holds no persistent customer profile; the
  request is acknowledged and expired OTP rows are pruned.

## 8. Incident response

1. **Detect** — provider alerts, error monitoring, or a merchant report.
2. **Contain** — revoke the Shopify client secret and rotate Render/Neon
   credentials; take the app offline if customer data is at risk.
3. **Assess** — identify affected stores, data categories and time window.
4. **Notify** — inform Shopify and affected merchants without undue delay; where
   GDPR applies, notify the supervisory authority within 72 hours if required.
5. **Remediate** — patch the cause, rotate secrets, deploy, and verify.
6. **Document** — keep a short incident record (cause, impact, actions, dates)
   for at least 12 months.

## 9. Subprocessors

| Provider | Role | Safeguards |
|---|---|---|
| Shopify | Platform and merchant admin | Shopify DPA |
| Neon | Managed PostgreSQL | Encryption at rest, encrypted backups |
| Render | Application hosting | TLS, encrypted environment variables |
| SMS/WhatsApp provider | OTP delivery (merchant-configured) | Provider DPA |
| Meta Platforms | Conversions API (merchant-configured) | Hashed identifiers only |

## 10. Review

This policy is reviewed whenever the app's data handling changes and at least
once a year.
