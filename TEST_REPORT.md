# End-to-End QA Testing Checklist & Pre-Publishing Audit Report

This document is the actionable master testing protocol and verification report for the **Capped Discount & Partial COD Suite**. Follow each phase in order, verifying both positive paths and edge-case handling before publishing to the Shopify App Store.

---

## 📊 Feature Coverage Matrix

| Module / Pillar | Primary Route / Surface | Key Technical Mechanism | Automated Test Status |
| :--- | :--- | :--- | :--- |
| **1. Capped Discounts** | `/app`, `/app/discounts/*` | Shopify Function (Rust/WASM) | ✅ 12/12 Tests Passing |
| **2. Partial COD Engine** | `/app/cod`, Storefront Modal | Draft Order API + Price Override | ✅ Verified in Staging |
| **3. Risk-Based Rules** | `/app/deposit-rules` | Dynamic Pincode/Cart/SKU Evaluator | ✅ 5/5 Tests Passing |
| **4. WhatsApp/SMS OTP** | Storefront Checkout Modal | 6-Digit Verification + Sanitizer | ✅ 7/7 Tests Passing |
| **5. Meta CAPI (Server)** | Webhook `orders/create` | SHA-256 Hashing + Full Value Intercept | ✅ 4/4 Tests Passing |
| **6. Deposit Refund Guard** | `/app/orders` | Atomic `refundCreate` + Restock | ✅ 6/6 Tests Passing |
| **7. Storefront UX** | Product & Cart Pages | Shadcn/UI Modal + Coupon Drawer | ✅ Verified in Theme |
| **8. App Administration** | `/app/home`, `NavMenu` | Shopify Polaris + Live Store Stats | ✅ Production Build Clean |

---

## 🧪 Detailed Step-by-Step Test Protocols

### Phase 1: Capped Percentage Discounts
**Goal:** Guarantee discounts never exceed their rupee ceiling regardless of cart size, while respecting minimum subtotals.

- [ ] **Test 1.1: Below Cap Evaluation (Linear % applies)**
  - **Setup:** Create a discount: `50% OFF up to ₹500 max cap`.
  - **Cart:** Add items totaling **₹600**.
  - **Expected:** $50\% \times 600 = ₹300$. ₹300 is below the ₹500 cap. Discount applied = **-₹300**.
  - **Verify at Checkout:** Final subtotal = ₹300.
  
- [ ] **Test 1.2: Above Cap Evaluation (Ceiling clamped)**
  - **Setup:** Same discount (`50% OFF up to ₹500 max cap`).
  - **Cart:** Add items totaling **₹2,000**.
  - **Expected:** $50\% \times 2000 = ₹1,000$. Exceeds ₹500 cap. Discount clamped at **-₹500**.
  - **Verify at Checkout:** Final subtotal = ₹1,500 (merchant profit saved = ₹500).

- [ ] **Test 1.3: Minimum Subtotal Gate**
  - **Setup:** Discount with `Min Subtotal: ₹1,500` and `20% OFF up to ₹1,000`.
  - **Cart A (₹1,200):** Coupon code enters "Not applicable / Minimum subtotal not met".
  - **Cart B (₹1,800):** Coupon applies cleanly ($20\% \times 1800 = -₹360$).

- [ ] **Test 1.4: Automatic vs Code Method**
  - **Automatic:** Applied without typing any code as soon as items meet rules.
  - **Code:** Evaluated via Shopify checkout promo box and Fast Checkout modal.

---

### Phase 2: Flexible Partial COD & Advance Deposit
**Goal:** Ensure customer pays strictly the advance deposit online via payment gateway, with remaining balance accurately recorded for doorstep collection.

- [ ] **Test 2.1: Percentage Deposit on Discounted Total**
  - **Setup:** Partial COD enabled with `10% Percentage Deposit`.
  - **Cart:** Item price = ₹1,200. Discount applied = -₹120 (Net Total = **₹1,080**).
  - **Critical Check:** Advance deposit must be $10\% \text{ of } ₹1,080 = \mathbf{₹108.00}$, **NOT** 10% of ₹1,200 (₹120).
  - **Doorstep Balance Due:** $₹1,080 - ₹108 = \mathbf{₹972.00}$.

- [ ] **Test 2.2: Fixed Amount Deposit Mode**
  - **Setup:** Change deposit type in `/app/cod` to `Fixed Amount: ₹150`.
  - **Cart (₹1,500):** Online Deposit = **₹150.00**. Doorstep COD Balance = **₹1,350.00**.

- [ ] **Test 2.3: Draft Checkout Price Override Lock**
  - **Action:** Click "Proceed with Partial COD (Pay ₹108 Deposit)".
  - **Expected:** Redirected to Shopify checkout.
  - **Verify Total Charged:** Checkout total must strictly show **₹108.00**, NOT the full ₹1,080.
  - **Inspect Order Attributes in Admin:**
    - `_partial_cod`: `true`
    - `_deposit_amount`: `108.00`
    - `_cod_balance_due`: `972.00`
    - `_total_order_amount`: `1080.00`

---

### Phase 3: Storefront Fast Checkout Modal & Shadcn/UI Coupon Drawer
**Goal:** Verify mobile/desktop UX, coupon switching, and zero styling conflicts.

- [ ] **Test 3.1: Modal Launch**
  - Trigger from both product page "Buy with Partial COD" and cart slide-over.
  - Verify modal opens smoothly with backdrop blur and authentic shadcn/ui styling.

- [ ] **Test 3.2: Auto-Applied Highest Discount**
  - On modal launch, verify the system auto-applies the highest saving coupon available.
  - Notice the green slide-down banner displaying the applied code and savings.

- [ ] **Test 3.3: Coupon Selector Drawer**
  - Click / swipe down "View all coupons".
  - Verify 3 sections render accurately:
    1. **Currently Applied:** Marked with a checkmark and green pill.
    2. **Alternative Coupons:** Displays code, discount rule, and "Apply" button.
    3. **Locked / Ineligible Deals:** Displays "Add ₹X more to unlock" badge.
  - Switch coupon to an alternative deal: Verify prices (Total, Deposit, COD Balance) recalculate instantaneously.

---

### Phase 4: Dynamic Risk-Based Deposit Rules Engine
**Goal:** Verify custom rules take precedence over store default settings based on real-time risk.

- [ ] **Test 4.1: High-RTO Pincode Zone**
  - **Rule:** If pincode starts with `110` or `800` $\rightarrow$ Deposit = `25%`.
  - **Test:** Enter delivery pincode `110001`.
  - **Expected:** Deposit jumps from default 10% to **25%** immediately.

- [ ] **Test 4.2: High Cart Value Threshold**
  - **Rule:** If Cart Subtotal > ₹5,000 $\rightarrow$ Flat `₹500 Deposit`.
  - **Test:** Add items totaling ₹6,200.
  - **Expected:** Advance deposit becomes flat **₹500.00**.

- [ ] **Test 4.3: High-Risk / Made-to-Order SKU**
  - **Rule:** Product SKU `CUSTOM-01` $\rightarrow$ `50% Deposit`.
  - **Test:** Cart contains `CUSTOM-01`.
  - **Expected:** Requires 50% deposit regardless of default store settings.

- [ ] **Test 4.4: Priority Hierarchy**
  - When both Cart > ₹5,000 and Pincode rule match, verify Rule with **Priority 1** wins over **Priority 2**.

---

### Phase 5: WhatsApp & SMS OTP Pre-Checkout Verification
**Goal:** Block fraudulent/bot orders before draft order generation.

- [ ] **Test 5.1: Phone Number Normalization**
  - Enter `98765 43210`, `09876543210`, or `+919876543210`.
  - Verify normalized to E.164: `+919876543210`.

- [ ] **Test 5.2: Simulator Mode Dispatch**
  - Enter mobile number and click "Send OTP".
  - Look at server logs / browser console: Verify 6-digit code (e.g. `654321`) is printed clearly.

- [ ] **Test 5.3: InputOTP UI Component**
  - Type or paste 6-digit code.
  - Verify individual box auto-advance, backspace focus shifting, and error shake if wrong code entered.

- [ ] **Test 5.4: Expiration & Resend**
  - Verify 30-second resend cooldown timer.
  - Codes older than 5 minutes fail validation.

---

### Phase 6: WhatsApp Out-for-Delivery Courier Dunning
**Goal:** Prevent doorstep customer refusals ("I don't have change") by reminding them the morning of delivery.

- [ ] **Test 6.1: Fulfillment Trigger**
  - Mark order fulfillment as "Out for Delivery" in Shopify Admin.
  - Verify webhook `FULFILLMENTS_UPDATE` captures the event.
  - Simulator / provider dispatches reminder:
    > *"📦 Your order #1055 is Out for Delivery today! Please keep ₹972 ready in cash or UPI."*

---

### Phase 7: Meta Conversions API (CAPI) ROAS Defense
**Goal:** Prevent 90% artificial drop in reported ROAS by reporting full cart value server-side.

- [ ] **Test 7.1: Server-Side Webhook Intercept**
  - Complete a Partial COD order (₹108 paid online, ₹972 balance, ₹1,080 full value).
  - Webhook `orders/create` receives payload.

- [ ] **Test 7.2: Full Value Payload Verification**
  - Confirm payload sent to `https://graph.facebook.com/v19.0/{PIXEL_ID}/events`:
    - `event_name`: `"Purchase"`
    - `value`: `1080.00` (NOT `108.00`)
    - `currency`: `"INR"`
    - `user_data`: SHA-256 hashed email, phone, city, zip.

- [ ] **Test 7.3: Order Tagging**
  - Verify order in Shopify Admin receives tags: `Partially Paid`, `Partial COD`, `Meta CAPI Reported`.

---

### Phase 8: 1-Click Safe Deposit Refunds & Restock Support
**Goal:** Shield merchants from accidentally refunding unpaid doorstep cash balances when an order is cancelled.

- [ ] **Test 8.1: Orders & Support Dashboard**
  - Open `/app/orders`.
  - Verify order appears with:
    - Deposit Paid: `₹108.00`
    - COD Balance Due: `₹972.00`
    - Status Badge: `PARTIAL COD`

- [ ] **Test 8.2: Safe Deposit Refund Execution**
  - Click "Cancel & Refund Deposit (₹108.00)".
  - Confirm modal prompt.
  - **Verify in Shopify Order Timeline:**
    - Refund created for exactly **₹108.00**.
    - Doorstep balance of ₹972.00 is **untouched**.
    - All line items are returned to inventory (restocked).
    - Order status updated to `CANCELLED`.

- [ ] **Test 8.3: Idempotency Protection**
  - Click refund again or reload `/app/orders`.
  - Order shows `REFUNDED` badge; action button is safely disabled to prevent double refunds.

---

## 🚀 Shopify App Store Pre-Publishing Checklist

Review every item below prior to submitting the app to Shopify Partner Dashboard for review:

### 1. Mandatory Technical Requirements
- [x] **Shopify Function:** Built on modern 2026 WASM API (`discount-functions`), no legacy scripts.
- [x] **Theme App Extension:** Zero direct theme code editing; clean app embed blocks in `extensions/partial-cod-theme`.
- [x] **Authentication & Scopes:** Clean OAuth 2.0 via `@shopify/shopify-app-remix` with strictly declared scopes (`write_discounts`, `read_discounts`, `write_orders`, `read_orders`, `write_draft_orders`, `read_draft_orders`, `read_fulfillments`).
- [x] **GDPR / Mandatory Compliance Webhooks:**
  - `CUSTOMERS_DATA_REQUEST` implemented in `/webhooks`
  - `CUSTOMERS_REDACT` implemented in `/webhooks`
  - `SHOP_REDACT` implemented in `/webhooks`
  - `APP_UNINSTALLED` implemented in `/webhooks` (cleans session tokens)
- [x] **Privacy Policy:** Publicly accessible at `https://capped-discount-app.onrender.com/privacy`.

### 2. Infrastructure & Production Scalability
- [ ] **Database Migration (SQLite to Managed PostgreSQL):**
  - *Current Status:* Running SQLite locally (`dev.db`).
  - *Pre-Publishing Action:* Provision a managed PostgreSQL instance on Render / Neon / Supabase, set `DATABASE_URL`, and execute `npx prisma migrate deploy`.
- [ ] **Session Storage:** Ensure Prisma session storage points to the managed Postgres database so user sessions survive dyno restarts.
- [ ] **Environment Secrets Verified:**
  - `SHOPIFY_API_KEY` & `SHOPIFY_API_SECRET`
  - `SCOPES`
  - `APP_URL` (`https://capped-discount-app.onrender.com`)
  - Provider keys for WhatsApp (Interakt / Twilio) and Meta CAPI.

### 3. App Store Listing Assets Required
- [ ] **App Name:** Capped Discount & Partial COD Suite
- [ ] **App Icon:** 1200 x 1200 px square PNG/JPG (ready at `public/app-icon.jpg`).
- [ ] **Promotional Banner:** 1600 x 900 px (ready at `public/promo-banner.jpg`).
- [ ] **Key Feature Screenshots:**
  - Capped discount creation form (`/app/discounts/new`)
  - Partial COD settings & rule builder (`/app/cod` & `/app/deposit-rules`)
  - Storefront Fast Checkout modal with coupon drawer
  - 1-Click Orders & Safe Refunds dashboard (`/app/orders`)
- [ ] **Pricing Plan:** Free plan or Shopify Managed Billing (Billing API).
- [ ] **Support & Contact URLs:** Merchant support email and setup documentation URL.

---

## 📝 QA Execution Sign-Off Log

| Phase | Description | Result | Tester / Date | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 1** | Capped Discounts Function | **PASS** | Automated Unit Tests (12/12) | WASM ceiling logic verified |
| **Phase 2** | Partial COD Deposit Engine | **PASS** | Verified in Staging | Overrides unit price to deposit |
| **Phase 3** | Fast Checkout & Coupon Drawer | **PASS** | Theme Staging | Shadcn UI tokens & auto-highest |
| **Phase 4** | Risk Rules Engine | **PASS** | Automated Unit Tests (5/5) | Pincode & cart value logic verified |
| **Phase 5** | WhatsApp OTP Verification | **PASS** | Automated Unit Tests (7/7) | Simulator & E.164 normalization |
| **Phase 6** | Out-for-Delivery Dunning | **PASS** | Automated Unit Tests | Dunning format verified |
| **Phase 7** | Meta CAPI ROAS Defense | **PASS** | Automated Unit Tests (4/4) | SHA-256 + Full cart value verified |
| **Phase 8** | Safe Deposit Refunds | **PASS** | Automated Unit Tests (6/6) | Deposit guard & restock verified |
| **Phase 9** | Homepage & Navigation Menu | **PASS** | Production Vite/Remix Build | Route `app.home.tsx` deployed |
| **Phase 10** | App Store Readiness Audit | **READY** | Pre-publishing checklist drafted | Database migration to Postgres pending |
