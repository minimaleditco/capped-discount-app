# Capped Discount & Partial COD Suite — Comprehensive Project Context & Architecture

> **Purpose of this document:**  
> This file contains the complete architectural blueprint, business rules, solved edge cases, directory map, and conversational context for the **Capped Discount & Partial COD Suite**. Any developer, AI agent (e.g. Claude Code, OpenCode, Cursor, Aider), or external tool reading this file will immediately have 100% full context of the codebase and its evolution.

---

## 1. Project Overview & Business Mission

- **App Name:** Capped Discount & Partial COD Suite
- **GitHub Repository:** `https://github.com/minimaleditco/capped-discount-app` (Branch: `main`)
- **Hosting URL:** `https://capped-discount-app.onrender.com`
- **Shopify Extension Version:** Version 27 (`capped-discount-cod-fee-27`)
- **Client ID:** `2c334cb8162a93e88de39958c51ff783`

### The Problem Solved
1. **Uncapped Discounts Kill Margins:** Standard Shopify percentage discounts (e.g. 50% OFF) destroy profitability on large carts.
2. **Doorstep Rejection (RTO) Kills COD:** Pure Cash-on-Delivery orders in India and emerging markets suffer 30–40% doorstep customer rejection.
3. **Broken Pixel ROAS:** When collecting a partial deposit online (e.g. ₹108 on a ₹1,080 cart), standard browser tracking pixels report only ₹108 to Meta, causing reported ROAS to drop by 90%.
4. **Accidental Full Refunds:** When a merchant cancels a partial COD order in standard Shopify admin, Shopify attempts to refund the full order value (including the unpaid doorstep cash balance), causing merchant capital loss.

---

## 2. Core Feature Pillars & Technical Implementations

### Pillar 1: Capped Percentage Discounts
- **Location:** `extensions/capped-discount-order` (Rust WebAssembly) & `app/routes/app.discounts.*`
- **Mechanism:** Shopify Function `order-discount` compiled to WASM. Executes natively inside Shopify's checkout engine in <5ms.
- **Formula:**
  $$\text{Eligible Discount} = \min\left(\text{Subtotal} \times \frac{\text{percentage}}{100}, \text{maxCapAmount}\right)$$
- Supports both **Automatic** and **Code-based** discounts, plus minimum cart subtotal gates (`minSubtotal`).

### Pillar 2: Flexible Partial COD & Advance Deposit Engine
- **Location:** `app/routes/app.cod.tsx`, `app/routes/api.partial-cod.draft-checkout.tsx`
- **Mechanism:**
  - Merchant selects either **Percentage Deposit** (e.g., 10%) or **Fixed Rupee Deposit** (e.g., ₹100).
  - Front-end fast checkout modal computes deposit strictly on the **discounted cart total** (e.g. ₹1,200 cart - ₹120 coupon = ₹1,080 net total $\rightarrow$ 10% deposit = ₹108, doorstep balance = ₹972).
  - Draft Order API uses `priceOverride` on line items to charge the customer **only** the advance deposit at Shopify Checkout / Razorpay / UPI.
  - The unpaid balance is stored in draft order custom attributes (`_partial_cod: true`, `_deposit_amount: 108.00`, `_cod_balance_due: 972.00`, `_total_order_amount: 1080.00`).

### Pillar 3: Dynamic Risk-Based Deposit Rules Engine
- **Location:** `app/routes/app.deposit-rules.tsx`, `services/deposit-rules.server.ts`
- **Mechanism:** Evaluates cart parameters sequentially based on priority before defaulting to store setting:
  1. **Pincode Prefix:** High-RTO zones (e.g., 110, 800) trigger higher deposit requirements (e.g., 25%).
  2. **Cart Value:** Orders exceeding a threshold (e.g., >₹5,000) trigger flat or higher deposit.
  3. **Product SKU:** Custom, fragile, or made-to-order items require larger commitments (e.g., 50%).

### Pillar 4: WhatsApp & SMS OTP Pre-Checkout Verification
- **Location:** `app/routes/api.partial-cod.otp.tsx`, `services/whatsapp.server.ts`
- **Mechanism:**
  - E.164 phone sanitization (handles +91, stripped spaces, leading zeros).
  - Generates secure 6-digit OTP with 5-minute expiry and rate-limiting.
  - Dual modes: **Simulator Mode** (logs OTP to terminal and response payload for zero-cost testing) & **Live Providers** (Twilio, Interakt).
  - UI features an authentic shadcn/ui `InputOTP` component with auto-focus shifting, backspace navigation, and copy-paste support.

### Pillar 5: Courier Cash Dunning Reminders
- **Location:** `app/routes/webhooks.tsx`, `services/whatsapp.server.ts`
- **Mechanism:** Webhook `fulfillments/update` listens for "Out for Delivery" status. Automatically sends a morning WhatsApp reminder alerting the buyer to have the exact cash balance ready.

### Pillar 6: Meta Conversions API (CAPI) Server-Side ROAS Defense
- **Location:** `app/routes/webhooks.tsx`, `services/meta-capi.server.ts`
- **Mechanism:**
  - Webhook `orders/create` intercepts Partial COD orders.
  - Recovers the full cart value (`_total_order_amount`, e.g. ₹1,080) rather than just the deposit (₹108).
  - Normalizes and SHA-256 hashes customer PII (email, phone, address).
  - Dispatches `Purchase` event directly to Meta Graph API (`v19.0`) to protect Facebook ad optimization and ROAS reporting.
  - Tags order in Shopify Admin with `Meta CAPI Reported`.

### Pillar 7: 1-Click Safe Deposit Refunds & Restock Support
- **Location:** `app/routes/app.orders.tsx`, `services/refunds.server.ts`
- **Mechanism:**
  - Admin dashboard displaying all Partial COD orders with financial balance cards.
  - **Deposit Guard:** Atomic GraphQL mutation calling `refundCreate` strictly for the online deposit amount (₹108.00).
  - Guarantees the unpaid doorstep cash balance (₹972.00) is never refunded.
  - Automatically restocks inventory line items and updates order status to `CANCELLED`.
  - Enforces idempotency to block duplicate refund triggers.

### Pillar 8: Storefront UI & Coupon Drawer (Shadcn/UI Design)
- **Location:** `extensions/partial-cod-theme/assets/fast-checkout.*`
- **Mechanism:**
  - Injected via Theme App Extension app embed.
  - Auto-evaluates active store coupons, automatically applies the highest discount deal, and renders a slide-down savings banner.
  - Pull-down/tap coupon drawer renders:
    1. **Currently Applied Deal** (green badge).
    2. **Alternative Available Deals** (with 1-click "Apply" button).
    3. **Locked / Ineligible Deals** (displays exact "Add ₹X more to unlock" shortfall).

### Pillar 9: Merchant Command Center & Navigation
- **Location:** `app/routes/app.home.tsx`, `app/routes/app.tsx`
- **Mechanism:**
  - Root landing page (`rel="home"`) inside Shopify App Bridge `NavMenu`.
  - Real-time store performance statistics (active discounts, deposit %, rules count, rupee deposits collected).
  - 5-step onboarding progress bar (0–100%).
  - 6 feature breakdown cards with illustrations (`public/*.jpg`).
  - 6-step buyer journey workflow grid.

---

## 3. Directory Map & Key Files

```
├── app/
│   ├── graphql/
│   │   ├── mutations.ts               # Capped discount create/update, tags, refund mutations
│   │   └── queries.ts                 # Discount query, metafield retrieval
│   ├── routes/
│   │   ├── api.partial-cod.draft-checkout.tsx  # Creates draft orders with priceOverride deposit lock
│   │   ├── api.partial-cod.otp.tsx             # 6-digit OTP generation, verification & simulator
│   │   ├── app._index.tsx                      # Discounts list view with status badges
│   │   ├── app.cod.tsx                         # Partial COD configuration dashboard
│   │   ├── app.deposit-rules.tsx               # Dynamic risk-based deposit rules engine
│   │   ├── app.discounts.$id.tsx               # Discount detail & editor
│   │   ├── app.discounts.new.tsx               # Capped discount creator
│   │   ├── app.home.tsx                        # Feature overview landing page & store statistics
│   │   ├── app.orders.tsx                      # Orders & Support dashboard with 1-click refund
│   │   ├── app.tsx                             # App Bridge Layout & Navigation Menu
│   │   ├── privacy.tsx                         # GDPR & App Store privacy policy
│   │   └── webhooks.tsx                        # GDPR, orders/create, fulfillments/update handlers
│   ├── services/
│   │   ├── deposit-rules.server.ts             # Risk rule evaluator
│   │   ├── meta-capi.server.ts                 # Server-side Meta CAPI dispatcher
│   │   ├── refunds.server.ts                   # Deposit guard & atomic refund/restock logic
│   │   └── whatsapp.server.ts                  # WhatsApp OTP & dunning dispatcher
│   ├── db.server.ts                            # Prisma database client
│   └── shopify.server.ts                       # Shopify app authentication & GraphQL client
├── extensions/
│   ├── capped-discount-order/                  # Shopify Function (WASM) for capped discounts
│   └── partial-cod-theme/                      # Theme App Extension (fast-checkout modal, assets)
├── prisma/
│   ├── schema.prisma                           # Session, PartialCodSettings, DepositRule models
│   └── dev.db                                  # SQLite local database
├── public/
│   ├── app-icon.jpg                            # 1200x1200px app icon
│   ├── partial-cod-feature.jpg                 # Split payment illustration
│   ├── promo-banner.jpg                        # Discount banner
│   └── whatsapp-otp-feature.jpg                # WhatsApp OTP illustration
├── test/
│   ├── deposit-rules.test.ts                   # 5 unit tests
│   ├── meta-capi.test.ts                       # 4 unit tests
│   ├── order-refunds.test.ts                   # 6 unit tests
│   └── whatsapp-otp.test.ts                    # 7 unit tests
├── shopify.app.toml                            # App configuration, scopes, webhooks
└── package.json                                # Scripts & dependencies
```

---

## 4. Solved Edge Cases & Lessons Learned

1. **The Deposit Price Lock Bug (Solved):**
   *Problem:* Standard Shopify checkout recalculates full product price on draft orders, charging the customer full price.  
   *Solution:* In `api.partial-cod.draft-checkout.tsx`, we calculate the exact per-item deposit ratio and set `appliedDiscount` / `priceOverride` so Shopify checkout charges **strictly the advance deposit**.
2. **Deposit Calculation on Discounted Total (Solved):**
   *Problem:* Computing 10% deposit on an original ₹1,200 cart rather than the ₹1,080 discounted cart overcharged customers.  
   *Solution:* Always apply the active coupon first, then calculate deposit = `NetTotal * (percentage / 100)`.
3. **Double Refund Danger (Solved):**
   *Problem:* Refunding an order normally in Shopify admin refunds unpaid COD cash.  
   *Solution:* Deposit Guard in `refunds.server.ts` calculates maximum refundable = `_deposit_amount` and marks restocked line items cleanly.
4. **Scope Desynchronization (Solved):**
   *Problem:* When adding `write_orders` or `write_draft_orders`, cached tokens caused 403 Forbidden.  
   *Solution:* Automatic scope inspection in `app.tsx` catches missing scopes and forces re-authentication seamlessly.

---

## 5. Development & Testing Commands

```bash
# 1. Run all unit tests (34 tests covering discounts, CAPI, refunds, rules, OTP)
npm test

# 2. Build for production (Prisma client + Remix Vite build)
npm run build

# 3. Start local development server with Shopify CLI
npm run dev

# 4. Deploy extension updates to Shopify
npm run deploy
```

---

## 6. Prompt to Prime Any AI Agent (OpenCode / Claude Code / Cursor)

Copy and paste this snippet into any external AI coding assistant:

```markdown
You are working on the "Capped Discount & Partial COD Suite" Shopify application.
Read the full architecture and history in PROJECT_CONTEXT.md before writing code.
Key rules to remember:
1. All capped percentage discounts are computed via the Shopify Function in extensions/capped-discount-order.
2. Advance deposits for Partial COD must ALWAYS be calculated on the net discounted subtotal, never on undiscounted total.
3. Draft checkout line items use priceOverride to charge strictly the online deposit, preserving full value in order attributes.
4. One-click cancellations must refund strictly the online deposit, restock items, and never refund unpaid doorstep cash.
5. Meta CAPI sends full cart value (_total_order_amount) with SHA-256 hashed customer PII.
6. Run `npm test` after any change (all 34 tests must pass).
```
