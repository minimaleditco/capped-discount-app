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
import { sendToMetaCAPI } from "../services/meta-capi.server";
import { sendWhatsAppOtp } from "../services/whatsapp.server";
import { sendSmsOtp } from "../services/sms.server";
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

  const settings = await getPartialCodSettings(shop);
  const deposits = await getDepositsByShop(shop, 10);

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
    const intent = (formData.get("intent") as string) || "save";

    if (intent === "test_meta_capi") {
      const metaPixelId = (formData.get("metaPixelId") as string) || "";
      const metaCapiToken = (formData.get("metaCapiToken") as string) || "";
      const testEventCode = (formData.get("testEventCode") as string) || "";

      if (!metaPixelId || !metaCapiToken) {
        return json<ActionData>(
          { success: false, errors: ["Both Meta Pixel ID and CAPI Access Token are required to send a test event."] },
          { status: 400 }
        );
      }

      // Temporarily persist credentials for the test dispatch
      const current = await getPartialCodSettings(shop);
      await savePartialCodSettings({
        ...current,
        metaPixelId,
        metaCapiToken,
      });

      const testResult = await sendToMetaCAPI(
        shop,
        {
          orderId: "test_" + Date.now(),
          orderName: "#TEST-PARTIAL-COD",
          currency: "INR",
          fullValue: 2499,
          depositValue: 250,
          balanceValue: 2249,
          createdAt: new Date().toISOString(),
          customer: {
            email: "test_customer@example.com",
            phone: "9876543210",
            firstName: "Rahul",
            lastName: "Sharma",
            city: "New Delhi",
            province: "Delhi",
            zip: "110001",
            country: "IN",
          },
          lineItems: [
            { id: "test_item_1", sku: "SAMPLE-SKU-01", title: "Sample Product", quantity: 1, price: 2499 },
          ],
        },
        { testEventCode: testEventCode.trim() || undefined }
      );

      if (testResult.success) {
        return json<ActionData>({
          success: true,
          message: `Meta CAPI test event successfully received by Meta! Events Received: ${testResult.eventsReceived}, FBTrace ID: ${testResult.fbtraceId}`,
        });
      } else {
        return json<ActionData>(
          { success: false, errors: [testResult.error || testResult.reason || "Meta CAPI test failed."] },
          { status: 400 }
        );
      }
    }

    if (intent === "test_whatsapp") {
      const testPhone = (formData.get("testPhone") as string) || "";
      const whatsappProvider = (formData.get("whatsappProvider") as any) || "simulator";
      const whatsappApiKey = (formData.get("whatsappApiKey") as string) || "";
      const whatsappApiUrl = (formData.get("whatsappApiUrl") as string) || "";
      const whatsappSender = (formData.get("whatsappSender") as string) || "";

      if (!testPhone || testPhone.replace(/[^0-9]/g, "").length < 10) {
        return json<ActionData>(
          { success: false, errors: ["Please enter a valid 10-digit mobile number for the test WhatsApp message."] },
          { status: 400 }
        );
      }

      // Persist credentials for test
      const current = await getPartialCodSettings(shop);
      await savePartialCodSettings({
        ...current,
        whatsappProvider,
        whatsappApiKey,
        whatsappApiUrl,
        whatsappSender,
      });

      const res = await sendWhatsAppOtp(shop, testPhone, "123456");
      if (res.success) {
        return json<ActionData>({
          success: true,
          message: `Test WhatsApp message triggered successfully via ${res.provider.toUpperCase()}! (Message ID: ${res.messageId})`,
        });
      } else {
        return json<ActionData>(
          { success: false, errors: [res.error || "Failed to trigger test WhatsApp message."] },
          { status: 400 }
        );
      }
    }

    if (intent === "test_sms") {
      const testPhone = (formData.get("testSmsPhone") as string) || "";
      const smsProvider = (formData.get("smsProvider") as any) || "simulator";
      const smsApiKey = (formData.get("smsApiKey") as string) || "";
      const smsSenderId = (formData.get("smsSenderId") as string) || "";

      if (!testPhone || testPhone.replace(/[^0-9]/g, "").length < 10) {
        return json<ActionData>(
          { success: false, errors: ["Please enter a valid 10-digit mobile number for the test SMS."] },
          { status: 400 }
        );
      }

      // Persist credentials for test
      const current = await getPartialCodSettings(shop);
      await savePartialCodSettings({
        ...current,
        smsProvider,
        smsApiKey,
        smsSenderId,
      });

      const res = await sendSmsOtp(shop, testPhone, "123456");
      if (res.success) {
        return json<ActionData>({
          success: true,
          message: `Test SMS dispatched successfully via ${res.provider.toUpperCase()}! (Message ID: ${res.messageId || "N/A"})`,
        });
      } else {
        return json<ActionData>(
          { success: false, errors: [res.error || "Failed to dispatch test SMS."] },
          { status: 400 }
        );
      }
    }

    const enabled = formData.get("enabled") === "true";
    const depositType = (formData.get("depositType") as "fixed" | "percentage") || "percentage";
    const depositValue = parseFloat(formData.get("depositValue") as string) || 10;
    const minOrderSubtotal = parseFloat(formData.get("minOrderSubtotal") as string) || 0;
    const gateway = (formData.get("gateway") as any) || "simulator";
    const apiKey = (formData.get("apiKey") as string) || "";
    const apiSecret = (formData.get("apiSecret") as string) || "";
    const autoCancelMinutes = parseInt(formData.get("autoCancelMinutes") as string, 10) || 30;
    const metaPixelId = (formData.get("metaPixelId") as string) || "";
    const metaCapiToken = (formData.get("metaCapiToken") as string) || "";
    const whatsappEnabled = formData.get("whatsappEnabled") === "true";
    const whatsappProvider = (formData.get("whatsappProvider") as any) || "simulator";
    const whatsappApiKey = (formData.get("whatsappApiKey") as string) || "";
    const whatsappApiUrl = (formData.get("whatsappApiUrl") as string) || "";
    const whatsappSender = (formData.get("whatsappSender") as string) || "";

    const prepaidDiscountEnabled = formData.get("prepaidDiscountEnabled") === "true";
    const prepaidDiscountType = (formData.get("prepaidDiscountType") as "fixed" | "percentage") || "percentage";
    const prepaidDiscountValue = parseFloat(formData.get("prepaidDiscountValue") as string) || 5;
    const prepaidDiscountBadge = (formData.get("prepaidDiscountBadge") as string) || "⚡ Extra 5% OFF on Prepaid";
    const smsProvider = (formData.get("smsProvider") as any) || "simulator";
    const smsApiKey = (formData.get("smsApiKey") as string) || "";
    const smsSenderId = (formData.get("smsSenderId") as string) || "";
    const availableCoupons = (formData.get("availableCoupons") as string) || "[]";

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
    if (whatsappEnabled && whatsappProvider !== "simulator" && !whatsappApiKey) {
      errors.push(`WhatsApp API Key is required when using ${whatsappProvider.toUpperCase()}.`);
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
      metaPixelId,
      metaCapiToken,
      whatsappEnabled,
      whatsappProvider,
      whatsappApiKey,
      whatsappApiUrl,
      whatsappSender,
      prepaidDiscountEnabled,
      prepaidDiscountType,
      prepaidDiscountValue,
      prepaidDiscountBadge,
      smsProvider,
      smsApiKey,
      smsSenderId,
      availableCoupons,
      updatedAt: Date.now(),
    };

    await savePartialCodSettings(updated);

    return json<ActionData>({
      success: true,
      message: "Partial COD, SMS OTP & Prepaid Discount settings saved successfully!",
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
  const [metaPixelId, setMetaPixelId] = useState<string>(settings.metaPixelId || "");
  const [metaCapiToken, setMetaCapiToken] = useState<string>(settings.metaCapiToken || "");
  const [showToken, setShowToken] = useState<boolean>(false);
  const [testEventCode, setTestEventCode] = useState<string>("");

  const [whatsappEnabled, setWhatsappEnabled] = useState<boolean>(settings.whatsappEnabled || false);
  const [whatsappProvider, setWhatsappProvider] = useState<string>(settings.whatsappProvider || "simulator");
  const [whatsappApiKey, setWhatsappApiKey] = useState<string>(settings.whatsappApiKey || "");
  const [whatsappApiUrl, setWhatsappApiUrl] = useState<string>(settings.whatsappApiUrl || "");
  const [whatsappSender, setWhatsappSender] = useState<string>(settings.whatsappSender || "");
  const [testPhone, setTestPhone] = useState<string>("");

  // Extra Prepaid Discount State
  const [prepaidDiscountEnabled, setPrepaidDiscountEnabled] = useState<boolean>(
    settings.prepaidDiscountEnabled ?? true
  );
  const [prepaidDiscountType, setPrepaidDiscountType] = useState<"fixed" | "percentage">(
    settings.prepaidDiscountType || "percentage"
  );
  const [prepaidDiscountValue, setPrepaidDiscountValue] = useState<string>(
    settings.prepaidDiscountValue ? settings.prepaidDiscountValue.toString() : "5"
  );
  const [prepaidDiscountBadge, setPrepaidDiscountBadge] = useState<string>(
    settings.prepaidDiscountBadge || "⚡ Extra 5% OFF on Prepaid"
  );

  // Carrier SMS Gateway State
  const [smsProvider, setSmsProvider] = useState<string>(settings.smsProvider || "simulator");
  const [smsApiKey, setSmsApiKey] = useState<string>(settings.smsApiKey || "");
  const [smsSenderId, setSmsSenderId] = useState<string>(settings.smsSenderId || "");
  const [testSmsPhone, setTestSmsPhone] = useState<string>("");

  // Available Promotional Coupons State
  const [availableCoupons, setAvailableCoupons] = useState<string>(
    settings.availableCoupons ||
      JSON.stringify(
        [
          { code: "SAVE10", title: "10% OFF on all items", type: "percentage", value: 10, maxCap: 100 },
          { code: "FLAT50", title: "Flat ₹50 OFF", type: "fixed", value: 50, minSubtotal: 299 },
          { code: "CAP20", title: "20% OFF (Max ₹200)", type: "percentage", value: 20, maxCap: 200, minSubtotal: 500 },
        ],
        null,
        2
      )
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
    fd.append("metaPixelId", metaPixelId);
    fd.append("metaCapiToken", metaCapiToken);
    fd.append("whatsappEnabled", whatsappEnabled.toString());
    fd.append("whatsappProvider", whatsappProvider);
    fd.append("whatsappApiKey", whatsappApiKey);
    fd.append("whatsappApiUrl", whatsappApiUrl);
    fd.append("whatsappSender", whatsappSender);
    fd.append("prepaidDiscountEnabled", prepaidDiscountEnabled.toString());
    fd.append("prepaidDiscountType", prepaidDiscountType);
    fd.append("prepaidDiscountValue", prepaidDiscountValue);
    fd.append("prepaidDiscountBadge", prepaidDiscountBadge);
    fd.append("smsProvider", smsProvider);
    fd.append("smsApiKey", smsApiKey);
    fd.append("smsSenderId", smsSenderId);
    fd.append("availableCoupons", availableCoupons);
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
    metaPixelId,
    metaCapiToken,
    whatsappEnabled,
    whatsappProvider,
    whatsappApiKey,
    whatsappApiUrl,
    whatsappSender,
    prepaidDiscountEnabled,
    prepaidDiscountType,
    prepaidDiscountValue,
    prepaidDiscountBadge,
    smsProvider,
    smsApiKey,
    smsSenderId,
    availableCoupons,
    submit,
  ]);

  const handleTestSms = useCallback(() => {
    const fd = new FormData();
    fd.append("intent", "test_sms");
    fd.append("testSmsPhone", testSmsPhone);
    fd.append("smsProvider", smsProvider);
    fd.append("smsApiKey", smsApiKey);
    fd.append("smsSenderId", smsSenderId);
    submit(fd, { method: "post" });
  }, [testSmsPhone, smsProvider, smsApiKey, smsSenderId, submit]);

  const handleTestMetaCapi = useCallback(() => {
    const fd = new FormData();
    fd.append("intent", "test_meta_capi");
    fd.append("metaPixelId", metaPixelId);
    fd.append("metaCapiToken", metaCapiToken);
    fd.append("testEventCode", testEventCode);
    submit(fd, { method: "post" });
  }, [metaPixelId, metaCapiToken, testEventCode, submit]);

  const handleTestWhatsApp = useCallback(() => {
    const fd = new FormData();
    fd.append("intent", "test_whatsapp");
    fd.append("testPhone", testPhone);
    fd.append("whatsappProvider", whatsappProvider);
    fd.append("whatsappApiKey", whatsappApiKey);
    fd.append("whatsappApiUrl", whatsappApiUrl);
    fd.append("whatsappSender", whatsappSender);
    submit(fd, { method: "post" });
  }, [testPhone, whatsappProvider, whatsappApiKey, whatsappApiUrl, whatsappSender, submit]);

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

              {/* Meta Conversions API (CAPI) Integration */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="100">
                      <Text as="h2" variant="headingMd">
                        Meta Conversions API (Server-Side Tracking)
                      </Text>
                      <Text as="p" tone="subdued">
                        Report full cart values directly to Meta to prevent ROAS degradation on Partial COD orders
                      </Text>
                    </BlockStack>
                    <Badge tone={metaPixelId && metaCapiToken ? "success" : "attention"}>
                      {metaPixelId && metaCapiToken ? "CONFIGURED" : "NOT SET"}
                    </Badge>
                  </InlineStack>

                  <Banner tone="info">
                    <p>
                      <strong>Why this matters:</strong> Standard browser pixels break on Draft Orders or only report the ₹100 online deposit. 
                      Server-Side CAPI automatically intercepts order creation on Shopify and reports the true full cart value (Deposit + Doorstep Balance) 
                      to Meta Events Manager with SHA-256 hashed customer data for optimal Event Quality Match.
                    </p>
                  </Banner>

                  <FormLayout>
                    <TextField
                      label="Meta (Facebook) Pixel ID"
                      value={metaPixelId}
                      onChange={(val) => setMetaPixelId(val)}
                      autoComplete="off"
                      placeholder="e.g. 123456789012345"
                      helpText="Found in Meta Events Manager > Data Sources > Settings > Dataset ID / Pixel ID."
                    />

                    <TextField
                      label="Conversions API Access Token"
                      type={showToken ? "text" : "password"}
                      value={metaCapiToken}
                      onChange={(val) => setMetaCapiToken(val)}
                      autoComplete="off"
                      placeholder="EAAB..."
                      helpText="Generated in Meta Events Manager > Settings > Conversions API > Generate access token."
                      connectedRight={
                        <Button onClick={() => setShowToken(!showToken)}>
                          {showToken ? "Hide" : "Show"}
                        </Button>
                      }
                    />

                    <Divider />

                    <BlockStack gap="200">
                      <Text as="h3" variant="headingSm">
                        Meta Events Manager Verification
                      </Text>
                      <TextField
                        label="Test Event Code (Optional)"
                        value={testEventCode}
                        onChange={(val) => setTestEventCode(val)}
                        autoComplete="off"
                        placeholder="e.g. TEST12345"
                        helpText="Paste the Test Code from Meta Events Manager > Test Events tab to view immediate real-time payload verification."
                      />
                      <Box paddingBlockStart="200">
                        <Button
                          onClick={handleTestMetaCapi}
                          loading={isSaving}
                          disabled={!metaPixelId || !metaCapiToken}
                        >
                          Send Test Event to Meta
                        </Button>
                      </Box>
                    </BlockStack>
                  </FormLayout>
                </BlockStack>
              </Card>

              {/* WhatsApp OTP & Courier Reminders */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="100">
                      <Text as="h2" variant="headingMd">
                        WhatsApp OTP & Balance Dunning
                      </Text>
                      <Text as="p" tone="subdued">
                        Verify real mobile numbers via WhatsApp OTP and automate out-for-delivery courier balance reminders
                      </Text>
                    </BlockStack>
                    <Badge tone={whatsappEnabled ? "success" : "attention"}>
                      {whatsappEnabled ? "OTP ACTIVE" : "OTP OFF"}
                    </Badge>
                  </InlineStack>

                  <Checkbox
                    label="Require Pre-Checkout WhatsApp OTP Verification"
                    checked={whatsappEnabled}
                    onChange={(newVal) => setWhatsappEnabled(newVal)}
                    helpText="When enabled, buyers selecting Partial COD must verify a 6-digit OTP received on WhatsApp before draft orders are created. Eliminates ghost and fake orders."
                  />

                  <FormLayout>
                    <Select
                      label="WhatsApp Messaging Provider"
                      options={[
                        { label: "Built-in Sandbox Simulator (For development & testing)", value: "simulator" },
                        { label: "Interakt WhatsApp Business API (Recommended for India)", value: "interakt" },
                        { label: "Twilio Programmable Messaging (Global)", value: "twilio" },
                      ]}
                      value={whatsappProvider}
                      onChange={(val) => setWhatsappProvider(val as any)}
                    />

                    {whatsappProvider !== "simulator" && (
                      <BlockStack gap="300">
                        <TextField
                          label={whatsappProvider === "twilio" ? "Twilio Auth Token" : "Interakt Secret API Key"}
                          type="password"
                          value={whatsappApiKey}
                          onChange={(val) => setWhatsappApiKey(val)}
                          autoComplete="off"
                          placeholder="Your WhatsApp API secret key"
                        />

                        {whatsappProvider === "twilio" && (
                          <TextField
                            label="Twilio Account SID"
                            value={whatsappApiUrl}
                            onChange={(val) => setWhatsappApiUrl(val)}
                            autoComplete="off"
                            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          />
                        )}

                        <TextField
                          label={whatsappProvider === "twilio" ? "Twilio WhatsApp Sender Number" : "Interakt Sender Channel ID"}
                          value={whatsappSender}
                          onChange={(val) => setWhatsappSender(val)}
                          autoComplete="off"
                          placeholder={whatsappProvider === "twilio" ? "whatsapp:+14155238886" : "e.g. default"}
                        />
                      </BlockStack>
                    )}

                    <Divider />

                    <BlockStack gap="200">
                      <Text as="h3" variant="headingSm">
                        Test WhatsApp Delivery
                      </Text>
                      <TextField
                        label="Test Mobile Number"
                        value={testPhone}
                        onChange={(val) => setTestPhone(val)}
                        autoComplete="off"
                        placeholder="e.g. 9876543210"
                        helpText="Enter a 10-digit mobile number to dispatch a live test OTP message."
                      />
                      <Box paddingBlockStart="200">
                        <Button
                          onClick={handleTestWhatsApp}
                          loading={isSaving}
                          disabled={!testPhone || testPhone.length < 10}
                        >
                          Send Test WhatsApp Message
                        </Button>
                      </Box>
                    </BlockStack>
                  </FormLayout>
                </BlockStack>
              </Card>

              {/* Extra Prepaid Discount Incentive */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="100">
                      <Text as="h2" variant="headingMd">
                        Extra Prepaid Order Discount
                      </Text>
                      <Text as="p" tone="subdued">
                        Encourage buyers to choose 100% upfront online payment instead of COD with an extra discount and prominent banner
                      </Text>
                    </BlockStack>
                    <Badge tone={prepaidDiscountEnabled ? "success" : "attention"}>
                      {prepaidDiscountEnabled ? "PREPAID SAVINGS ON" : "PREPAID SAVINGS OFF"}
                    </Badge>
                  </InlineStack>

                  <Checkbox
                    label="Offer Extra Discount on Full Prepaid Orders"
                    checked={prepaidDiscountEnabled}
                    onChange={(newVal) => setPrepaidDiscountEnabled(newVal)}
                    helpText="Applies an extra discount when the customer selects Option 1 (Pay Full Amount Now) in the checkout pop-up."
                  />

                  {prepaidDiscountEnabled && (
                    <FormLayout>
                      <FormLayout.Group>
                        <Select
                          label="Prepaid Discount Type"
                          options={[
                            { label: "Percentage (%) Off", value: "percentage" },
                            { label: "Fixed Amount (₹) Off", value: "fixed" },
                          ]}
                          value={prepaidDiscountType}
                          onChange={(val) => setPrepaidDiscountType(val as "fixed" | "percentage")}
                        />
                        <TextField
                          label="Prepaid Discount Value"
                          type="number"
                          value={prepaidDiscountValue}
                          onChange={(val) => setPrepaidDiscountValue(val)}
                          autoComplete="off"
                          prefix={prepaidDiscountType === "fixed" ? "₹" : undefined}
                          suffix={prepaidDiscountType === "percentage" ? "%" : undefined}
                          helpText="e.g. 5 for 5% OFF or 50 for flat ₹50 OFF"
                        />
                      </FormLayout.Group>

                      <TextField
                        label="Top-Right Corner Badge Tag"
                        value={prepaidDiscountBadge}
                        onChange={(val) => setPrepaidDiscountBadge(val)}
                        autoComplete="off"
                        placeholder="⚡ Extra 5% OFF on Prepaid"
                        helpText="Rendered on the top-right corner of Option 1 (Full Prepaid) inside the storefront modal."
                      />
                    </FormLayout>
                  )}
                </BlockStack>
              </Card>

              {/* Carrier SMS OTP Gateway */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="100">
                      <Text as="h2" variant="headingMd">
                        Carrier SMS OTP Gateway
                      </Text>
                      <Text as="p" tone="subdued">
                        Deliver 6-digit OTP codes via direct cellular SMS to buyer phones (works seamlessly across India & globally)
                      </Text>
                    </BlockStack>
                    <Badge tone={smsProvider === "simulator" ? "info" : "success"}>
                      {smsProvider === "simulator" ? "SMS SIMULATOR" : smsProvider.toUpperCase() + " LIVE"}
                    </Badge>
                  </InlineStack>

                  <FormLayout>
                    <Select
                      label="SMS Delivery Provider"
                      options={[
                        { label: "Built-in Sandbox Simulator (Zero cost, testing with 123456)", value: "simulator" },
                        { label: "Fast2SMS (Recommended for India - ₹0.15/SMS, instant OTP API)", value: "fast2sms" },
                        { label: "Twilio SMS (Global cellular SMS carrier)", value: "twilio" },
                      ]}
                      value={smsProvider}
                      onChange={(val) => setSmsProvider(val)}
                      helpText={
                        smsProvider === "fast2sms"
                          ? "Fast2SMS delivers OTPs directly to Indian mobile numbers via Quick OTP without needing DLT approval for testing."
                          : smsProvider === "simulator"
                          ? "Sandbox mode: Displays the OTP code in the terminal logs and accepts 123456 for instant testing."
                          : "Twilio delivers carrier SMS globally."
                      }
                    />

                    {smsProvider === "fast2sms" && (
                      <BlockStack gap="300">
                        <TextField
                          label="Fast2SMS Authorization API Key"
                          type="password"
                          value={smsApiKey}
                          onChange={(val) => setSmsApiKey(val)}
                          autoComplete="off"
                          placeholder="Paste Fast2SMS authorization key from fast2sms.com"
                          helpText="Obtain from fast2sms.com -> Dev API -> Authorization Key"
                        />
                        <TextField
                          label="Fast2SMS Sender ID / Entity ID (Optional)"
                          value={smsSenderId}
                          onChange={(val) => setSmsSenderId(val)}
                          autoComplete="off"
                          placeholder="FSTSMS (Default)"
                        />
                      </BlockStack>
                    )}

                    {smsProvider === "twilio" && (
                      <BlockStack gap="300">
                        <TextField
                          label="Twilio Auth Token"
                          type="password"
                          value={smsApiKey}
                          onChange={(val) => setSmsApiKey(val)}
                          autoComplete="off"
                          placeholder="Your Twilio Auth Token"
                        />
                        <TextField
                          label="Twilio Sender Phone Number"
                          value={smsSenderId}
                          onChange={(val) => setSmsSenderId(val)}
                          autoComplete="off"
                          placeholder="+1xxxxxxxxxx"
                        />
                      </BlockStack>
                    )}

                    <Divider />

                    <BlockStack gap="200">
                      <Text as="h3" variant="headingSm">
                        Test SMS Dispatch
                      </Text>
                      <TextField
                        label="Test Mobile Number"
                        value={testSmsPhone}
                        onChange={(val) => setTestSmsPhone(val)}
                        autoComplete="off"
                        placeholder="e.g. 9876543210"
                        helpText="Enter a 10-digit mobile number to verify live SMS delivery."
                      />
                      <Box paddingBlockStart="200">
                        <Button
                          onClick={handleTestSms}
                          loading={isSaving}
                          disabled={!testSmsPhone || testSmsPhone.replace(/[^0-9]/g, "").length < 10}
                        >
                          Send Test SMS OTP
                        </Button>
                      </Box>
                    </BlockStack>
                  </FormLayout>
                </BlockStack>
              </Card>

              {/* Promotional Coupon Codes & Deal Chips */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="100">
                      <Text as="h2" variant="headingMd">
                        Pop-up Coupon Codes & Deal Chips
                      </Text>
                      <Text as="p" tone="subdued">
                        Configure promotional discount codes presented as one-click chips in the checkout modal
                      </Text>
                    </BlockStack>
                    <Badge tone="info">PROMO CHIPS</Badge>
                  </InlineStack>

                  <TextField
                    label="Available Promotional Coupons (JSON Array)"
                    value={availableCoupons}
                    onChange={(val) => setAvailableCoupons(val)}
                    multiline={6}
                    autoComplete="off"
                    helpText='Define coupon options displayed to customers. Supported properties: "code", "title", "type" ("percentage" | "fixed"), "value", "maxCap", "minSubtotal".'
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
