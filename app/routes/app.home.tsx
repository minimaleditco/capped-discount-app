import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Button,
  Banner,
  Text,
  BlockStack,
  InlineStack,
  Box,
  Badge,
  Divider,
  ProgressBar,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getPartialCodSettings, getDepositRules } from "../db.server";
import { getPartialCodOrders } from "../services/refunds.server";
import { GET_APP_DISCOUNTS } from "../graphql/queries";

interface HomeLoaderData {
  shop: string;
  stats: {
    discountsCount: number;
    codEnabled: boolean;
    depositPercentage: number;
    rulesCount: number;
    ordersCount: number;
    totalDepositsCollected: number;
    whatsappEnabled: boolean;
    metaCapiEnabled: boolean;
  };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session?.shop || "unknown";

  let discountsCount = 0;
  let codEnabled = true;
  let depositPercentage = 10;
  let rulesCount = 0;
  let ordersCount = 0;
  let totalDepositsCollected = 0;
  let whatsappEnabled = false;
  let metaCapiEnabled = false;

  try {
    const [settingsRes, rulesRes, ordersRes, discountsRes] = await Promise.allSettled([
      getPartialCodSettings(shop),
      getDepositRules(shop),
      getPartialCodOrders(admin),
      admin.graphql(GET_APP_DISCOUNTS, { variables: { first: 50 } }),
    ]);

    if (settingsRes.status === "fulfilled" && settingsRes.value) {
      const s = settingsRes.value;
      codEnabled = s.enabled;
      depositPercentage = s.depositType === "percentage" ? s.depositValue : 10;
      whatsappEnabled = Boolean(s.whatsappEnabled);
      metaCapiEnabled = Boolean(s.metaPixelId && s.metaCapiToken);
    }

    if (rulesRes.status === "fulfilled" && rulesRes.value) {
      rulesCount = rulesRes.value.length;
    }

    if (ordersRes.status === "fulfilled" && ordersRes.value) {
      ordersCount = ordersRes.value.length;
      totalDepositsCollected = ordersRes.value.reduce(
        (sum, o) => sum + (o.depositAmount || 0),
        0
      );
    }

    if (discountsRes.status === "fulfilled" && discountsRes.value) {
      try {
        const dJson: any = await discountsRes.value.json();
        discountsCount = dJson.data?.discountNodes?.nodes?.length || 0;
      } catch {}
    }
  } catch (err) {
    console.warn("[Home Loader Error]:", err);
  }

  return json<HomeLoaderData>({
    shop,
    stats: {
      discountsCount,
      codEnabled,
      depositPercentage,
      rulesCount,
      ordersCount,
      totalDepositsCollected,
      whatsappEnabled,
      metaCapiEnabled,
    },
  });
};

export default function AppHomePage() {
  const { shop, stats } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  // Calculate setup completion progress
  const completedSteps = [
    stats.discountsCount > 0,
    stats.codEnabled,
    stats.rulesCount > 0,
    stats.whatsappEnabled,
    stats.metaCapiEnabled,
  ].filter(Boolean).length;
  const progressPercent = Math.round((completedSteps / 5) * 100);

  return (
    <Page
      title="Capped Discount & Partial COD Suite"
      subtitle="The all-in-one revenue acceleration, margin defense, and RTO reduction engine for Shopify."
      compactTitle
      fullWidth
    >
      <BlockStack gap="600">
        {/* ================================================================= */}
        {/* HERO BANNER SECTION                                               */}
        {/* ================================================================= */}
        <div
          style={{
            background: "linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #047857 100%)",
            borderRadius: "16px",
            padding: "32px 28px",
            color: "#FFFFFF",
            boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.3)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Subtle background glow */}
          <div
            style={{
              position: "absolute",
              top: "-50px",
              right: "-50px",
              width: "250px",
              height: "250px",
              background: "radial-gradient(circle, rgba(16, 185, 129, 0.3) 0%, transparent 70%)",
              borderRadius: "50%",
              pointerEvents: "none",
            }}
          />

          <InlineStack align="space-between" blockAlign="center" gap="600">
            <BlockStack gap="300" inlineAlign="start">
              <InlineStack gap="300" blockAlign="center">
                <img
                  src="/app-icon.jpg"
                  alt="App Icon"
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "10px",
                    boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.25)",
                  }}
                />
                <InlineStack gap="200" blockAlign="center">
                  <span
                    style={{
                      background: "rgba(255, 255, 255, 0.15)",
                      border: "1px solid rgba(255, 255, 255, 0.25)",
                      padding: "4px 10px",
                      borderRadius: "9999px",
                      fontSize: "12px",
                      fontWeight: 600,
                      letterSpacing: "0.02em",
                    }}
                  >
                    🚀 v2.0 Enterprise Engine
                  </span>
                  <span
                    style={{
                      background: stats.codEnabled ? "#059669" : "#D97706",
                      padding: "4px 10px",
                      borderRadius: "9999px",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}
                  >
                    {stats.codEnabled ? "● Partial COD Active" : "○ COD Disabled"}
                  </span>
                </InlineStack>
              </InlineStack>

              <Text as="h1" variant="heading2xl">
                Protect Your Margins & Slash RTO by 80%
              </Text>

              <div style={{ maxWidth: "620px", opacity: 0.9 }}>
                <Text as="p" variant="bodyLg">
                  Combine high-converting percentage discounts protected by maximum rupee caps, 
                  flexible advance deposit collection online, SMS/WhatsApp order verification, 
                  and server-side Meta ROAS tracking.
                </Text>
              </div>

              <Box paddingBlockStart="200">
                <InlineStack gap="300">
                  <Button
                    size="large"
                    variant="primary"
                    onClick={() => navigate("/app/cod")}
                  >
                    Configure Partial COD →
                  </Button>
                  <Button
                    size="large"
                    onClick={() => navigate("/app/discounts/new")}
                  >
                    + Create Capped Discount
                  </Button>
                  <Button
                    size="large"
                    onClick={() => navigate("/app/orders")}
                  >
                    Orders &amp; Refunds ({`${stats.ordersCount}`})
                  </Button>
                </InlineStack>
              </Box>
            </BlockStack>

            {/* Quick Live Performance Stats Pill Box */}
            <div
              style={{
                background: "rgba(255, 255, 255, 0.1)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                borderRadius: "14px",
                padding: "20px 24px",
                minWidth: "260px",
              }}
            >
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">
                  Store Metrics Overview
                </Text>
                <Divider />
                <InlineStack align="space-between">
                  <span style={{ fontSize: "13px", opacity: 0.85 }}>Active Discounts:</span>
                  <span style={{ fontSize: "15px", fontWeight: 700 }}>{stats.discountsCount} Deals</span>
                </InlineStack>
                <InlineStack align="space-between">
                  <span style={{ fontSize: "13px", opacity: 0.85 }}>Default Deposit:</span>
                  <span style={{ fontSize: "15px", fontWeight: 700 }}>{stats.depositPercentage}% Online</span>
                </InlineStack>
                <InlineStack align="space-between">
                  <span style={{ fontSize: "13px", opacity: 0.85 }}>Dynamic Rules:</span>
                  <span style={{ fontSize: "15px", fontWeight: 700 }}>{stats.rulesCount} Configured</span>
                </InlineStack>
                <InlineStack align="space-between">
                  <span style={{ fontSize: "13px", opacity: 0.85 }}>Deposits Collected:</span>
                  <span style={{ fontSize: "15px", fontWeight: 700, color: "#A7F3D0" }}>
                    ₹{stats.totalDepositsCollected.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </InlineStack>
              </BlockStack>
            </div>
          </InlineStack>
        </div>

        {/* ================================================================= */}
        {/* SETUP CHECKLIST & NAVIGATION PROGRESS                             */}
        {/* ================================================================= */}
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="050">
                <Text as="h2" variant="headingMd">
                  Store Onboarding & Feature Activation
                </Text>
                <Text as="p" tone="subdued">
                  Follow these 5 core steps to maximize conversion and prevent delivery rejections.
                </Text>
              </BlockStack>
              <InlineStack gap="200" blockAlign="center">
                <Text as="span" variant="bodyMd" fontWeight="semibold">
                  {completedSteps} of 5 Completed
                </Text>
                <Badge tone={progressPercent === 100 ? "success" : "attention"}>
                  {`${progressPercent}% SETUP`}
                </Badge>
              </InlineStack>
            </InlineStack>

            <ProgressBar progress={progressPercent} size="small" tone={progressPercent === 100 ? "success" : "highlight"} />

            <Layout>
              {/* Step 1 */}
              <Layout.Section variant="oneThird">
                <div
                  style={{
                    border: "1px solid #E2E8F0",
                    borderRadius: "10px",
                    padding: "14px",
                    background: stats.discountsCount > 0 ? "#F0FDF4" : "#FFFFFF",
                  }}
                >
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="h3" variant="headingSm">
                        1. Capped Discounts
                      </Text>
                      <Badge tone={stats.discountsCount > 0 ? "success" : "new"}>
                        {stats.discountsCount > 0 ? "CONFIGURED" : "PENDING"}
                      </Badge>
                    </InlineStack>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Create promotional percentage discounts (e.g. 50% OFF) strictly capped up to ₹500.
                    </Text>
                    <Button size="slim" onClick={() => navigate("/app")}>
                      Manage Discounts →
                    </Button>
                  </BlockStack>
                </div>
              </Layout.Section>

              {/* Step 2 */}
              <Layout.Section variant="oneThird">
                <div
                  style={{
                    border: "1px solid #E2E8F0",
                    borderRadius: "10px",
                    padding: "14px",
                    background: stats.codEnabled ? "#F0FDF4" : "#FFFFFF",
                  }}
                >
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="h3" variant="headingSm">
                        2. Partial COD Deposit
                      </Text>
                      <Badge tone={stats.codEnabled ? "success" : "attention"}>
                        {stats.codEnabled ? `${stats.depositPercentage}% ACTIVE` : "DISABLED"}
                      </Badge>
                    </InlineStack>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Collect upfront commitment online via UPI/Cards and rest in cash at doorstep.
                    </Text>
                    <Button size="slim" onClick={() => navigate("/app/cod")}>
                      Edit COD Settings →
                    </Button>
                  </BlockStack>
                </div>
              </Layout.Section>

              {/* Step 3 */}
              <Layout.Section variant="oneThird">
                <div
                  style={{
                    border: "1px solid #E2E8F0",
                    borderRadius: "10px",
                    padding: "14px",
                    background: stats.rulesCount > 0 ? "#F0FDF4" : "#FFFFFF",
                  }}
                >
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="h3" variant="headingSm">
                        3. Risk-Based Rules
                      </Text>
                      <Badge tone={stats.rulesCount > 0 ? "success" : "new"}>
                        {stats.rulesCount > 0 ? `${stats.rulesCount} RULES` : "PENDING"}
                      </Badge>
                    </InlineStack>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Higher deposit for high-RTO delivery pincodes, high cart totals, or custom items.
                    </Text>
                    <Button size="slim" onClick={() => navigate("/app/deposit-rules")}>
                      Set Rules Engine →
                    </Button>
                  </BlockStack>
                </div>
              </Layout.Section>
            </Layout>
          </BlockStack>
        </Card>

        {/* ================================================================= */}
        {/* COMPREHENSIVE FEATURE SHOWCASE (DETAILED CARDS WITH GRAPHICS)      */}
        {/* ================================================================= */}
        <BlockStack gap="400">
          <Text as="h2" variant="headingLg">
            Core Features & Navigation Guide
          </Text>
          <Text as="p" tone="subdued">
            Learn how each integrated component works and where to configure it.
          </Text>

          <Layout>
            {/* Feature 1: Capped Percentage Discounts */}
            <Layout.Section variant="oneHalf">
              <Card>
                <BlockStack gap="400">
                  {/* Feature Image Illustration */}
                  <div
                    style={{
                      borderRadius: "10px",
                      overflow: "hidden",
                      border: "1px solid #E2E8F0",
                      maxHeight: "180px",
                    }}
                  >
                    <img
                      src="/promo-banner.jpg"
                      alt="Capped Percentage Discount Banner"
                      style={{
                        width: "100%",
                        height: "180px",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  </div>

                  {/* Graphic Visual Comparison Header */}
                  <div
                    style={{
                      height: "120px",
                      borderRadius: "10px",
                      background: "linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-around",
                      padding: "14px",
                      color: "#FFFFFF",
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "11px", opacity: 0.75, textTransform: "uppercase" }}>Uncapped Discount</div>
                      <div style={{ fontSize: "20px", fontWeight: 700, color: "#F87171" }}>-₹1,000</div>
                      <div style={{ fontSize: "11px", color: "#FCA5A5" }}>❌ Heavy Margin Loss</div>
                    </div>
                    <div style={{ fontSize: "24px", color: "#6366F1" }}>➔</div>
                    <div
                      style={{
                        background: "rgba(255, 255, 255, 0.12)",
                        border: "1px solid #10B981",
                        padding: "8px 14px",
                        borderRadius: "10px",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: "11px", color: "#34D399", fontWeight: 600 }}>CAPPED AT ₹500</div>
                      <div style={{ fontSize: "20px", fontWeight: 700, color: "#34D399" }}>-₹500 Max</div>
                      <div style={{ fontSize: "11px", color: "#A7F3D0" }}>✅ ₹500 Profit Saved</div>
                    </div>
                  </div>

                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="h3" variant="headingMd">
                        1. Capped Percentage Discounts
                      </Text>
                      <Badge tone="success">Shopify Function Native</Badge>
                    </InlineStack>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Standard Shopify percentage discounts (e.g. 50% OFF) destroy profits on bulk orders. 
                      Our Shopify Function automatically evaluates the cart and applies percentage savings up to your strict maximum ceiling cap.
                    </Text>
                  </BlockStack>

                  <Divider />

                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="span" variant="bodySm" tone="subdued">
                      Configured under Discounts
                    </Text>
                    <InlineStack gap="200">
                      <Button onClick={() => navigate("/app")}>View Discounts</Button>
                      <Button variant="primary" onClick={() => navigate("/app/discounts/new")}>
                        + Create Capped Discount
                      </Button>
                    </InlineStack>
                  </InlineStack>
                </BlockStack>
              </Card>
            </Layout.Section>

            {/* Feature 2: Flexible Partial Cash on Delivery */}
            <Layout.Section variant="oneHalf">
              <Card>
                <BlockStack gap="400">
                  {/* Feature Image Illustration */}
                  <div
                    style={{
                      borderRadius: "10px",
                      overflow: "hidden",
                      border: "1px solid #E2E8F0",
                      maxHeight: "180px",
                    }}
                  >
                    <img
                      src="/partial-cod-feature.jpg"
                      alt="Flexible Partial Cash on Delivery"
                      style={{
                        width: "100%",
                        height: "180px",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  </div>

                  {/* Graphic Visual Header */}
                  <div
                    style={{
                      height: "120px",
                      borderRadius: "10px",
                      background: "linear-gradient(135deg, #064E3B 0%, #065F46 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-around",
                      padding: "14px",
                      color: "#FFFFFF",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        background: "rgba(255, 255, 255, 0.12)",
                        border: "1px solid #34D399",
                        padding: "8px 12px",
                        borderRadius: "10px",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: "11px", color: "#A7F3D0" }}>10% PAID ONLINE</div>
                      <div style={{ fontSize: "18px", fontWeight: 700, color: "#FFFFFF" }}>₹108.00</div>
                      <div style={{ fontSize: "11px", color: "#34D399" }}>🔒 UPI / Cards Locked</div>
                    </div>
                    <div style={{ fontSize: "20px", color: "#A7F3D0" }}>+</div>
                    <div
                      style={{
                        background: "rgba(255, 255, 255, 0.08)",
                        border: "1px dashed rgba(255, 255, 255, 0.3)",
                        padding: "8px 12px",
                        borderRadius: "10px",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: "11px", opacity: 0.8 }}>90% AT DOORSTEP</div>
                      <div style={{ fontSize: "18px", fontWeight: 700, color: "#FEF08A" }}>₹972.00</div>
                      <div style={{ fontSize: "11px", opacity: 0.8 }}>📦 Cash / Courier Delivery</div>
                    </div>
                  </div>

                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="h3" variant="headingMd">
                        2. Partial Cash on Delivery (COD)
                      </Text>
                      <Badge tone="info">80% RTO Reduction</Badge>
                    </InlineStack>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Pure COD orders suffer 30-40% customer rejection at doorstep. Requiring a 10% advance deposit 
                      guarantees buyer commitment while giving buyers the comfort of paying the rest in cash upon delivery.
                    </Text>
                  </BlockStack>

                  <Divider />

                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="span" variant="bodySm" tone="subdued">
                      Deposit Type, % Value, & Checkout Pop-up
                    </Text>
                    <Button variant="primary" onClick={() => navigate("/app/cod")}>
                      Configure Partial COD →
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>
            </Layout.Section>

            {/* Feature 3: Dynamic Risk-Based Deposit Rules */}
            <Layout.Section variant="oneHalf">
              <Card>
                <BlockStack gap="400">
                  {/* Graphic Visual Header */}
                  <div
                    style={{
                      height: "140px",
                      borderRadius: "10px",
                      background: "linear-gradient(135deg, #78350F 0%, #92400E 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-around",
                      padding: "16px",
                      color: "#FFFFFF",
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "11px", opacity: 0.8 }}>High-RTO Pincode</div>
                      <div style={{ fontSize: "17px", fontWeight: 700, color: "#FDE68A" }}>25% Deposit</div>
                      <div style={{ fontSize: "10.5px", opacity: 0.8 }}>Prefix 110, 800...</div>
                    </div>
                    <div style={{ width: "1px", height: "40px", background: "rgba(255,255,255,0.2)" }} />
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "11px", opacity: 0.8 }}>Cart &gt; ₹5,000</div>
                      <div style={{ fontSize: "17px", fontWeight: 700, color: "#FDE68A" }}>Flat ₹500</div>
                      <div style={{ fontSize: "10.5px", opacity: 0.8 }}>High Cart Value</div>
                    </div>
                    <div style={{ width: "1px", height: "40px", background: "rgba(255,255,255,0.2)" }} />
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "11px", opacity: 0.8 }}>Custom / Fragile</div>
                      <div style={{ fontSize: "17px", fontWeight: 700, color: "#FDE68A" }}>50% Deposit</div>
                      <div style={{ fontSize: "10.5px", opacity: 0.8 }}>By Product SKU</div>
                    </div>
                  </div>

                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="h3" variant="headingMd">
                        3. Risk-Based Rules Engine
                      </Text>
                      <Badge tone="attention">Dynamic Logic</Badge>
                    </InlineStack>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Don&apos;t treat all orders the same. Automatically increase advance deposits for pin codes 
                      with chronic courier returns, orders over ₹5,000, or heavy/made-to-order product SKUs.
                    </Text>
                  </BlockStack>

                  <Divider />

                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="span" variant="bodySm" tone="subdued">
                      Pincode, Cart Value & SKU conditions
                    </Text>
                    <Button variant="primary" onClick={() => navigate("/app/deposit-rules")}>
                      Set Deposit Rules →
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>
            </Layout.Section>

            {/* Feature 4: WhatsApp OTP & Courier Cash Dunning */}
            <Layout.Section variant="oneHalf">
              <Card>
                <BlockStack gap="400">
                  {/* Feature Image Illustration */}
                  <div
                    style={{
                      borderRadius: "10px",
                      overflow: "hidden",
                      border: "1px solid #E2E8F0",
                      maxHeight: "180px",
                    }}
                  >
                    <img
                      src="/whatsapp-otp-feature.jpg"
                      alt="WhatsApp OTP and Delivery Dunning"
                      style={{
                        width: "100%",
                        height: "180px",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  </div>

                  {/* Graphic Visual Header */}
                  <div
                    style={{
                      height: "120px",
                      borderRadius: "10px",
                      background: "linear-gradient(135deg, #064E3B 0%, #022C22 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-around",
                      padding: "14px",
                      color: "#FFFFFF",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        background: "#075E54",
                        border: "1px solid #25D366",
                        padding: "8px 12px",
                        borderRadius: "10px",
                        maxWidth: "180px",
                      }}
                    >
                      <div style={{ fontSize: "10px", color: "#25D366", fontWeight: 700 }}>💬 WhatsApp OTP</div>
                      <div style={{ fontSize: "14px", fontWeight: 700, letterSpacing: "2px", margin: "2px 0" }}>*654321*</div>
                      <div style={{ fontSize: "9px", opacity: 0.8 }}>Pre-checkout verification</div>
                    </div>
                    <div style={{ fontSize: "18px" }}>➔</div>
                    <div
                      style={{
                        background: "rgba(255, 255, 255, 0.1)",
                        padding: "8px 12px",
                        borderRadius: "10px",
                        maxWidth: "180px",
                      }}
                    >
                      <div style={{ fontSize: "10px", color: "#FDE047", fontWeight: 700 }}>🚚 Out for Delivery</div>
                      <div style={{ fontSize: "12px", fontWeight: 600 }}>Keep ₹972 ready</div>
                      <div style={{ fontSize: "9px", opacity: 0.8 }}>Auto-dunning on delivery day</div>
                    </div>
                  </div>

                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="h3" variant="headingMd">
                        4. WhatsApp OTP & Cash Dunning
                      </Text>
                      <Badge tone={stats.whatsappEnabled ? "success" : "new"}>
                        {stats.whatsappEnabled ? "ENABLED" : "SIMULATOR READY"}
                      </Badge>
                    </InlineStack>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Verifies mobile numbers with 6-digit OTP before COD order placement. On the morning of delivery, 
                      the app sends a WhatsApp reminder so customers have the exact doorstep cash ready.
                    </Text>
                  </BlockStack>

                  <Divider />

                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="span" variant="bodySm" tone="subdued">
                      Interakt, Twilio & Simulator modes
                    </Text>
                    <Button variant="primary" onClick={() => navigate("/app/cod")}>
                      Configure WhatsApp →
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>
            </Layout.Section>

            {/* Feature 5: Meta Conversions API (CAPI) */}
            <Layout.Section variant="oneHalf">
              <Card>
                <BlockStack gap="400">
                  {/* Graphic Visual Header */}
                  <div
                    style={{
                      height: "140px",
                      borderRadius: "10px",
                      background: "linear-gradient(135deg, #1877F2 0%, #0C4A6E 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-around",
                      padding: "16px",
                      color: "#FFFFFF",
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "11px", opacity: 0.8 }}>Browser Pixel Error</div>
                      <div style={{ fontSize: "16px", fontWeight: 700, color: "#FCA5A5" }}>₹108 Tracked</div>
                      <div style={{ fontSize: "10.5px", opacity: 0.8 }}>ROAS artificially drops 90%</div>
                    </div>
                    <div style={{ fontSize: "22px", color: "#60A5FA" }}>➔</div>
                    <div
                      style={{
                        background: "rgba(255, 255, 255, 0.15)",
                        border: "1px solid #60A5FA",
                        padding: "10px 16px",
                        borderRadius: "10px",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: "11px", color: "#93C5FD", fontWeight: 600 }}>SERVER-SIDE CAPI</div>
                      <div style={{ fontSize: "18px", fontWeight: 700, color: "#FFFFFF" }}>₹1,080 Reported</div>
                      <div style={{ fontSize: "10.5px", color: "#93C5FD" }}>Full Cart Value Preserved</div>
                    </div>
                  </div>

                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="h3" variant="headingMd">
                        5. Meta Conversions API (CAPI)
                      </Text>
                      <Badge tone={stats.metaCapiEnabled ? "success" : "new"}>
                        {stats.metaCapiEnabled ? "CONNECTED" : "READY"}
                      </Badge>
                    </InlineStack>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Standard pixel trackers only see the ₹108 online deposit, destroying Facebook Ad ROAS. 
                      Our server-side CAPI intercepts the order and reports the FULL cart value (Deposit + COD balance) directly to Meta.
                    </Text>
                  </BlockStack>

                  <Divider />

                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="span" variant="bodySm" tone="subdued">
                      Pixel ID & Dataset Access Token
                    </Text>
                    <Button variant="primary" onClick={() => navigate("/app/cod")}>
                      Connect Meta CAPI →
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>
            </Layout.Section>

            {/* Feature 6: One-Click Deposit Refunds */}
            <Layout.Section variant="oneHalf">
              <Card>
                <BlockStack gap="400">
                  {/* Graphic Visual Header */}
                  <div
                    style={{
                      height: "140px",
                      borderRadius: "10px",
                      background: "linear-gradient(135deg, #4C1D95 0%, #581C87 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-around",
                      padding: "16px",
                      color: "#FFFFFF",
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "11px", opacity: 0.8 }}>Standard Shopify Refund</div>
                      <div style={{ fontSize: "16px", fontWeight: 700, color: "#FCA5A5" }}>₹1,080 Refunded</div>
                      <div style={{ fontSize: "10.5px", color: "#FCA5A5" }}>Refunds unpaid COD cash!</div>
                    </div>
                    <div style={{ fontSize: "22px", color: "#C084FC" }}>➔</div>
                    <div
                      style={{
                        background: "rgba(255, 255, 255, 0.15)",
                        border: "1px solid #A855F7",
                        padding: "10px 16px",
                        borderRadius: "10px",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: "11px", color: "#E9D5FF", fontWeight: 600 }}>DEPOSIT GUARD</div>
                      <div style={{ fontSize: "18px", fontWeight: 700, color: "#FFFFFF" }}>₹108 Online Deposit</div>
                      <div style={{ fontSize: "10.5px", color: "#E9D5FF" }}>Restocks + Shields ₹972</div>
                    </div>
                  </div>

                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="h3" variant="headingMd">
                        6. 1-Click Safe Deposit Refunds
                      </Text>
                      <Badge tone="success">Deposit Guard</Badge>
                    </InlineStack>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Cancel orders safely in one click. Restocks inventory automatically and refunds strictly 
                      the online deposit transaction—never accidentally refunding the unpaid doorstep cash balance.
                    </Text>
                  </BlockStack>

                  <Divider />

                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="span" variant="bodySm" tone="subdued">
                      Order management & support tracking
                    </Text>
                    <Button variant="primary" onClick={() => navigate("/app/orders")}>
                      Open Orders & Support →
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>
        </BlockStack>

        {/* ================================================================= */}
        {/* CUSTOMER CHECKOUT JOURNEY WORKFLOW                                */}
        {/* ================================================================= */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              End-to-End Buyer Journey & Technical Flow
            </Text>
            <Text as="p" tone="subdued">
              How the app orchestrates discounts, draft checkouts, WhatsApp alerts, and refunds behind the scenes:
            </Text>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "14px",
                padding: "8px 0",
              }}
            >
              {/* Step 1 */}
              <div
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: "10px",
                  padding: "14px",
                }}
              >
                <div style={{ fontSize: "20px", marginBottom: "6px" }}>🏷️</div>
                <Text as="h3" variant="headingSm">
                  1. Capped Discount
                </Text>
                <Text as="p" variant="bodyXs" tone="subdued">
                  Buyer applies coupon in cart/modal. Discount is capped at max ceiling.
                </Text>
              </div>

              {/* Step 2 */}
              <div
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: "10px",
                  padding: "14px",
                }}
              >
                <div style={{ fontSize: "20px", marginBottom: "6px" }}>⚡</div>
                <Text as="h3" variant="headingSm">
                  2. Fast Modal
                </Text>
                <Text as="p" variant="bodyXs" tone="subdued">
                  Buyer picks Full Prepaid or Partial COD with 10% advance deposit.
                </Text>
              </div>

              {/* Step 3 */}
              <div
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: "10px",
                  padding: "14px",
                }}
              >
                <div style={{ fontSize: "20px", marginBottom: "6px" }}>📱</div>
                <Text as="h3" variant="headingSm">
                  3. Mobile OTP
                </Text>
                <Text as="p" variant="bodyXs" tone="subdued">
                  Buyer enters mobile number and verifies 6-digit SMS/WhatsApp OTP code.
                </Text>
              </div>

              {/* Step 4 */}
              <div
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: "10px",
                  padding: "14px",
                }}
              >
                <div style={{ fontSize: "20px", marginBottom: "6px" }}>💳</div>
                <Text as="h3" variant="headingSm">
                  4. Shopify Checkout
                </Text>
                <Text as="p" variant="bodyXs" tone="subdued">
                  Draft order charges ONLY deposit online. Full attributes record COD balance.
                </Text>
              </div>

              {/* Step 5 */}
              <div
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: "10px",
                  padding: "14px",
                }}
              >
                <div style={{ fontSize: "20px", marginBottom: "6px" }}>📊</div>
                <Text as="h3" variant="headingSm">
                  5. Meta CAPI
                </Text>
                <Text as="p" variant="bodyXs" tone="subdued">
                  Server-side event dispatches full order value to Meta Graph API.
                </Text>
              </div>

              {/* Step 6 */}
              <div
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: "10px",
                  padding: "14px",
                }}
              >
                <div style={{ fontSize: "20px", marginBottom: "6px" }}>🚚</div>
                <Text as="h3" variant="headingSm">
                  6. Doorstep Delivery
                </Text>
                <Text as="p" variant="bodyXs" tone="subdued">
                  Courier collects cash balance. If cancelled, 1-click refund restocks items.
                </Text>
              </div>
            </div>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
