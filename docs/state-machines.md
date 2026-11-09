# State machines

This app has several behaviours that are, in practice, state machines. Some were
implicit: the state lived in a combination of Shopify fields, tags, local
variables or database columns, and every screen re-derived it with its own
`if` statements. That is how contradictory UI appears ("Cancelled" but no
refund, "Delivered" but refundable) and how regressions slip through review.

`app/services/state-machines.ts` is the single source of truth for the machines
that are safe to formalize today. It is a pure module: no Prisma, no Shopify, no
React. `test/state-machines.test.ts` covers every transition.

## Rules

1. **One owner per state.** A screen may format a state, never recompute it.
2. **Derive, don't store.** If Shopify already stores the truth (order tags,
   discount status), derive from it. Do not add a second copy that can drift.
3. **No string comparisons in routes.** Compare against the typed state, not
   `tags.includes("...")`.
4. **Illegal transitions are bugs.** `canTransition*` exists so tests and future
   guards can assert them.
5. **Shopify-owned states are read-only.** The app never invents a discount
   status or rewrites an order's financial status.

## Inventory

| # | Machine | Stored in | States | Decision |
|---|---|---|---|---|
| 1 | Deposit order lifecycle | Shopify order fields + tags | 6 | **Formalized** |
| 2 | OTP verification session | `OtpSession` row + memory fallback | 6 | **Formalized** |
| 3 | Discount lifecycle | Shopify discount `status` | 5 | **Mapped** |
| 4 | Setup / onboarding | Derived from 3 counters | 3 | **Formalized** |
| 5 | Storefront checkout flow | Widget local variables | 7 | Documented only |
| 6 | Shopify session / token | `Session` row | 3 | Documented only |
| 7 | Consent + Meta CAPI | Order attributes + tags | 3 + 2 | Documented only |
| 8 | Refund request | UI + service | 4 | Documented only |
| 9 | Webhook processing | Event payload | 4 | Documented only |
| 10 | Deposit rule evaluation | `DepositRule` rows | n/a | Decision table, not a machine |

---

## 1. Deposit order lifecycle — formalized

**Owner:** `deriveDepositLifecycle()`
**Used by:** order list badge (`app/routes/app.orders.tsx`), `formatShopifyOrder()`

```
                 ┌──────────────┐
   order paid ──▶│ DEPOSIT_PAID │
                 └──┬───┬───┬───┘
        fulfilled   │   │   │   cancelled + refunded
                    ▼   │   ▼
              ┌─────────┐ │ ┌────────────────────┐
              │COMPLETED│ │ │ CANCELLED_REFUNDED │◀── terminal
              └────┬────┘ │ └────────────────────┘
                   │      │            ▲
        refunded   │      │ cancelled  │
                   ▼      ▼            │
              ┌─────────┐ ┌──────────┐ │
              │REFUNDED │ │CANCELLED │─┘
              └────┬────┘ └──────────┘
                   └──────► CANCELLED_REFUNDED
```

| From | Allowed next |
|---|---|
| `DEPOSIT_PAID` | `COMPLETED`, `CANCELLED`, `REFUNDED`, `CANCELLED_REFUNDED` |
| `COMPLETED` | `REFUNDED`, `CANCELLED_REFUNDED` |
| `CANCELLED` | `CANCELLED_REFUNDED` |
| `REFUNDED` | `CANCELLED_REFUNDED` |
| `CANCELLED_REFUNDED` | — |
| `UNKNOWN` | — |

**Precedence:** cancellation and refunds win over fulfilment, matching the
existing list behaviour. A refund only counts when it covers the recorded
deposit (`totalRefunded >= depositAmount`), so a partial goodwill refund does not
flip the state.

**Invariants**

- `REFUNDED` requires a deposit greater than zero.
- `COMPLETED` never hides a later refund; the state moves on.
- Tags are still written exactly as before (`Partially Paid`, `Partial COD`,
  `Deposit Refunded: …`) because webhooks and merchants depend on them. The
  machine reads fields, it does not change what is written.

---

## 2. OTP verification session — formalized

**Owner:** `deriveOtpLifecycle()`
**Storage:** `OtpSession` (`verified`, `attempts`, `expiresAt`) with an in-memory
fallback used when the database is unavailable.

```
IDLE ──send──▶ PENDING ──verify──▶ VERIFIED ──used──▶ CONSUMED (terminal)
                 │  │                     │
        attempts │  └──TTL──▶ EXPIRED ◀───┘ TTL
        exhausted▼              │
              LOCKED ──send (new code)──▶ PENDING
```

**Known conflation, documented on purpose:** the row has one `expiresAt`. While
`verified = false` it is the 5-minute code TTL; once verified it is rewritten to
the 30-minute token TTL. The `verified` flag decides how to read it. Fixing this
properly needs a schema change (`codeExpiresAt` + `verifiedExpiresAt`), which is
not worth the migration risk during review. The derivation function applies the
rule once so callers cannot get it wrong.

**`CONSUMED`:** a verified token is single-use. It is burned only after
`draftOrderCreate` returns an invoice URL. If pricing, OTP validation or draft
creation fails, the token stays usable so the shopper can retry. The draft
checkout also reuses the same idempotency key for that retry, so a failure after
the invoice was created returns the existing invoice instead of asking for a new
code.

---

## 3. Discount lifecycle — mapped, not owned

Shopify owns the state (`ACTIVE`, `SCHEDULED`, `EXPIRED`, `DEACTIVATED`). The app
maps it to one label/tone with `deriveDiscountLifecycle()`. Unknown statuses keep
their raw label instead of rendering blank.

The app never writes a status. Creating, scheduling and expiring happen through
the Shopify Admin API, so there is no duplicate state to drift.

---

## 4. Setup progress — formalized

Three core steps: capped discount, Partial COD enabled, at least one deposit
rule. `deriveSetupLifecycle(completed, 3)` returns
`NOT_STARTED | IN_PROGRESS | COMPLETE`, the clamped count and the percentage.

OTP and Meta CAPI are deliberately excluded: they are optional and must not make
a complete setup look incomplete.

---

## 5. Storefront checkout flow — documented only

**Why not rewritten:** this machine lives in `theme-src/fast-checkout.source.js`
as a handful of variables (`activeMode`, `activeCoupon`, `verifiedToken`,
`storeOffers.quote`, pincode validity). It is the most user-facing code in the
app and the riskiest thing to restructure while the app is in review. The
contract below is what the current code implements; a future refactor can move
it to an explicit reducer without changing behaviour.

```
IDLE
 ├─ open popup ─────────────▶ QUOTING
 │                              │ quote ok
 │                              ▼
 │                            READY ──pincode change──▶ QUOTING
 │                              │
 │                     OTP required?
 │                        │ yes        │ no
 │                        ▼            │
 │                  OTP_REQUIRED       │
 │                        │ verify     │
 │                        ▼            │
 │                   VERIFYING ────────┘
 │                              │
 │                              ▼
 │                          SUBMITTING ──error──▶ ERROR ──retry──▶ READY
 │                              │ ok
 │                              ▼
 │                        redirect to Shopify invoice
```

**Invariants**

- The popup never computes a deposit locally when a fresh server quote exists.
- A quote is fresh only when its `subtotal` matches the cart it was requested for.
- `SUBMITTING` disables both payment buttons; a second click cannot create a
  second draft order in the same tab.
- Pincode validation runs before OTP and before submission.
- Currency always comes from the quote / Shopify, never from a hard-coded symbol.

**Gaps**

- ~~No idempotency key~~ — the widget now generates one key per modal open and
  reuses it for retries; the server stores the finished response in
  `CheckoutRequest` for 24 hours and returns it on a replay.
- Quantity is capped at 99 server-side.
- Presentment currency is not passed to the draft order.

---

## 6. Shopify session / token — documented only

`Session` rows carry an access token and an expiry. `unauthenticated.admin(shop)`
refreshes an expired token using the offline refresh token. States:
`VALID`, `EXPIRING` (near expiry), `EXPIRED` (refresh attempted). There is no
user-visible UI for these states, so an explicit machine would not improve UX;
the existing recovery path is enough. Any future change must keep the
"open the app once to re-authenticate" error message, which is what merchants
and reviewers see today.

---

## 7. Consent + Meta CAPI — documented only

Consent values: `GRANTED`, `DENIED`, `UNKNOWN`, written to the order attribute
`Marketing Consent`. Dispatch only happens on `GRANTED`; otherwise the order is
tagged `Meta CAPI Skipped: Consent`, and on success `Meta CAPI Reported`. The
values are normalized on read by `normalizeConsent()`; the attribute keeps the
lower-case form Shopify/webhooks already expect.

---

## 8. Refund request — documented only

`canRefund` (deposit > 0, not fully refunded, a successful transaction exists)
gates the modal. The service then moves the order to `REFUNDED` or
`CANCELLED_REFUNDED` and writes the tag `Deposit Refunded: <amount>`. The modal
disables while submitting. The lifecycle machine is the read model; the service
remains the write model.

---

## 9. Webhook processing — documented only

`orders/create` → detect Partial COD tags → read consent → send CAPI (if
granted) → tag `Meta CAPI Reported` / `Skipped: Consent`. Shopify retries failed
webhooks; the app does not keep a retry state, and the tags make the outcome
observable. Idempotency comes from the tags themselves.

---

## 10. Deposit rule evaluation — not a state machine

Rules are a priority-ordered decision table, not a lifecycle. For a given cart:
filter active rules, evaluate in descending priority, first match wins, otherwise
the store default applies. Documented here so nobody models it as mutable state.

---

## Shopify policy guardrails

- No new access scopes, no new customer data, no new third-party calls.
- The machines are pure functions; they do not change what is written to
  Shopify, so the privacy policy and data-protection doc remain accurate.
- Order tags and attributes keep their existing names and formats, so webhooks,
  refunds and merchant workflows are unaffected.
- Discount statuses are read from Shopify, never overwritten.

## Extending a machine (DX/AX checklist)

1. Add the state to the union in `app/services/state-machines.ts`.
2. Add its label/tone and its row in the transition table.
3. Add one test per legal and per illegal transition in
   `test/state-machines.test.ts`.
4. Wire the UI to the derived label/tone — never to raw tags or statuses.
5. Update this document's diagram and invariants.
