import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  useActionData,
  useLoaderData,
  useNavigation,
  useSubmit,
  useNavigate,
  useRouteError,
} from "@remix-run/react";
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
  Modal,
  List,
} from "@shopify/polaris";
import type { CappedDiscountConfig, DiscountMethod } from "~/types/discount";
import {
  DISCOUNT_CODE_APP_UPDATE,
  DISCOUNT_AUTOMATIC_APP_UPDATE,
  DISCOUNT_CODE_DELETE,
  DISCOUNT_AUTOMATIC_DELETE,
  DISCOUNT_CODE_ACTIVATE,
  DISCOUNT_CODE_DEACTIVATE,
  DISCOUNT_AUTOMATIC_ACTIVATE,
  DISCOUNT_AUTOMATIC_DEACTIVATE,
} from "~/graphql/mutations";
import { GET_DISCOUNT_NODE } from "~/graphql/queries";
import { authenticate } from "../shopify.server";

interface ActionData {
  success?: boolean;
  message?: string;
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

function toDateTimeLocalString(isoDateString?: string | null): string {
  if (!isoDateString) return "";
  try {
    const d = new Date(isoDateString);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => n.toString().padStart(2, "0");
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return "";
  }
}

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const rawParamId = params.id;

  if (!rawParamId) {
    throw new Response("Missing discount ID parameter", { status: 400 });
  }

  // Extract clean numeric ID
  const cleanNumericId = rawParamId.split("/").pop() || rawParamId;
  const primaryId = rawParamId.startsWith("gid://")
    ? rawParamId
    : `gid://shopify/DiscountNode/${cleanNumericId}`;

  try {
    const response = await admin.graphql(GET_DISCOUNT_NODE, {
      variables: { id: primaryId },
    });

    const result: any = await response.json();
    let discountNode = result.data?.discountNode;

    if (!discountNode && !rawParamId.startsWith("gid://")) {
      const fallbackGids = [
        `gid://shopify/DiscountCodeNode/${cleanNumericId}`,
        `gid://shopify/DiscountAutomaticNode/${cleanNumericId}`,
      ];
      for (const fallbackId of fallbackGids) {
        const fbResponse = await admin.graphql(GET_DISCOUNT_NODE, {
          variables: { id: fallbackId },
        });
        const fbResult: any = await fbResponse.json();
        if (fbResult.data?.discountNode) {
          discountNode = fbResult.data.discountNode;
          break;
        }
      }
    }

    if (!discountNode) {
      console.error("Discount not found for ID:", primaryId, "result:", result);
      throw new Response("Discount not found", { status: 404 });
    }

    const id = discountNode.id || primaryId;
    const numericId = cleanNumericId;

    const discount = discountNode.discount || {};
    const isCode = discount.__typename === "DiscountCodeApp";
    const method: DiscountMethod = isCode ? "code" : "automatic";

    const code = isCode ? discount.codes?.nodes?.[0]?.code || "" : "";
    const status = discount.status || "ACTIVE";
    const startsAt = discount.startsAt || "";
    const endsAt = discount.endsAt || null;

    const combinesWith = discount.combinesWith || {
      orderDiscounts: false,
      productDiscounts: false,
      shippingDiscounts: false,
    };

    let config: CappedDiscountConfig = {
      percentage: 0,
      maxCapAmount: 0,
      currencyCode: "INR",
      minSubtotal: 0,
      discountMessage: "",
    };

    const metafieldId = discountNode.metafield?.id || null;

    if (discountNode.metafield?.value) {
      try {
        config = JSON.parse(discountNode.metafield.value);
      } catch (e) {
        console.error("Failed to parse existing metafield configuration JSON:", e);
      }
    }

    return json({
      id,
      numericId,
      metafieldId,
      method,
      title: discount.title || "",
      code,
      status,
      startsAt,
      endsAt,
      percentage: config.percentage || 0,
      maxCapAmount: config.maxCapAmount || 0,
      currencyCode: config.currencyCode || "INR",
      minSubtotal: config.minSubtotal || 0,
      discountMessage: config.discountMessage || "",
      combinesWith: {
        orderDiscounts: Boolean(combinesWith.orderDiscounts),
        productDiscounts: Boolean(combinesWith.productDiscounts),
        shippingDiscounts: Boolean(combinesWith.shippingDiscounts),
      },
    });
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Unexpected error in discounts.$id loader:", error);
    throw new Response(error?.message || "Failed to load discount node", { status: 500 });
  }
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, redirect } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("_action") as string;

  const rawParamId = params.id || "";
  const numericId = rawParamId.split("/").pop() || rawParamId;
  const method = (formData.get("method") as DiscountMethod) || "code";

  // App-level GID for updates (DiscountCodeApp / DiscountAutomaticApp)
  const appGid = method === "code"
    ? `gid://shopify/DiscountCodeApp/${numericId}`
    : `gid://shopify/DiscountAutomaticApp/${numericId}`;

  // Node-level GID for delete / activate / deactivate (DiscountCodeNode / DiscountAutomaticNode)
  const nodeGid = method === "code"
    ? `gid://shopify/DiscountCodeNode/${numericId}`
    : `gid://shopify/DiscountAutomaticNode/${numericId}`;

  // ACTION 1: DELETE DISCOUNT
  if (actionType === "delete") {
    try {
      if (method === "code") {
        let response = await admin.graphql(DISCOUNT_CODE_DELETE, {
          variables: { id: nodeGid },
        });
        let result: any = await response.json();
        let userErrors = result.data?.discountCodeDelete?.userErrors || [];
        if (userErrors.length > 0) {
          response = await admin.graphql(DISCOUNT_CODE_DELETE, {
            variables: { id: `gid://shopify/DiscountNode/${numericId}` },
          });
          result = await response.json();
          userErrors = result.data?.discountCodeDelete?.userErrors || [];
        }
        if (userErrors.length > 0) {
          return json<ActionData>(
            { errors: userErrors.map((e: { message: string }) => e.message) },
            { status: 422 }
          );
        }
      } else {
        let response = await admin.graphql(DISCOUNT_AUTOMATIC_DELETE, {
          variables: { id: nodeGid },
        });
        let result: any = await response.json();
        let userErrors = result.data?.discountAutomaticDelete?.userErrors || [];
        if (userErrors.length > 0) {
          response = await admin.graphql(DISCOUNT_AUTOMATIC_DELETE, {
            variables: { id: `gid://shopify/DiscountNode/${numericId}` },
          });
          result = await response.json();
          userErrors = result.data?.discountAutomaticDelete?.userErrors || [];
        }
        if (userErrors.length > 0) {
          return json<ActionData>(
            { errors: userErrors.map((e: { message: string }) => e.message) },
            { status: 422 }
          );
        }
      }

      return redirect("/app");
    } catch (error: any) {
      console.error("Error deleting discount:", error);
      return json<ActionData>(
        { errors: [error?.message || "Failed to delete discount."] },
        { status: 500 }
      );
    }
  }

  // ACTION 2: TOGGLE STATUS (ACTIVATE / DEACTIVATE)
  if (actionType === "toggleStatus") {
    const currentStatus = (formData.get("currentStatus") as string)?.toUpperCase();
    const shouldDeactivate = currentStatus === "ACTIVE";

    try {
      if (method === "code") {
        const mutation = shouldDeactivate ? DISCOUNT_CODE_DEACTIVATE : DISCOUNT_CODE_ACTIVATE;
        let response = await admin.graphql(mutation, { variables: { id: nodeGid } });
        let result: any = await response.json();
        let data = shouldDeactivate
          ? result.data?.discountCodeDeactivate
          : result.data?.discountCodeActivate;
        let userErrors = data?.userErrors || [];

        if (userErrors.length > 0) {
          response = await admin.graphql(mutation, { variables: { id: `gid://shopify/DiscountNode/${numericId}` } });
          result = await response.json();
          data = shouldDeactivate
            ? result.data?.discountCodeDeactivate
            : result.data?.discountCodeActivate;
          userErrors = data?.userErrors || [];
        }

        if (userErrors.length > 0) {
          return json<ActionData>(
            { errors: userErrors.map((e: { message: string }) => e.message) },
            { status: 422 }
          );
        }
      } else {
        const mutation = shouldDeactivate
          ? DISCOUNT_AUTOMATIC_DEACTIVATE
          : DISCOUNT_AUTOMATIC_ACTIVATE;
        let response = await admin.graphql(mutation, { variables: { id: nodeGid } });
        let result: any = await response.json();
        let data = shouldDeactivate
          ? result.data?.discountAutomaticDeactivate
          : result.data?.discountAutomaticActivate;
        let userErrors = data?.userErrors || [];

        if (userErrors.length > 0) {
          response = await admin.graphql(mutation, { variables: { id: `gid://shopify/DiscountNode/${numericId}` } });
          result = await response.json();
          data = shouldDeactivate
            ? result.data?.discountAutomaticDeactivate
            : result.data?.discountAutomaticActivate;
          userErrors = data?.userErrors || [];
        }

        if (userErrors.length > 0) {
          return json<ActionData>(
            { errors: userErrors.map((e: { message: string }) => e.message) },
            { status: 422 }
          );
        }
      }

      return json<ActionData>({
        success: true,
        message: `Discount successfully ${shouldDeactivate ? "deactivated" : "activated"}.`,
      });
    } catch (error: any) {
      console.error("Error toggling discount status:", error);
      return json<ActionData>(
        { errors: [error?.message || "Failed to update discount status."] },
        { status: 500 }
      );
    }
  }

  // ACTION 3: UPDATE DISCOUNT
  const title = (formData.get("title") as string)?.trim() || "";
  const percentageRaw = formData.get("percentage") as string;
  const maxCapAmountRaw = formData.get("maxCapAmount") as string;
  const currencyCode = ((formData.get("currencyCode") as string) || "INR").trim().toUpperCase();
  const minSubtotalRaw = formData.get("minSubtotal") as string;
  const discountMessage = (formData.get("discountMessage") as string)?.trim() || "";
  const startsAt = (formData.get("startsAt") as string)?.trim() || "";
  const endsAt = (formData.get("endsAt") as string)?.trim() || "";
  const metafieldId = (formData.get("metafieldId") as string) || undefined;
  const combinesWithOrderDiscounts = formData.get("combinesWithOrderDiscounts") === "true";
  const combinesWithProductDiscounts = formData.get("combinesWithProductDiscounts") === "true";
  const combinesWithShippingDiscounts = formData.get("combinesWithShippingDiscounts") === "true";

  const fieldErrors: Record<string, string> = {};

  if (!title) {
    fieldErrors.title = "Discount title is required.";
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

  const metafieldItem: any = {
    namespace: "capped_discount",
    key: "configuration",
    type: "json",
    value: JSON.stringify(config),
  };
  if (metafieldId) {
    metafieldItem.id = metafieldId;
  }

  try {
    if (method === "code") {
      const variables = {
        id: appGid,
        codeAppDiscount: {
          title,
          startsAt: formattedStartsAt,
          endsAt: formattedEndsAt,
          combinesWith: {
            orderDiscounts: combinesWithOrderDiscounts,
            productDiscounts: combinesWithProductDiscounts,
            shippingDiscounts: combinesWithShippingDiscounts,
          },
          metafields: [metafieldItem],
        },
      };

      let response = await admin.graphql(DISCOUNT_CODE_APP_UPDATE, { variables });
      let result: any = await response.json();

      if (result.errors && result.errors.length > 0) {
        return json<ActionData>(
          { errors: result.errors.map((e: { message: string }) => e.message) },
          { status: 500 }
        );
      }

      let userErrors = result.data?.discountCodeAppUpdate?.userErrors || [];
      if (userErrors.some((e: any) => e.message?.toLowerCase().includes("invalid id"))) {
        variables.id = `gid://shopify/DiscountNode/${numericId}`;
        response = await admin.graphql(DISCOUNT_CODE_APP_UPDATE, { variables });
        result = await response.json();
        userErrors = result.data?.discountCodeAppUpdate?.userErrors || [];
      }

      if (userErrors.length > 0) {
        return json<ActionData>(
          { errors: userErrors.map((e: { message: string }) => e.message) },
          { status: 422 }
        );
      }
    } else {
      const variables = {
        id: appGid,
        automaticAppDiscount: {
          title,
          startsAt: formattedStartsAt,
          endsAt: formattedEndsAt,
          combinesWith: {
            orderDiscounts: combinesWithOrderDiscounts,
            productDiscounts: combinesWithProductDiscounts,
            shippingDiscounts: combinesWithShippingDiscounts,
          },
          metafields: [metafieldItem],
        },
      };

      let response = await admin.graphql(DISCOUNT_AUTOMATIC_APP_UPDATE, { variables });
      let result: any = await response.json();

      if (result.errors && result.errors.length > 0) {
        return json<ActionData>(
          { errors: result.errors.map((e: { message: string }) => e.message) },
          { status: 500 }
        );
      }

      let userErrors = result.data?.discountAutomaticAppUpdate?.userErrors || [];
      if (userErrors.some((e: any) => e.message?.toLowerCase().includes("invalid id"))) {
        variables.id = `gid://shopify/DiscountNode/${numericId}`;
        response = await admin.graphql(DISCOUNT_AUTOMATIC_APP_UPDATE, { variables });
        result = await response.json();
        userErrors = result.data?.discountAutomaticAppUpdate?.userErrors || [];
      }

      if (userErrors.length > 0) {
        return json<ActionData>(
          { errors: userErrors.map((e: { message: string }) => e.message) },
          { status: 422 }
        );
      }
    }

    return json<ActionData>({
      success: true,
      message: "Discount configuration updated successfully.",
    });
  } catch (error: any) {
    console.error("Error executing discount update mutation:", error);
    return json<ActionData>(
      { errors: [error?.message || "Failed to update discount on Shopify."] },
      { status: 500 }
    );
  }
};

export default function EditDiscountRoute() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const navigate = useNavigate();

  const isSubmitting = navigation.state === "submitting" || navigation.state === "loading";

  // Form State initialized from loaderData
  const [title, setTitle] = useState(loaderData.title);
  const [percentage, setPercentage] = useState(loaderData.percentage.toString());
  const [maxCapAmount, setMaxCapAmount] = useState(loaderData.maxCapAmount.toString());
  const [currencyCode, setCurrencyCode] = useState(loaderData.currencyCode);
  const [minSubtotal, setMinSubtotal] = useState(loaderData.minSubtotal.toString());
  const [discountMessage, setDiscountMessage] = useState(loaderData.discountMessage);
  const [startsAt, setStartsAt] = useState(toDateTimeLocalString(loaderData.startsAt));
  const [hasEndDate, setHasEndDate] = useState(Boolean(loaderData.endsAt));
  const [endsAt, setEndsAt] = useState(toDateTimeLocalString(loaderData.endsAt));
  const [combinesWithOrderDiscounts, setCombinesWithOrderDiscounts] = useState(
    loaderData.combinesWith.orderDiscounts
  );
  const [combinesWithProductDiscounts, setCombinesWithProductDiscounts] = useState(
    loaderData.combinesWith.productDiscounts
  );
  const [combinesWithShippingDiscounts, setCombinesWithShippingDiscounts] = useState(
    loaderData.combinesWith.shippingDiscounts
  );

  // Client Validation State
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  // Modal State for Delete
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const currencySymbol = useMemo(() => getCurrencySymbol(currencyCode), [currencyCode]);

  // Status Badge
  const getStatusBadge = (status: string) => {
    const normalized = status.toUpperCase();
    switch (normalized) {
      case "ACTIVE":
        return <Badge tone="success">Active</Badge>;
      case "SCHEDULED":
        return <Badge tone="info">Scheduled</Badge>;
      case "EXPIRED":
        return <Badge tone="warning">Expired</Badge>;
      case "DEACTIVATED":
        return <Badge>Deactivated</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const isActive = loaderData.status.toUpperCase() === "ACTIVE";

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

  // Handle Update Submit
  const handleUpdate = useCallback(() => {
    const errors: Record<string, string> = {};

    if (!title.trim()) {
      errors.title = "Discount title is required.";
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
    formData.append("_action", "update");
    formData.append("method", loaderData.method);
    formData.append("title", title.trim());
    formData.append("percentage", percentage);
    formData.append("maxCapAmount", maxCapAmount);
    formData.append("currencyCode", currencyCode);
    formData.append("minSubtotal", minSubtotal || "0");
    formData.append("discountMessage", discountMessage.trim());
    formData.append("startsAt", startsAt);
    formData.append("endsAt", hasEndDate ? endsAt : "");
    if (loaderData.metafieldId) {
      formData.append("metafieldId", loaderData.metafieldId);
    }
    formData.append("combinesWithOrderDiscounts", combinesWithOrderDiscounts.toString());
    formData.append("combinesWithProductDiscounts", combinesWithProductDiscounts.toString());
    formData.append("combinesWithShippingDiscounts", combinesWithShippingDiscounts.toString());

    submit(formData, { method: "post" });
  }, [
    title,
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
    loaderData.method,
    loaderData.metafieldId,
    submit,
  ]);

  // Handle Toggle Status
  const handleToggleStatus = useCallback(() => {
    const formData = new FormData();
    formData.append("_action", "toggleStatus");
    formData.append("method", loaderData.method);
    formData.append("currentStatus", loaderData.status);
    submit(formData, { method: "post" });
  }, [loaderData.method, loaderData.status, submit]);

  // Handle Delete
  const handleDeleteConfirm = useCallback(() => {
    const formData = new FormData();
    formData.append("_action", "delete");
    formData.append("method", loaderData.method);
    submit(formData, { method: "post" });
    setIsDeleteModalOpen(false);
  }, [loaderData.method, submit]);

  const activeErrors = {
    ...clientErrors,
    ...(actionData?.fieldErrors || {}),
  };

  return (
    <Page
      title={loaderData.title || "Edit Discount"}
      subtitle={`Method: ${loaderData.method.toUpperCase()} • ID: ${loaderData.numericId}`}
      titleMetadata={getStatusBadge(loaderData.status)}
      backAction={{ content: "Discounts", url: "/app" }}
      primaryAction={{
        content: "Save",
        loading: isSubmitting,
        disabled: isSubmitting,
        onAction: handleUpdate,
      }}
      secondaryActions={[
        {
          content: isActive ? "Deactivate" : "Activate",
          onAction: handleToggleStatus,
          disabled: isSubmitting,
        },
        {
          content: "Delete discount",
          destructive: true,
          disabled: isSubmitting,
          onAction: () => setIsDeleteModalOpen(true),
        },
      ]}
    >
      <BlockStack gap="500">
        {actionData?.success && actionData.message && (
          <Banner tone="success" title="Success" onDismiss={() => {}}>
            <Text as="p">{actionData.message}</Text>
          </Banner>
        )}

        {actionData?.errors && actionData.errors.length > 0 && (
          <Banner tone="critical" title="There were errors updating this discount">
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
              {/* Card 1: Method & Code Info */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Discount Method & Code
                  </Text>
                  <InlineStack gap="300" align="start">
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      Method:
                    </Text>
                    {loaderData.method === "code" ? (
                      <Badge tone="info">Code Discount</Badge>
                    ) : (
                      <Badge tone="magic">Automatic Discount</Badge>
                    )}
                  </InlineStack>

                  {loaderData.method === "code" && (
                    <TextField
                      label="Discount Code"
                      value={loaderData.code}
                      disabled
                      autoComplete="off"
                      helpText="Discount codes cannot be renamed once created by Shopify Functions."
                    />
                  )}
                </BlockStack>
              </Card>

              {/* Card 2: Title */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Title & Messaging
                  </Text>
                  <TextField
                    label="Discount Title"
                    value={title}
                    onChange={setTitle}
                    autoComplete="off"
                    error={activeErrors.title}
                    helpText="Internal title displayed on reports and admin discount list."
                  />
                  <TextField
                    label="Customer-facing Message"
                    value={discountMessage}
                    onChange={setDiscountMessage}
                    autoComplete="off"
                    placeholder={`e.g. ${percentage}% off applied (max ${currencySymbol}${maxCapAmount})`}
                    helpText="Displayed on customer's checkout summary or cart."
                  />
                </BlockStack>
              </Card>

              {/* Card 3: Discount Value & Cap */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Discount Value & Cap Limits
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

              {/* Card 4: Minimum Requirements */}
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

              {/* Card 5: Active Dates */}
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

              {/* Card 6: Combinations */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Combinations
                  </Text>
                  <BlockStack gap="200">
                    <Checkbox
                      label="Combines with other order discounts"
                      checked={combinesWithOrderDiscounts}
                      onChange={(checked: boolean) => setCombinesWithOrderDiscounts(checked)}
                    />
                    <Checkbox
                      label="Combines with product discounts"
                      checked={combinesWithProductDiscounts}
                      onChange={(checked: boolean) => setCombinesWithProductDiscounts(checked)}
                    />
                    <Checkbox
                      label="Combines with shipping discounts"
                      checked={combinesWithShippingDiscounts}
                      onChange={(checked: boolean) => setCombinesWithShippingDiscounts(checked)}
                    />
                  </BlockStack>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>

          {/* Sidebar Section */}
          <Layout.Section variant="oneThird">
            <BlockStack gap="500">
              {/* Summary / Preview Card */}
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
                        Type: {loaderData.method === "code" ? `Code (${loaderData.code})` : "Automatic"}
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

              {/* Status & Danger Zone Card */}
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingSm">
                    Manage Status
                  </Text>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd">
                      Current status:
                    </Text>
                    {getStatusBadge(loaderData.status)}
                  </InlineStack>
                  <Button
                    fullWidth
                    onClick={handleToggleStatus}
                    loading={isSubmitting}
                  >
                    {isActive ? "Deactivate Discount" : "Activate Discount"}
                  </Button>
                  <Divider />
                  <Button
                    fullWidth
                    tone="critical"
                    variant="plain"
                    onClick={() => setIsDeleteModalOpen(true)}
                    loading={isSubmitting}
                  >
                    Delete this discount
                  </Button>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>

      {/* Delete Confirmation Modal */}
      <Modal
        open={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete discount?"
        primaryAction={{
          content: "Delete discount",
          destructive: true,
          loading: isSubmitting,
          onAction: handleDeleteConfirm,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setIsDeleteModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            Are you sure you want to delete{" "}
            <Text as="span" fontWeight="bold">
              {loaderData.title}
            </Text>
            ? This action cannot be undone. The discount will stop working immediately at checkout.
          </Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}

export function ErrorBoundary() {
  const error: any = useRouteError();
  const navigate = useNavigate();
  return (
    <Page
      backAction={{ content: "Discounts", onAction: () => navigate("/app") }}
      title="Discount Details"
    >
      <Banner tone="critical" title="Could not load discount">
        <p>{error?.data || error?.message || error?.statusText || "The requested discount could not be found."}</p>
        <Box paddingBlockStart="200">
          <Button onClick={() => navigate("/app")}>Return to Discounts Dashboard</Button>
        </Box>
      </Banner>
    </Page>
  );
}
