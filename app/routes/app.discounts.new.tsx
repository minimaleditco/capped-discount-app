import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  useActionData,
  useLoaderData,
  useNavigation,
  useSubmit,
  useNavigate,
} from "@remix-run/react";
import { useState, useCallback, useMemo } from "react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Select,
  ChoiceList,
  Checkbox,
  Button,
  Banner,
  Text,
  BlockStack,
  InlineStack,
  Divider,
  Box,
  Badge,
  List,
} from "@shopify/polaris";
import type { CappedDiscountConfig, DiscountMethod } from "~/types/discount";
import {
  DISCOUNT_CODE_APP_CREATE,
  DISCOUNT_AUTOMATIC_APP_CREATE,
} from "~/graphql/mutations";
import { GET_FUNCTION_ID } from "~/graphql/queries";
import { authenticate } from "../shopify.server";
import { db } from "../db.server";

interface ActionData {
  errors?: string[];
  fieldErrors?: Record<string, string>;
}

export interface PreviewSimulation {
  subtotal: number;
  discount: number;
  isCapped: boolean;
  notEligible: boolean;
  finalTotal: number;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "CA$",
  AUD: "AU$",
  JPY: "¥",
};

const CURRENCY_OPTIONS = [
  { label: "INR (₹) - Indian Rupee", value: "INR" },
  { label: "USD ($) - US Dollar", value: "USD" },
  { label: "EUR (€) - Euro", value: "EUR" },
  { label: "GBP (£) - British Pound", value: "GBP" },
  { label: "CAD ($) - Canadian Dollar", value: "CAD" },
  { label: "AUD ($) - Australian Dollar", value: "AUD" },
  { label: "JPY (¥) - Japanese Yen", value: "JPY" },
];

function getCurrencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code.toUpperCase()] || `${code} `;
}

function formatCurrency(amount: number, currencyCode: string): string {
  const symbol = getCurrencySymbol(currencyCode);
  return `${symbol}${amount.toLocaleString()}`;
}

function getNowDateTimeLocal(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function generateRandomCode(percentage?: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let randomPart = "";
  for (let i = 0; i < 5; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const prefix = percentage && percentage > 0 ? `SAVE${Math.round(percentage)}` : "CAPPED";
  return `${prefix}-${randomPart}`;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session, redirect } = await authenticate.admin(request);

  try {
    const response = await admin.graphql(GET_FUNCTION_ID);
    const result: any = await response.json();

    if (result.errors && result.errors.length > 0) {
      console.error("GraphQL errors in GET_FUNCTION_ID:", result.errors);
    }

    const functions = result.data?.shopifyFunctions?.nodes || [];
    const discountFunction = functions.find(
      (fn: any) =>
        fn.apiType?.toLowerCase().includes("order_discount") ||
        fn.apiType?.toLowerCase().includes("discount")
    ) || functions[0];

    const functionId = discountFunction?.id || "";

    return json({ functionId, availableFunctions: functions, queryErrors: result.errors || null });
  } catch (error: any) {
    if (error instanceof Response && error.status >= 300 && error.status < 400) throw error;

    let errorDetail = "";
    const raw = error?.cause?.text
      ? error.cause
      : (error?.text ? error : (error?.response?.text ? error.response : null));

    if (raw && typeof raw.text === "function") {
      try {
        const text = await raw.clone().text();
        console.error("Shopify Admin API Response in GET_FUNCTION_ID:", raw.status, text);
        try {
          const jsonBody = JSON.parse(text);
          errorDetail = typeof jsonBody?.errors === "string"
            ? jsonBody.errors
            : (Array.isArray(jsonBody?.errors)
                ? jsonBody.errors.map((e: any) => e.message || JSON.stringify(e)).join(", ")
                : (jsonBody?.errors?.message || jsonBody?.message || text));
        } catch {
          errorDetail = text;
        }
      } catch {
        errorDetail = `HTTP ${raw.status}: ${raw.statusText || "Forbidden"}`;
      }
    } else {
      console.error("Error fetching function ID in discounts.new loader:", error);
      errorDetail = error?.message || "Failed to query functions";
    }

    return json({ functionId: "", availableFunctions: [], queryErrors: [errorDetail] });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session, redirect } = await authenticate.admin(request);
  const formData = await request.formData();

  const method = (formData.get("method") as DiscountMethod) || "code";
  const title = (formData.get("title") as string)?.trim() || "";
  const code = (formData.get("code") as string)?.trim() || "";
  const percentageRaw = formData.get("percentage") as string;
  const maxCapAmountRaw = formData.get("maxCapAmount") as string;
  const currencyCode = ((formData.get("currencyCode") as string) || "INR").trim().toUpperCase();
  const minSubtotalRaw = formData.get("minSubtotal") as string;
  const discountMessage = (formData.get("discountMessage") as string)?.trim() || "";
  const startsAt = (formData.get("startsAt") as string)?.trim() || "";
  const endsAt = (formData.get("endsAt") as string)?.trim() || "";
  const combinesWithOrderDiscounts = formData.get("combinesWithOrderDiscounts") === "true";
  const combinesWithProductDiscounts = formData.get("combinesWithProductDiscounts") === "true";
  const combinesWithShippingDiscounts = formData.get("combinesWithShippingDiscounts") === "true";
  const functionId = (formData.get("functionId") as string)?.trim() || "";

  const fieldErrors: Record<string, string> = {};

  if (!title) {
    fieldErrors.title = "Discount title is required.";
  }

  if (method === "code" && !code) {
    fieldErrors.code = "Discount code is required for code discounts.";
  }

  const percentage = parseFloat(percentageRaw);
  if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
    fieldErrors.percentage = "Percentage must be between 0.01% and 100%.";
  }

  const maxCapAmount = parseFloat(maxCapAmountRaw);
  if (isNaN(maxCapAmount) || maxCapAmount <= 0) {
    fieldErrors.maxCapAmount = "Maximum cap amount must be greater than 0.";
  }

  const minSubtotal = minSubtotalRaw ? parseFloat(minSubtotalRaw) : 0;
  if (isNaN(minSubtotal) || minSubtotal < 0) {
    fieldErrors.minSubtotal = "Minimum subtotal cannot be negative.";
  }

  if (!startsAt) {
    fieldErrors.startsAt = "Start date and time is required.";
  }

  let formattedStartsAt = "";
  try {
    const startDate = new Date(startsAt);
    if (isNaN(startDate.getTime())) {
      fieldErrors.startsAt = "Invalid start date format.";
    } else {
      formattedStartsAt = startDate.toISOString();
    }
  } catch {
    fieldErrors.startsAt = "Invalid start date format.";
  }

  let formattedEndsAt: string | null = null;
  if (endsAt) {
    try {
      const endDate = new Date(endsAt);
      if (isNaN(endDate.getTime())) {
        fieldErrors.endsAt = "Invalid end date format.";
      } else if (new Date(startsAt) >= endDate) {
        fieldErrors.endsAt = "End date must be after start date.";
      } else {
        formattedEndsAt = endDate.toISOString();
      }
    } catch {
      fieldErrors.endsAt = "Invalid end date format.";
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return json<ActionData>({ fieldErrors }, { status: 400 });
  }

  const config: CappedDiscountConfig = {
    percentage,
    maxCapAmount,
    currencyCode,
    minSubtotal,
    discountMessage:
      discountMessage || `${percentage}% off up to ${getCurrencySymbol(currencyCode)}${maxCapAmount}`,
  };

  const functionTarget = functionId
    ? { functionId }
    : { functionHandle: "capped-discount-order" };

  try {
    if (method === "code") {
      const variables = {
        discount: {
          title,
          code,
          ...functionTarget,
          startsAt: formattedStartsAt,
          endsAt: formattedEndsAt,
          combinesWith: {
            orderDiscounts: combinesWithOrderDiscounts,
            productDiscounts: combinesWithProductDiscounts,
            shippingDiscounts: combinesWithShippingDiscounts,
          },
          metafields: [
            {
              namespace: "capped_discount",
              key: "configuration",
              type: "json",
              value: JSON.stringify(config),
            },
          ],
        },
      };

      const response = await admin.graphql(DISCOUNT_CODE_APP_CREATE, {
        variables,
      });

      const result: any = await response.json();

      if (result.errors && result.errors.length > 0) {
        return json<ActionData>(
          { errors: result.errors.map((e: { message: string }) => e.message) },
          { status: 500 }
        );
      }

      const userErrors = result.data?.discountCodeAppCreate?.userErrors || [];
      if (userErrors.length > 0) {
        return json<ActionData>(
          { errors: userErrors.map((e: { message: string }) => e.message) },
          { status: 422 }
        );
      }
    } else {
      const variables = {
        automaticAppDiscount: {
          title,
          ...functionTarget,
          startsAt: formattedStartsAt,
          endsAt: formattedEndsAt,
          combinesWith: {
            orderDiscounts: combinesWithOrderDiscounts,
            productDiscounts: combinesWithProductDiscounts,
            shippingDiscounts: combinesWithShippingDiscounts,
          },
          metafields: [
            {
              namespace: "capped_discount",
              key: "configuration",
              type: "json",
              value: JSON.stringify(config),
            },
          ],
        },
      };

      const response = await admin.graphql(DISCOUNT_AUTOMATIC_APP_CREATE, {
        variables,
      });

      const result: any = await response.json();

      if (result.errors && result.errors.length > 0) {
        return json<ActionData>(
          { errors: result.errors.map((e: { message: string }) => e.message) },
          { status: 500 }
        );
      }

      const userErrors = result.data?.discountAutomaticAppCreate?.userErrors || [];
      if (userErrors.length > 0) {
        return json<ActionData>(
          { errors: userErrors.map((e: { message: string }) => e.message) },
          { status: 422 }
        );
      }
    }

    return redirect("/app");
  } catch (error: any) {
    if (error instanceof Response && error.status >= 300 && error.status < 400) throw error;

    let errorDetail = "";
    const raw = error?.cause?.text
      ? error.cause
      : (error?.text ? error : (error?.response?.text ? error.response : null));

    if (raw && typeof raw.text === "function") {
      try {
        const text = await raw.clone().text();
        console.error("Shopify Admin API Response in discount creation mutation:", raw.status, text);
        try {
          const jsonBody = JSON.parse(text);
          errorDetail = typeof jsonBody?.errors === "string"
            ? jsonBody.errors
            : (Array.isArray(jsonBody?.errors)
                ? jsonBody.errors.map((e: any) => e.message || JSON.stringify(e)).join(", ")
                : (jsonBody?.errors?.message || jsonBody?.message || text));
        } catch {
          errorDetail = text;
        }
      } catch {
        errorDetail = `HTTP ${raw.status}: ${raw.statusText || "Forbidden"}`;
      }
    } else {
      console.error("Error executing discount creation mutation:", error);
      errorDetail = error?.message || "Failed to create discount on Shopify.";
    }

    return json<ActionData>(
      { errors: [errorDetail] },
      { status: 500 }
    );
  }
};

export default function CreateDiscountRoute() {
  const { functionId } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const navigate = useNavigate();

  const isSubmitting = navigation.state === "submitting" || navigation.state === "loading";

  // Form State
  const [method, setMethod] = useState<DiscountMethod>("code");
  const [title, setTitle] = useState("80% off up to ₹200");
  const [code, setCode] = useState("SAVE80");
  const [percentage, setPercentage] = useState("80");
  const [maxCapAmount, setMaxCapAmount] = useState("200");
  const [currencyCode, setCurrencyCode] = useState("INR");
  const [minSubtotal, setMinSubtotal] = useState("0");
  const [discountMessage, setDiscountMessage] = useState("");
  const [startsAt, setStartsAt] = useState(getNowDateTimeLocal());
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endsAt, setEndsAt] = useState("");
  const [combinesWithOrderDiscounts, setCombinesWithOrderDiscounts] = useState(false);
  const [combinesWithProductDiscounts, setCombinesWithProductDiscounts] = useState(true);
  const [combinesWithShippingDiscounts, setCombinesWithShippingDiscounts] = useState(true);

  // Client Validation State
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  const handleGenerateRandomCode = useCallback(() => {
    const num = parseFloat(percentage);
    const newCode = generateRandomCode(isNaN(num) ? undefined : num);
    setCode(newCode);
  }, [percentage]);

  const currencySymbol = useMemo(() => getCurrencySymbol(currencyCode), [currencyCode]);

  // Preview calculations
  const parsedPercentage = parseFloat(percentage) || 0;
  const parsedCap = parseFloat(maxCapAmount) || 0;
  const parsedMinSubtotal = parseFloat(minSubtotal) || 0;

  const previewSimulations: PreviewSimulation[] = useMemo(() => {
    const samples = [100, 250, 1000];
    return samples.map((subtotal) => {
      if (parsedMinSubtotal > 0 && subtotal < parsedMinSubtotal) {
        return {
          subtotal,
          discount: 0,
          isCapped: false,
          notEligible: true,
          finalTotal: subtotal,
        };
      }
      const rawDiscount = (subtotal * parsedPercentage) / 100;
      const actualDiscount = Math.min(rawDiscount, parsedCap);
      const isCapped = rawDiscount > parsedCap;
      const finalTotal = Math.max(0, subtotal - actualDiscount);

      return {
        subtotal,
        discount: actualDiscount,
        isCapped,
        notEligible: false,
        finalTotal,
      };
    });
  }, [parsedPercentage, parsedCap, parsedMinSubtotal]);

  const handleSubmit = useCallback(() => {
    const errors: Record<string, string> = {};

    if (!title.trim()) {
      errors.title = "Discount title is required.";
    }

    if (method === "code" && !code.trim()) {
      errors.code = "Discount code is required.";
    }

    const pctNum = parseFloat(percentage);
    if (isNaN(pctNum) || pctNum <= 0 || pctNum > 100) {
      errors.percentage = "Percentage must be between 0.01% and 100%.";
    }

    const capNum = parseFloat(maxCapAmount);
    if (isNaN(capNum) || capNum <= 0) {
      errors.maxCapAmount = "Maximum cap amount must be greater than 0.";
    }

    if (!startsAt) {
      errors.startsAt = "Start date is required.";
    }

    if (hasEndDate && endsAt) {
      if (new Date(startsAt) >= new Date(endsAt)) {
        errors.endsAt = "End date must be after start date.";
      }
    }

    if (Object.keys(errors).length > 0) {
      setClientErrors(errors);
      return;
    }

    setClientErrors({});

    const formData = new FormData();
    formData.append("method", method);
    formData.append("title", title.trim());
    formData.append("code", code.trim());
    formData.append("percentage", percentage);
    formData.append("maxCapAmount", maxCapAmount);
    formData.append("currencyCode", currencyCode);
    formData.append("minSubtotal", minSubtotal || "0");
    formData.append("discountMessage", discountMessage.trim());
    formData.append("startsAt", startsAt);
    formData.append("endsAt", hasEndDate ? endsAt : "");
    formData.append("combinesWithOrderDiscounts", combinesWithOrderDiscounts.toString());
    formData.append("combinesWithProductDiscounts", combinesWithProductDiscounts.toString());
    formData.append("combinesWithShippingDiscounts", combinesWithShippingDiscounts.toString());
    formData.append("functionId", functionId);

    submit(formData, { method: "post" });
  }, [
    title,
    method,
    code,
    percentage,
    maxCapAmount,
    currencyCode,
    minSubtotal,
    discountMessage,
    startsAt,
    hasEndDate,
    endsAt,
    combinesWithOrderDiscounts,
    combinesWithProductDiscounts,
    combinesWithShippingDiscounts,
    functionId,
    submit,
  ]);

  const activeErrors = {
    ...clientErrors,
    ...(actionData?.fieldErrors || {}),
  };

  return (
    <Page
      title="Create Capped Discount"
      backAction={{ content: "Discounts", url: "/app" }}
      primaryAction={{
        content: "Save discount",
        loading: isSubmitting,
        disabled: isSubmitting,
        onAction: handleSubmit,
      }}
      secondaryActions={[
        {
          content: "Discard",
          url: "/app",
        },
      ]}
    >
      <BlockStack gap="500">
        {actionData?.errors && actionData.errors.length > 0 && (
          <Banner tone="critical" title="There were errors creating this discount">
            <List>
              {actionData.errors.map((msg: string, idx: number) => (
                <List.Item key={idx}>{msg}</List.Item>
              ))}
            </List>
          </Banner>
        )}

        <Layout>
          {/* Main Form Section */}
          <Layout.Section>
            <BlockStack gap="500">
              {/* Card 1: Method */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Discount Method
                  </Text>
                  <ChoiceList
                    title="Select how customers receive this discount"
                    titleHidden
                    choices={[
                      {
                        label: "Discount Code",
                        value: "code",
                        helpText: "Customers enter a coupon code during checkout or in cart.",
                      },
                      {
                        label: "Automatic Discount",
                        value: "automatic",
                        helpText: "Applied automatically to eligible carts without entering a code.",
                      },
                    ]}
                    selected={[method]}
                    onChange={(selected: string[]) => setMethod(selected[0] as DiscountMethod)}
                  />
                </BlockStack>
              </Card>

              {/* Card 2: Code (Conditional) */}
              {method === "code" && (
                <Card>
                  <BlockStack gap="400">
                    <InlineStack align="space-between">
                      <Text as="h2" variant="headingMd">
                        Discount Code
                      </Text>
                      <Button variant="plain" onClick={handleGenerateRandomCode}>
                        Generate Random Code
                      </Button>
                    </InlineStack>
                    <TextField
                      label="Code"
                      value={code}
                      onChange={setCode}
                      autoComplete="off"
                      error={activeErrors.code}
                      helpText="Customers enter this code at checkout. Codes are not case sensitive."
                    />
                  </BlockStack>
                </Card>
              )}

              {/* Card 3: Title */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Title
                  </Text>
                  <TextField
                    label="Discount Title"
                    value={title}
                    onChange={setTitle}
                    autoComplete="off"
                    error={activeErrors.title}
                    placeholder="e.g. Monsoon Special: 80% off up to ₹200"
                    helpText="Internal title displayed on reports and admin discount list."
                  />
                  <TextField
                    label="Customer-facing Message (Optional)"
                    value={discountMessage}
                    onChange={setDiscountMessage}
                    autoComplete="off"
                    placeholder={`e.g. ${percentage}% off applied (max ${currencySymbol}${maxCapAmount})`}
                    helpText="Displayed on the customer's cart or checkout receipt."
                  />
                </BlockStack>
              </Card>

              {/* Card 4: Discount Value & Cap */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Discount Value & Cap Limits
                  </Text>
                  <Text as="p" tone="subdued" variant="bodySm">
                    Set the percentage discount and the absolute maximum currency cap to prevent
                    unintended discount amounts on large orders.
                  </Text>
                  <FormLayout>
                    <FormLayout.Group>
                      <TextField
                        label="Discount Percentage"
                        type="number"
                        suffix="%"
                        min={0.01}
                        max={100}
                        step={0.5}
                        value={percentage}
                        onChange={setPercentage}
                        autoComplete="off"
                        error={activeErrors.percentage}
                        helpText="Percentage reduction off eligible items."
                      />
                      <TextField
                        label="Maximum Cap Amount"
                        type="number"
                        prefix={currencySymbol}
                        min={0.01}
                        step={1}
                        value={maxCapAmount}
                        onChange={setMaxCapAmount}
                        autoComplete="off"
                        error={activeErrors.maxCapAmount}
                        helpText="Ceiling amount. The discount will never exceed this."
                      />
                    </FormLayout.Group>

                    <Select
                      label="Currency"
                      options={CURRENCY_OPTIONS}
                      value={currencyCode}
                      onChange={setCurrencyCode}
                      helpText="Currency used for capping and minimum order calculations."
                    />
                  </FormLayout>
                </BlockStack>
              </Card>

              {/* Card 5: Minimum Requirements */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Minimum Requirements
                  </Text>
                  <TextField
                    label="Minimum Cart Subtotal"
                    type="number"
                    prefix={currencySymbol}
                    min={0}
                    step={1}
                    value={minSubtotal}
                    onChange={setMinSubtotal}
                    autoComplete="off"
                    error={activeErrors.minSubtotal}
                    helpText="Order subtotal must equal or exceed this amount before discount triggers. Set 0 for no minimum."
                  />
                </BlockStack>
              </Card>

              {/* Card 6: Active Dates */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Active Dates
                  </Text>
                  <FormLayout>
                    <TextField
                      label="Start Date & Time"
                      type="datetime-local"
                      value={startsAt}
                      onChange={setStartsAt}
                      autoComplete="off"
                      error={activeErrors.startsAt}
                    />

                    <Checkbox
                      label="Set end date"
                      checked={hasEndDate}
                      onChange={(checked: boolean) => {
                        setHasEndDate(checked);
                        if (!checked) setEndsAt("");
                        else if (!endsAt) setEndsAt(getNowDateTimeLocal());
                      }}
                    />

                    {hasEndDate && (
                      <TextField
                        label="End Date & Time"
                        type="datetime-local"
                        value={endsAt}
                        onChange={setEndsAt}
                        autoComplete="off"
                        error={activeErrors.endsAt}
                      />
                    )}
                  </FormLayout>
                </BlockStack>
              </Card>

              {/* Card 7: Combinations */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Combinations
                  </Text>
                  <Text as="p" tone="subdued" variant="bodySm">
                    Control which other discount classes can be combined with this capped discount.
                  </Text>
                  <BlockStack gap="200">
                    <Checkbox
                      label="Combines with other order discounts"
                      checked={combinesWithOrderDiscounts}
                      onChange={(checked: boolean) => setCombinesWithOrderDiscounts(checked)}
                      helpText="Allow this discount to stack with storewide order discounts."
                    />
                    <Checkbox
                      label="Combines with product discounts"
                      checked={combinesWithProductDiscounts}
                      onChange={(checked: boolean) => setCombinesWithProductDiscounts(checked)}
                      helpText="Allow this discount to stack with line-item product discounts."
                    />
                    <Checkbox
                      label="Combines with shipping discounts"
                      checked={combinesWithShippingDiscounts}
                      onChange={(checked: boolean) => setCombinesWithShippingDiscounts(checked)}
                      helpText="Allow customers to use free shipping or shipping discounts alongside this discount."
                    />
                  </BlockStack>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>

          {/* Sidebar Section */}
          <Layout.Section variant="oneThird">
            <BlockStack gap="500">
              {/* Card 8: Discount Preview Card (Summary) */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <Text as="h2" variant="headingMd">
                      Summary Preview
                    </Text>
                    <Badge tone="magic">Live Rule</Badge>
                  </InlineStack>

                  <Box
                    padding="300"
                    background="bg-surface-secondary"
                    borderRadius="200"
                  >
                    <BlockStack gap="100">
                      <Text as="span" variant="headingSm" fontWeight="bold">
                        {parsedPercentage}% off, capped at {formatCurrency(parsedCap, currencyCode)}
                      </Text>
                      <Text as="span" variant="bodySm" tone="subdued">
                        Type: {method === "code" ? `Code (${code || "NONE"})` : "Automatic"}
                      </Text>
                      {parsedMinSubtotal > 0 && (
                        <Text as="span" variant="bodySm" tone="subdued">
                          Min cart requirement: {formatCurrency(parsedMinSubtotal, currencyCode)}
                        </Text>
                      )}
                    </BlockStack>
                  </Box>

                  <Divider />

                  <Text as="h3" variant="headingSm">
                    Cart Examples
                  </Text>

                  <BlockStack gap="300">
                    {previewSimulations.map((sim: PreviewSimulation, i: number) => (
                      <Box
                        key={i}
                        padding="200"
                        borderWidth="0165"
                        borderColor="border-secondary"
                        borderRadius="150"
                      >
                        <BlockStack gap="100">
                          <InlineStack align="space-between">
                            <Text as="span" variant="bodySm" fontWeight="semibold">
                              Cart: {formatCurrency(sim.subtotal, currencyCode)}
                            </Text>
                            {sim.isCapped && (
                              <Badge tone="attention" size="small">
                                Capped
                              </Badge>
                            )}
                            {sim.notEligible && (
                              <Badge size="small">
                                Under min
                              </Badge>
                            )}
                          </InlineStack>
                          <InlineStack align="space-between">
                            <Text as="span" variant="bodySm" tone="subdued">
                              Discount applied:
                            </Text>
                            <Text
                              as="span"
                              variant="bodySm"
                              fontWeight="bold"
                              tone={sim.discount > 0 ? "success" : "subdued"}
                            >
                              -{formatCurrency(sim.discount, currencyCode)}
                            </Text>
                          </InlineStack>
                          <InlineStack align="space-between">
                            <Text as="span" variant="bodySm" tone="subdued">
                              Customer pays:
                            </Text>
                            <Text as="span" variant="bodySm" fontWeight="semibold">
                              {formatCurrency(sim.finalTotal, currencyCode)}
                            </Text>
                          </InlineStack>
                        </BlockStack>
                      </Box>
                    ))}
                  </BlockStack>
                </BlockStack>
              </Card>

              {/* Function Status Card */}
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingSm">
                    Shopify Function
                  </Text>
                  {functionId ? (
                    <InlineStack gap="200" align="start">
                      <Badge tone="success">Function Linked</Badge>
                      <Text as="span" variant="bodySm" tone="subdued">
                        ID: {functionId.slice(-8)}
                      </Text>
                    </InlineStack>
                  ) : (
                    <InlineStack gap="200" align="start">
                      <Badge tone="success">Function Linked</Badge>
                      <Text as="span" variant="bodySm" tone="subdued">
                        Handle: capped-discount-order
                      </Text>
                    </InlineStack>
                  )}
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
