import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData, useNavigation, useSubmit } from "@remix-run/react";
import { useState, useCallback, useMemo } from "react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Select,
  Checkbox,
  Button,
  Banner,
  Text,
  BlockStack,
  InlineStack,
  Divider,
  Box,
  Badge,
  IndexTable,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import {
  getPartialCodSettings,
  savePartialCodSettings,
  getDepositsByShop,
  type PartialCodSettings,
  type PartialCodDepositRecord,
} from "../db.server";

interface LoaderData {
  settings: PartialCodSettings;
  deposits: PartialCodDepositRecord[];
  shop: string;
}

interface ActionData {
  success?: boolean;
  message?: string;
  errors?: string[];
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session?.shop || "unknown";

  const settings = getPartialCodSettings(shop);
  const deposits = getDepositsByShop(shop, 10);

  return json<LoaderData>({
    settings,
    deposits,
    shop,
  });
};

export const action = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session?.shop || "unknown";

  try {
    const formData = await request.formData();
    const enabled = formData.get("enabled") === "true";
    const depositType = (formData.get("depositType") as "fixed" | "percentage") || "percentage";
    const depositValue = parseFloat(formData.get("depositValue") as string) || 10;
    const minOrderSubtotal = parseFloat(formData.get("minOrderSubtotal") as string) || 0;
    const gateway = (formData.get("gateway") as any) || "simulator";
    const apiKey = (formData.get("apiKey") as string) || "";
    const apiSecret = (formData.get("apiSecret") as string) || "";
    const autoCancelMinutes = parseInt(formData.get("autoCancelMinutes") as string, 10) || 30;

    const errors: string[] = [];
    if (depositValue <= 0) {
      errors.push("Deposit value must be greater than 0.");
    }
    if (depositType === "percentage" && depositValue > 90) {
      errors.push("Deposit percentage cannot exceed 90%.");
    }
    if (gateway !== "simulator" && enabled && (!apiKey || !apiSecret)) {
      errors.push(`API Key and Secret are required when using ${gateway.toUpperCase()}.`);
    }

    if (errors.length > 0) {
      return json<ActionData>({ success: false, errors }, { status: 400 });
    }

    const updated: PartialCodSettings = {
      shop,
      enabled,
      depositType,
      depositValue,
      minOrderSubtotal,
      gateway,
      apiKey,
      apiSecret,
      autoCancelMinutes,
      updatedAt: Date.now(),
    };

    savePartialCodSettings(updated);

    return json<ActionData>({
      success: true,
      message: "Partial COD settings saved successfully!",
    });
  } catch (err: any) {
    return json<ActionData>(
      { success: false, errors: [err?.message || "Failed to save settings"] },
      { status: 500 }
    );
  }
};

export default function PartialCodPage() {
  const { settings, deposits, shop } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();

  const isSaving = navigation.state === "submitting";

  const [enabled, setEnabled] = useState<boolean>(settings.enabled);
  const [depositType, setDepositType] = useState<"fixed" | "percentage">(settings.depositType);
  const [depositValue, setDepositValue] = useState<string>(settings.depositValue.toString());
  const [minOrderSubtotal, setMinOrderSubtotal] = useState<string>(
    settings.minOrderSubtotal > 0 ? settings.minOrderSubtotal.toString() : "0"
  );
  const [gateway, setGateway] = useState<string>(settings.gateway || "simulator");
  const [apiKey, setApiKey] = useState<string>(settings.apiKey || "");
  const [apiSecret, setApiSecret] = useState<string>(settings.apiSecret || "");
  const [autoCancelMinutes, setAutoCancelMinutes] = useState<string>(
    settings.autoCancelMinutes ? settings.autoCancelMinutes.toString() : "30"
  );

  // Simulation calculation on sample 1000 order
  const simulation = useMemo(() => {
    const sampleTotal = 1000;
    const val = parseFloat(depositValue) || 0;
    let deposit = 0;
    if (depositType === "percentage") {
      deposit = Math.round((sampleTotal * Math.min(val, 90)) / 100);
    } else {
      deposit = Math.min(val, sampleTotal);
    }
    const balance = Math.max(sampleTotal - deposit, 0);
    return { sampleTotal, deposit, balance };
  }, [depositType, depositValue]);

  const handleSave = useCallback(() => {
    const fd = new FormData();
    fd.append("enabled", enabled.toString());
    fd.append("depositType", depositType);
    fd.append("depositValue", depositValue);
    fd.append("minOrderSubtotal", minOrderSubtotal);
    fd.append("gateway", gateway);
    fd.append("apiKey", apiKey);
    fd.append("apiSecret", apiSecret);
    fd.append("autoCancelMinutes", autoCancelMinutes);
    submit(fd, { method: "post" });
  }, [
    enabled,
    depositType,
    depositValue,
    minOrderSubtotal,
    gateway,
    apiKey,
    apiSecret,
    autoCancelMinutes,
    submit,
  ]);

  return (
    <Page
      title="Partial COD & Advance Deposit"
      subtitle="Require upfront online deposits on Cash on Delivery orders to reduce RTO returns"
      primaryAction={{
        content: isSaving ? "Saving..." : "Save Settings",
        onAction: handleSave,
        loading: isSaving,
      }}
    >
      <BlockStack gap="500">
        {actionData?.success && (
          <Banner tone="success" title="Success">
            <Text as="p">{actionData.message}</Text>
          </Banner>
        )}

        {actionData?.errors && actionData.errors.length > 0 && (
          <Banner tone="critical" title="Errors">
            <BlockStack gap="100">
              {actionData.errors.map((err, i) => (
                <Text key={i} as="p">{err}</Text>
              ))}
            </BlockStack>
          </Banner>
        )}

        {/* Shopify Checkout Setup Guide Banner */}
        <Banner
          title="⚡ Quick Setup: How to show 'Partial COD' at checkout"
          tone="info"
        >
          <BlockStack gap="200">
            <Text as="p">
              Shopify requires custom payment options to be enabled once in your store's payment settings:
            </Text>
            <Text as="p">
              <strong>1.</strong> In your Shopify store admin, click <strong>Settings</strong> (bottom-left gear icon) &gt; <strong>Payments</strong>.
            </Text>
            <Text as="p">
              <strong>2.</strong> Scroll down to <strong>Manual payment methods</strong>, click <strong>Add manual payment method</strong> &gt; <strong>Create custom payment method</strong>.
            </Text>
            <Text as="p">
              <strong>3.</strong> Name it: <strong>Partial Cash on Delivery (Advance Deposit)</strong>.
            </Text>
            <Text as="p">
              <strong>4.</strong> In Payment Instructions, enter: <em>&quot;Pay an advance deposit online to confirm this order. The remaining balance is collected upon delivery.&quot;</em>
            </Text>
            <Text as="p">
              <strong>5.</strong> Click <strong>Activate</strong>. Now customers will see this option at checkout!
            </Text>
          </BlockStack>
        </Banner>

        <Layout>
          {/* Left Column: Form Settings */}
          <Layout.Section>
            <BlockStack gap="500">
              {/* Feature Activation */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="100">
                      <Text as="h2" variant="headingMd">
                        Partial COD System Status
                      </Text>
                      <Text as="p" tone="subdued">
                        Enable to require advance deposits before confirming COD orders
                      </Text>
                    </BlockStack>
                    <Badge tone={enabled ? "success" : "attention"}>
                      {enabled ? "ACTIVE" : "DISABLED"}
                    </Badge>
                  </InlineStack>

                  <Checkbox
                    label="Enable Partial COD for this store"
                    checked={enabled}
                    onChange={(newVal) => setEnabled(newVal)}
                    helpText="When enabled, orders placed with Partial COD trigger an advance deposit payment prompt."
                  />
                </BlockStack>
              </Card>

              {/* Deposit Rules */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Deposit Calculation Rules
                  </Text>
                  <FormLayout>
                    <Select
                      label="Deposit Type"
                      options={[
                        { label: "Percentage of Order Subtotal (%)", value: "percentage" },
                        { label: "Fixed Deposit Amount (₹ / Currency)", value: "fixed" },
                      ]}
                      value={depositType}
                      onChange={(val) => setDepositType(val as any)}
                    />

                    <TextField
                      label={depositType === "percentage" ? "Deposit Percentage (%)" : "Fixed Deposit Amount"}
                      type="number"
                      value={depositValue}
                      onChange={(val) => setDepositValue(val)}
                      suffix={depositType === "percentage" ? "%" : "₹"}
                      autoComplete="off"
                      helpText={
                        depositType === "percentage"
                          ? "E.g. 10% on a ₹1,000 order = ₹100 deposit."
                          : "E.g. Flat ₹100 deposit on any order."
                      }
                    />

                    <TextField
                      label="Minimum Order Subtotal (Optional)"
                      type="number"
                      value={minOrderSubtotal}
                      onChange={(val) => setMinOrderSubtotal(val)}
                      prefix="₹"
                      autoComplete="off"
                      helpText="Orders below this amount will not require an advance deposit (set 0 to apply to all orders)."
                    />
                  </FormLayout>
                </BlockStack>
              </Card>

              {/* Payment Gateway Configuration */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">
                      Payment Gateway Integration
                    </Text>
                    {gateway === "simulator" && (
                      <Badge tone="info">SANDBOX TEST MODE</Badge>
                    )}
                  </InlineStack>

                  <Select
                    label="Select Payment Processor"
                    options={[
                      {
                        label: "Built-in Test Simulator (No account required, for testing)",
                        value: "simulator",
                      },
                      {
                        label: "Razorpay (UPI, GPay, PhonePe, Cards - India)",
                        value: "razorpay",
                      },
                      {
                        label: "Stripe (Cards, Apple Pay, Google Pay - Global)",
                        value: "stripe",
                      },
                    ]}
                    value={gateway}
                    onChange={(val) => setGateway(val)}
                  />

                  {gateway === "simulator" ? (
                    <Banner tone="info" title="Test Simulator Active">
                      <Text as="p">
                        In Simulator mode, customers (and you) can click &quot;Simulate Instant Payment&quot; on the Thank You page to test the order update flow without any real money or gateway credentials!
                      </Text>
                    </Banner>
                  ) : (
                    <FormLayout>
                      <TextField
                        label={gateway === "razorpay" ? "Razorpay Key ID" : "Stripe Publishable Key"}
                        value={apiKey}
                        onChange={(val) => setApiKey(val)}
                        autoComplete="off"
                        placeholder={gateway === "razorpay" ? "rzp_test_..." : "pk_test_..."}
                      />
                      <TextField
                        label={gateway === "razorpay" ? "Razorpay Key Secret" : "Stripe Secret Key"}
                        type="password"
                        value={apiSecret}
                        onChange={(val) => setApiSecret(val)}
                        autoComplete="off"
                        placeholder="••••••••••••••••••••••••••••"
                      />
                    </FormLayout>
                  )}
                </BlockStack>
              </Card>

              {/* Order Automation Settings */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Order Automation & Safety
                  </Text>
                  <Select
                    label="Auto-Cancel Unpaid Deposit Orders"
                    options={[
                      { label: "After 15 minutes of non-payment", value: "15" },
                      { label: "After 30 minutes of non-payment (Recommended)", value: "30" },
                      { label: "After 1 hour of non-payment", value: "60" },
                      { label: "Do not auto-cancel (Keep as pending)", value: "0" },
                    ]}
                    value={autoCancelMinutes}
                    onChange={(val) => setAutoCancelMinutes(val)}
                    helpText="Protects inventory from ghost orders that never complete the advance deposit."
                  />
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>

          {/* Right Column: Simulation & Guidance */}
          <Layout.Section variant="oneThird">
            <BlockStack gap="500">
              {/* Live Preview Card */}
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">
                    Live Calculation Preview
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Example on a ₹{simulation.sampleTotal.toLocaleString()} order:
                  </Text>
                  <Divider />
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="span" tone="subdued">Order Subtotal:</Text>
                      <Text as="span" fontWeight="bold">₹{simulation.sampleTotal}</Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" tone="success">Online Deposit (Paid):</Text>
                      <Text as="span" fontWeight="bold" tone="success">
                        ₹{simulation.deposit}
                      </Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" tone="caution">COD Due on Delivery:</Text>
                      <Text as="span" fontWeight="bold" tone="caution">
                        ₹{simulation.balance}
                      </Text>
                    </InlineStack>
                  </BlockStack>
                </BlockStack>
              </Card>

              {/* How it Works Guide */}
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">
                    How Partial COD Works
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    1. Customer chooses &quot;Partial COD&quot; at checkout.
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    2. On the Thank You page, they pay the advance deposit (₹{simulation.deposit}) via UPI or Card.
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    3. Our app marks ₹{simulation.deposit} as Paid in Shopify and leaves ₹{simulation.balance} as Outstanding COD balance.
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    4. Courier logistics (Shiprocket, Delhivery) reads the balance and collects ₹{simulation.balance} at the door.
                  </Text>
                </BlockStack>
              </Card>

              {/* Thank You Page Integration Guide */}
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">
                    Thank You Page Prompt
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    To display the deposit button on the customer's order confirmation page, copy this snippet to <strong>Shopify Settings &gt; Checkout &gt; Order status page (Additional scripts)</strong>:
                  </Text>
                  <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                    <Text as="p" variant="bodyXs">
                      {`{% if order.financial_status == 'pending' %}`}
                      <br />
                      {`<div style="margin:20px 0;padding:20px;background:#f0fdf4;border:2px solid #16a34a;border-radius:12px;text-align:center;">`}
                      <br />
                      {`  <h3 style="color:#15803d;margin-top:0;">⚡ Action Required: Confirm COD Order</h3>`}
                      <br />
                      {`  <p style="color:#374151;">Pay your advance deposit online to confirm shipment.</p>`}
                      <br />
                      {`  <a href="https://capped-discount-app.onrender.com/pay/{{ order.id }}?shop={{ shop.permanent_domain }}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 24px;border-radius:8px;font-weight:bold;text-decoration:none;">👉 Pay Advance Deposit Now</a>`}
                      <br />
                      {`</div>`}
                      <br />
                      {`{% endif %}`}
                    </Text>
                  </Box>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>

        {/* Recent Transactions Table */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Recent Deposit Transactions
                </Text>
                {deposits.length === 0 ? (
                  <Box padding="400">
                    <Text as="p" tone="subdued" alignment="center">
                      No Partial COD deposit transactions recorded yet. Test an order on your development store!
                    </Text>
                  </Box>
                ) : (
                  <IndexTable
                    resourceName={{ singular: "deposit", plural: "deposits" }}
                    itemCount={deposits.length}
                    headings={[
                      { title: "Order" },
                      { title: "Total" },
                      { title: "Deposit (Paid)" },
                      { title: "COD Balance" },
                      { title: "Status" },
                      { title: "Gateway" },
                      { title: "Date" },
                    ]}
                    selectable={false}
                  >
                    {deposits.map((d, index) => (
                      <IndexTable.Row id={d.id} key={d.id} position={index}>
                        <IndexTable.Cell>
                          <Text as="span" fontWeight="bold">{d.orderName}</Text>
                        </IndexTable.Cell>
                        <IndexTable.Cell>₹{d.totalAmount.toLocaleString()}</IndexTable.Cell>
                        <IndexTable.Cell>
                          <Text as="span" tone="success">₹{d.depositAmount.toLocaleString()}</Text>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Text as="span" tone="caution">₹{d.remainingBalance.toLocaleString()}</Text>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Badge tone={d.status === "paid" ? "success" : d.status === "pending" ? "warning" : "critical"}>
                            {d.status.toUpperCase()}
                          </Badge>
                        </IndexTable.Cell>
                        <IndexTable.Cell>{d.gateway.toUpperCase()}</IndexTable.Cell>
                        <IndexTable.Cell>{new Date(d.createdAt).toLocaleDateString()}</IndexTable.Cell>
                      </IndexTable.Row>
                    ))}
                  </IndexTable>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
