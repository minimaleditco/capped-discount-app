import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigation, useNavigate, Link } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  IndexTable,
  Badge,
  EmptyState,
  Button,
  Text,
  Spinner,
  BlockStack,
  InlineStack,
  Box,
  Banner,
} from "@shopify/polaris";
import type { CappedDiscountConfig, DiscountMethod } from "~/types/discount";
import { GET_APP_DISCOUNTS } from "~/graphql/queries";
import { authenticate } from "../shopify.server";

export interface SerializedDiscountItem {
  id: string;
  numericId: string;
  title: string;
  method: DiscountMethod;
  status: string;
  startsAt: string;
  endsAt: string | null;
  ruleSummary: string;
  percentage: number;
  maxCapAmount: number;
  currencyCode: string;
  formattedStartsAt: string;
}

export interface LoaderData {
  discounts: SerializedDiscountItem[];
  error?: string | null;
  shop?: string;
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

function formatCurrency(amount: number, currencyCode: string = "INR"): string {
  const symbol = CURRENCY_SYMBOLS[currencyCode.toUpperCase()] || `${currencyCode} `;
  return `${symbol}${amount.toLocaleString()}`;
}

function formatDate(isoString: string): string {
  if (!isoString) return "N/A";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "N/A";
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return isoString;
  }
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session?.shop || "";
  const token = session?.accessToken || "";

  try {
    const response = await admin.graphql(GET_APP_DISCOUNTS, {
      variables: { first: 50 },
    });

    const result: any = await response.json();

    if (result.errors && result.errors.length > 0) {
      console.error("GraphQL errors fetching app discounts:", result.errors);
      return json<LoaderData>({
        discounts: [],
        error: result.errors.map((e: { message: string }) => e.message).join(", "),
        shop,
      });
    }

    const rawNodes = result.data?.discountNodes?.nodes || [];

    const discounts: SerializedDiscountItem[] = rawNodes.map((node: any) => {
      const discount = node.discount || {};
      const isCode = discount.__typename === "DiscountCodeApp";
      const method: DiscountMethod = isCode ? "code" : "automatic";
      const rawId: string = node.id || "";
      const numericId = rawId.split("/").pop() || rawId;

      let config: CappedDiscountConfig = {
        percentage: 0,
        maxCapAmount: 0,
        currencyCode: "INR",
        minSubtotal: 0,
      };

      if (node.metafield?.value) {
        try {
          config = JSON.parse(node.metafield.value);
        } catch (e) {
          console.error(`Failed to parse configuration for discount ${rawId}:`, e);
        }
      }

      const currency = config.currencyCode || "INR";
      const percentage = config.percentage || 0;
      const maxCapAmount = config.maxCapAmount || 0;
      const formattedMaxCap = formatCurrency(maxCapAmount, currency);

      let ruleSummary = `${percentage}% off, max ${formattedMaxCap}`;
      if (config.minSubtotal && config.minSubtotal > 0) {
        ruleSummary += ` (min ${formatCurrency(config.minSubtotal, currency)})`;
      }

      return {
        id: rawId,
        numericId,
        title: discount.title || "Untitled Discount",
        method,
        status: discount.status || "ACTIVE",
        startsAt: discount.startsAt || "",
        endsAt: discount.endsAt || null,
        ruleSummary,
        percentage,
        maxCapAmount,
        currencyCode: currency,
        formattedStartsAt: formatDate(discount.startsAt),
      };
    });

    return json<LoaderData>({ discounts, error: null, shop });
  } catch (error: any) {
    if (error instanceof Response && error.status >= 300 && error.status < 400) {
      throw error;
    }
    console.error("Unexpected error in app._index loader:", error);

    let errorMsg = error?.message || String(error);
    if (error?.response?.body) {
      try {
        errorMsg = typeof error.response.body === "string" ? error.response.body : JSON.stringify(error.response.body);
      } catch {}
    }

    const debugInfo = `[Shop: ${shop || "unknown"} | Scopes: ${session?.scope || "none"} | Token: ${token ? token.substring(0, 10) + "..." : "missing"}]`;

    return json<LoaderData>({
      discounts: [],
      error: `${errorMsg} ${debugInfo}`,
      shop,
    });
  }
};

export default function DiscountsDashboard() {
  const data = useLoaderData<typeof loader>();
  const discounts = data?.discounts || [];
  const error = data?.error;
  const shop = data?.shop;
  const navigation = useNavigation();
  const navigate = useNavigate();

  const isLoading = navigation.state === "loading";

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

  const getMethodBadge = (method: DiscountMethod) => {
    return method === "code" ? (
      <Badge tone="info">Code</Badge>
    ) : (
      <Badge tone="magic">Automatic</Badge>
    );
  };

  const headings: any = [
    { title: "Title" },
    { title: "Type" },
    { title: "Discount Rule" },
    { title: "Status" },
    { title: "Start Date" },
  ];

  const rowMarkup = discounts.map((discount: SerializedDiscountItem, index: number) => (
    <IndexTable.Row
      id={discount.id}
      key={discount.id}
      position={index}
      onClick={() => navigate(`/app/discounts/${discount.numericId}`)}
    >
      <IndexTable.Cell>
        <Link
          to={`/app/discounts/${discount.numericId}`}
          style={{ textDecoration: "none", color: "inherit", fontWeight: 600 }}
        >
          <Text variant="bodyMd" fontWeight="semibold" as="span">
            {discount.title}
          </Text>
        </Link>
      </IndexTable.Cell>
      <IndexTable.Cell>{getMethodBadge(discount.method)}</IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyMd" as="span">
          {discount.ruleSummary}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{getStatusBadge(discount.status)}</IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyMd" as="span" tone="subdued">
          {discount.formattedStartsAt}
        </Text>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Capped Discounts"
      subtitle="Percentage discounts protected with a maximum cap limit"
      primaryAction={{
        content: "Create discount",
        url: "/app/discounts/new",
      }}
      secondaryActions={[
        {
          content: "🌟 Feature Overview",
          url: "/app/home",
        },
      ]}
    >
      <BlockStack gap="500">
        {error && (
          <Banner
            tone="critical"
            title="Error loading discounts"
            action={
              shop
                ? {
                    content: "Re-authenticate Store",
                    url: `/auth/reset?shop=${shop}`,
                    target: "_top",
                  }
                : undefined
            }
          >
            <BlockStack gap="200">
              <Text as="p">{error}</Text>
              {shop && (
                <Text as="p" variant="bodySm" tone="subdued">
                  If the app scopes or configuration were updated, click Re-authenticate to refresh your store session token.
                </Text>
              )}
            </BlockStack>
          </Banner>
        )}

        {isLoading && (
          <Card>
            <Box padding="600">
              <InlineStack align="center" gap="300">
                <Spinner size="small" />
                <Text as="span" variant="bodyMd">
                  Updating discounts...
                </Text>
              </InlineStack>
            </Box>
          </Card>
        )}

        {discounts.length === 0 && !isLoading ? (
          <Card>
            <EmptyState
              heading="Create your first capped discount"
              action={{
                content: "Create discount",
                url: "/app/discounts/new",
              }}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2766/files/emptystate-files.png"
            >
              <Text as="p" tone="subdued">
                Offer attractive percentage-based discounts (e.g., 80% off) while safeguarding
                your profit margins by applying a hard currency cap (e.g., max ₹200).
              </Text>
            </EmptyState>
          </Card>
        ) : (
          <Layout>
            <Layout.Section>
              <Card padding="0">
                <IndexTable
                  resourceName={{ singular: "discount", plural: "discounts" }}
                  itemCount={discounts.length}
                  headings={headings}
                  selectable={false}
                >
                  {rowMarkup}
                </IndexTable>
              </Card>
            </Layout.Section>

            <Layout.Section variant="oneThird">
              <BlockStack gap="400">
                <Card>
                  <BlockStack gap="200">
                    <Text as="h2" variant="headingSm">
                      Summary
                    </Text>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd" tone="subdued">
                        Total Discounts:
                      </Text>
                      <Text as="span" variant="bodyMd" fontWeight="semibold">
                        {discounts.length}
                      </Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd" tone="subdued">
                        Active Discounts:
                      </Text>
                      <Badge tone="success">
                        {String(
                          discounts.filter(
                            (d: SerializedDiscountItem) => d.status.toUpperCase() === "ACTIVE"
                          ).length
                        )}
                      </Badge>
                    </InlineStack>
                  </BlockStack>
                </Card>

                <Card>
                  <BlockStack gap="200">
                    <Text as="h2" variant="headingSm">
                      How It Works
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      A capped discount evaluates cart items and applies the percentage off,
                      stopping strictly at the cap amount you configure.
                    </Text>
                  </BlockStack>
                </Card>
              </BlockStack>
            </Layout.Section>
          </Layout>
        )}
      </BlockStack>
    </Page>
  );
}
