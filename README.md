# Capped Discount App

A production-ready Shopify app built with Remix and Shopify Functions that empowers merchants to configure **percentage-based discounts with a hard maximum monetary cap** (e.g., *"80% OFF up to ₹200"*).

Traditional Shopify percentage discounts offer no built-in mechanism to limit the absolute monetary value subtracted on large carts. This app bridges that gap using modern Shopify Functions (Cart and Checkout Validation / Order Discounts API), ensuring merchant margins remain protected while running compelling promotional campaigns.

---

## Table of Contents

- [Overview & Value Proposition](#overview--value-proposition)
- [How Discount Cap Logic Works](#how-discount-cap-logic-works)
  - [Example Scenario](#example-scenario)
  - [Mathematical Formula](#mathematical-formula)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Scaffolding Reference](#scaffolding-reference)
- [Project Structure](#project-structure)
- [Local Setup & Installation](#local-setup--installation)
- [Configuration & Environment Variables](#configuration--environment-variables)
- [Extension Deployment](#extension-deployment)
- [GraphQL Operations Reference](#graphql-operations-reference)
  - [Mutations](#mutations)
  - [Queries](#queries)
- [Security & Performance](#security--performance)

---

## Overview & Value Proposition

- **Hard Monetary Ceiling**: Offer steep percentage promotions (e.g., 50%, 80%) to maximize conversion rates while guaranteeing that the discount never exceeds a designated threshold (e.g., ₹200 or $25).
- **Dual Method Support**: Deploy as a customer-entered **Discount Code** or an **Automatic Discount** triggered at checkout.
- **Minimum Order Subtotal Protection**: Restrict eligibility until a minimum cart order threshold is satisfied.
- **Shopify Functions Powered**: Executes in sub-5ms WebAssembly runtime on Shopify's global edge infrastructure without relying on external API callbacks during checkout.
- **Shopify Polaris Design System**: Clean, accessible merchant admin interface seamlessly integrated with Shopify Admin.

---

## How Discount Cap Logic Works

### Example Scenario

Consider an aggressive merchant flash sale with the following rule:
- **Promotion**: 80% discount
- **Cap**: Maximum discount of ₹200
- **Minimum Subtotal Required**: ₹500

| Cart Subtotal | Uncapped 80% Discount | App Applied Discount | Customer Pays | Margin Protection |
| :--- | :--- | :--- | :--- | :--- |
| **₹400** | ₹320 | **₹0** | ₹400 | Subtotal below ₹500 minimum requirement |
| **₹1,000** | ₹800 | **₹200** *(Capped)* | ₹800 | **₹600 saved** by cap |
| **₹2,500** | ₹2,000 | **₹200** *(Capped)* | ₹2,300 | **₹1,800 saved** by cap |
| **₹200** *(if min subtotal met)* | ₹160 | **₹160** | ₹40 | Percentage discount is below ₹200 cap |

### Mathematical Formula

For eligible carts meeting the `minSubtotal` condition:

$$\text{Calculated Discount} = \text{Cart Subtotal} \times \left(\frac{\text{percentage}}{100}\right)$$

$$\text{Final Discount} = \min(\text{Calculated Discount}, \text{maxCapAmount})$$

This computation is executed natively inside the Shopify Function run function and written to the cart discount targets.

---

## Tech Stack

- **Framework**: [Remix](https://remix.run/) (v2.x with Vite)
- **App SDK**: `@shopify/shopify-app-remix` (v3.x)
- **Design System**: [Shopify Polaris](https://polaris.shopify.com/) (v13.x) & `@shopify/app-bridge-react`
- **Engine**: [Shopify Functions](https://shopify.dev/docs/apps/functions) (Order Discount API / Cart Transform API)
- **API Version**: Shopify Admin GraphQL API `2024-10`
- **Runtime**: Node.js 18.20+ or 20+
- **Language**: TypeScript 5.5+ (Strict Mode)

---

## Prerequisites

Before setting up the app locally, ensure you have:

1. **Node.js**: `v18.20.0+` or `v20.0.0+` ([Download Node.js](https://nodejs.org/))
2. **Shopify CLI**: Installed globally or invoked via `npm`/`npx` (`@shopify/cli@latest`)
3. **Shopify Partner Account**: With access to create and manage development stores ([Shopify Partners](https://partners.shopify.com/))
4. **Development Store**: A store with the "Checkout Extensibility" feature enabled
5. **Package Manager**: `npm` (v9+) or `pnpm` (v8+)

---

## Scaffolding Reference

For reference, the foundation of this project corresponds to the standard Shopify CLI Remix template:

```bash
# 1. Initialize a new Shopify App with Remix template
npm init @shopify/app@latest -- --template=remix

# 2. Add an Order Discount Function extension
npm run shopify app generate extension -- --template=order_discount --name=capped-order-discount
```

---

## Project Structure

```text
capped-discount-app/
├── app/
│   ├── graphql/
│   │   ├── mutations.ts       # Typed Admin GraphQL mutations (create, update, activate, delete)
│   │   └── queries.ts         # Discount nodes, metafields, and function ID queries
│   ├── routes/                # Remix file-based routes
│   └── types/
│       └── discount.ts        # TypeScript interfaces (CappedDiscountConfig, DiscountFormData, etc.)
├── extensions/
│   └── capped-order-discount/ # Shopify Function (Wasm / Rust or JS target)
│       ├── run.graphql        # Function input query
│       ├── run.ts / run.rs    # Function execution logic
│       └── shopify.extension.toml
├── package.json               # Scripts, dependencies, and metadata
├── shopify.app.toml           # App manifest, scopes, webhooks, and auth redirect URLs
├── tsconfig.json              # Strict TypeScript compiler options
└── README.md                  # Project documentation
```

---

## Local Setup & Installation

### 1. Clone & Install Dependencies

```bash
cd capped-discount-app
npm install
```

### 2. Configure Local Development

Start the interactive Shopify development server:

```bash
npm run dev
```

The CLI will:
1. Prompt you to log in to your Shopify Partner account.
2. Allow you to select or create a development store.
3. Automatically provision a secure tunnel (via Cloudflare or ngrok).
4. Update your `shopify.app.toml` with the dynamically generated URLs.
5. Provide a direct installation URL to install the app on your development store.

---

## Configuration & Environment Variables

The app configuration is managed via `shopify.app.toml`:

```toml
name = "Capped Discount App"
client_id = "YOUR_CLIENT_ID"
application_url = "https://YOUR_TUNNEL_URL"

[access_scopes]
scopes = "write_discounts"

[auth]
redirect_urls = [
  "https://YOUR_TUNNEL_URL/auth/callback",
  "https://YOUR_TUNNEL_URL/auth/shopify/callback",
  "https://YOUR_TUNNEL_URL/api/auth/callback"
]

[webhooks]
api_version = "2024-10"

[pos]
embedded = false
```

### Environment Variables (`.env`)

When running locally with `shopify app dev`, the CLI manages authentication tokens automatically. For custom staging or production environments, set:

```env
SHOPIFY_API_KEY=your_client_id_here
SHOPIFY_API_SECRET=your_client_secret_here
SCOPES=write_discounts
SHOPIFY_APP_URL=https://your-production-app.example.com
PORT=3000
```

---

## Extension Deployment

To build and deploy the Shopify Function extension to your app:

```bash
# Build and deploy the function extension to Shopify
npm run shopify app deploy
```

Once deployed, the function will be assigned a permanent `shopifyFunction.id` across your merchant stores, accessible via the `GET_FUNCTION_ID` query.

---

## GraphQL Operations Reference

All operations are located in `app/graphql/` and use the Shopify Admin GraphQL API `2024-10`.

### Mutations

| Mutation Constant | Description | Key Arguments |
| :--- | :--- | :--- |
| `DISCOUNT_CODE_APP_CREATE` | Creates a code-based capped discount | `$discount: DiscountCodeAppInput!` |
| `DISCOUNT_AUTOMATIC_APP_CREATE` | Creates an automatic capped discount | `$automaticAppDiscount: DiscountAutomaticAppInput!` |
| `DISCOUNT_CODE_APP_UPDATE` | Updates an existing code discount | `$id: ID!, $codeAppDiscount: DiscountCodeAppInput!` |
| `DISCOUNT_AUTOMATIC_APP_UPDATE` | Updates an existing automatic discount | `$id: ID!, $automaticAppDiscount: DiscountAutomaticAppInput!` |
| `DISCOUNT_CODE_DELETE` | Deletes a code discount | `$id: ID!` |
| `DISCOUNT_AUTOMATIC_DELETE` | Deletes an automatic discount | `$id: ID!` |
| `DISCOUNT_CODE_ACTIVATE` | Activates an inactive code discount | `$id: ID!` |
| `DISCOUNT_CODE_DEACTIVATE` | Deactivates an active code discount | `$id: ID!` |
| `DISCOUNT_AUTOMATIC_ACTIVATE` | Activates an inactive automatic discount | `$id: ID!` |
| `DISCOUNT_AUTOMATIC_DEACTIVATE` | Deactivates an active automatic discount | `$id: ID!` |

### Queries

| Query Constant | Description | Key Arguments |
| :--- | :--- | :--- |
| `GET_DISCOUNT_NODE` | Retrieves discount node details, combination rules, and `capped_discount.configuration` metafield | `$id: ID!` |
| `GET_APP_DISCOUNTS` | Lists all discounts created by this app (`query: "type:app"`) | `$first: Int!` |
| `GET_FUNCTION_ID` | Queries registered `shopifyFunctions` to discover the target Function ID | None |

### Metafield Configuration Shape

The app stores discount parameters inside the `capped_discount:configuration` metafield on the `DiscountNode`:

```json
{
  "percentage": 80,
  "maxCapAmount": 200,
  "currencyCode": "INR",
  "minSubtotal": 500,
  "discountMessage": "80% off up to ₹200 applied!"
}
```

---

## Security & Performance

- **Zero-Latency Checkout**: Discount logic runs on Shopify's native WebAssembly sandbox with no external network latency.
- **Embedded App Bridge**: Secure session token authentication with automatic token refreshing.
- **Strict Typing**: Full end-to-end type safety preventing schema mismatches between Remix loaders/actions and Shopify Admin API.
