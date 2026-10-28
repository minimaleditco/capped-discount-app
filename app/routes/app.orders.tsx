import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData, useNavigation, useSubmit } from "@remix-run/react";
import { useState, useCallback, useMemo } from "react";
import {
  Page,
  Layout,
  Card,
  IndexTable,
  Badge,
  Button,
  Banner,
  Text,
  BlockStack,
  InlineStack,
  Box,
  Modal,
  Select,
  TextField,
  EmptyState,
  Divider,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import {
  getPartialCodOrders,
  cancelAndRefundDeposit,
  type FormattedPartialCodOrder,
  type RefundResult,
} from "../services/refunds.server";

interface LoaderData {
  orders: FormattedPartialCodOrder[];
  shop: string;
}

interface ActionData {
  result?: RefundResult;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session?.shop || "unknown";

  const orders = await getPartialCodOrders(admin);

  return json<LoaderData>({
    orders,
    shop,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session?.shop || "unknown";

  const formData = await request.formData();
  const orderId = String(formData.get("orderId") || "");
  const reason = (String(formData.get("reason") || "CUSTOMER") as any);
  const staffNote = String(formData.get("staffNote") || "Partial COD deposit refund from App Support Dashboard");
  const restock = formData.get("restock") !== "false";

  if (!orderId) {
    return json<ActionData>({
      result: {
        success: false,
        orderId: "",
        error: "Missing required order ID.",
      },
    });
  }

  const result = await cancelAndRefundDeposit(admin, shop, {
    orderId,
    reason,
    staffNote,
    restock,
    notifyCustomer: true,
  });

  return json<ActionData>({ result });
};

export default function PartialCodOrdersPage() {
  const { orders } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();

  const isSubmitting = navigation.state === "submitting";

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "cancelled">("all");

  // Selected Order for Refund Modal
  const [selectedOrder, setSelectedOrder] = useState<FormattedPartialCodOrder | null>(null);
  const [cancelReason, setCancelReason] = useState<string>("CUSTOMER");
  const [staffNote, setStaffNote] = useState<string>("");

  const handleOpenRefundModal = useCallback((order: FormattedPartialCodOrder) => {
    setSelectedOrder(order);
    setCancelReason("CUSTOMER");
    setStaffNote(`Customer requested cancellation of ${order.name}`);
  }, []);

  const handleCloseRefundModal = useCallback(() => {
    if (isSubmitting) return;
    setSelectedOrder(null);
  }, [isSubmitting]);

  const handleConfirmRefund = useCallback(() => {
    if (!selectedOrder) return;
    const fd = new FormData();
    fd.append("orderId", selectedOrder.id);
    fd.append("reason", cancelReason);
    fd.append("staffNote", staffNote);
    fd.append("restock", "true");
    submit(fd, { method: "post" });
    setSelectedOrder(null);
  }, [selectedOrder, cancelReason, staffNote, submit]);

  // Metrics Calculations
  const metrics = useMemo(() => {
    let totalDeposits = 0;
    let totalBalances = 0;
    let totalCancelledCount = 0;

    orders.forEach((o) => {
      totalDeposits += o.depositAmount;
      totalBalances += o.remainingBalance;
      if (o.isCancelled || o.isRefunded) {
        totalCancelledCount++;
      }
    });

    return {
      count: orders.length,
      totalDeposits,
      totalBalances,
      totalCancelledCount,
    };
  }, [orders]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter === "active" && (o.isCancelled || o.isRefunded)) {
        return false;
      }
      if (statusFilter === "cancelled" && !o.isCancelled && !o.isRefunded) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = o.name.toLowerCase().includes(q);
        const matchesCustomer = o.customerName.toLowerCase().includes(q);
        const matchesPhone = o.customerPhone.includes(q);
        return matchesName || matchesCustomer || matchesPhone;
      }
      return true;
    });
  }, [orders, statusFilter, searchQuery]);

  const rowMarkup = filteredOrders.map((order, index) => {
    const isCancelledOrRefunded = order.isCancelled || order.isRefunded;

    let statusBadgeTone: "success" | "attention" | "critical" | "info" = "attention";
    let statusText = "Pending Delivery";

    if (order.isCancelled && order.isRefunded) {
      statusBadgeTone = "critical";
      statusText = "Cancelled & Refunded";
    } else if (order.isCancelled) {
      statusBadgeTone = "critical";
      statusText = "Cancelled";
    } else if (order.isRefunded) {
      statusBadgeTone = "info";
      statusText = "Deposit Refunded";
    } else if (order.displayFulfillmentStatus === "FULFILLED") {
      statusBadgeTone = "success";
      statusText = "Delivered";
    }

    return (
      <IndexTable.Row id={order.id} key={order.id} position={index}>
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd" fontWeight="bold">
            {order.name}
          </Text>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <Text as="span" variant="bodySm" tone="subdued">
            {new Date(order.createdAt).toLocaleDateString("en-IN", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <BlockStack gap="050">
            <Text as="span" variant="bodySm" fontWeight="medium">
              {order.customerName}
            </Text>
            {order.customerPhone && (
              <Text as="span" variant="bodyXs" tone="subdued">
                📞 {order.customerPhone}
              </Text>
            )}
          </BlockStack>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <Text as="span" variant="bodyMd" fontWeight="medium">
            ₹{order.totalPrice.toFixed(2)}
          </Text>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <InlineStack gap="100" blockAlign="center">
            <Text as="span" variant="bodyMd" fontWeight="bold" tone="success">
              ₹{order.depositAmount.toFixed(2)}
            </Text>
            <Badge tone="success" size="small">
              ONLINE
            </Badge>
          </InlineStack>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <InlineStack gap="100" blockAlign="center">
            <Text as="span" variant="bodyMd" fontWeight="semibold" tone="subdued">
              ₹{order.remainingBalance.toFixed(2)}
            </Text>
            <Badge tone="attention" size="small">
              DOORSTEP
            </Badge>
          </InlineStack>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <Badge tone={statusBadgeTone}>{statusText}</Badge>
        </IndexTable.Cell>

        <IndexTable.Cell>
          {order.canRefund ? (
            <Button
              size="slim"
              tone="critical"
              onClick={() => handleOpenRefundModal(order)}
              disabled={isSubmitting}
            >
              Cancel & Refund
            </Button>
          ) : isCancelledOrRefunded ? (
            <Text as="span" variant="bodyXs" tone="subdued">
              No Action Needed
            </Text>
          ) : (
            <Text as="span" variant="bodyXs" tone="subdued">
              Ineligible
            </Text>
          )}
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page
      title="Partial COD Orders & Support"
      subtitle="Safely manage orders, restock inventory, and process one-click deposit refunds without risking accidental over-refund of the unpaid doorstep balance."
      fullWidth
    >
      <BlockStack gap="500">
        {/* Action feedback banner */}
        {actionData?.result && (
          <Banner
            tone={actionData.result.success ? "success" : "critical"}
            title={
              actionData.result.success
                ? `Deposit Successfully Refunded for ${actionData.result.orderName || "Order"}`
                : "Failed to Process Refund"
            }
          >
            {actionData.result.success ? (
              <p>
                The online advance deposit of{" "}
                <strong>
                  ₹{actionData.result.refundedAmount?.toFixed(2)}
                </strong>{" "}
                has been refunded to the customer&apos;s original payment method. The order has been marked as cancelled in Shopify, line items were restocked, and order tags were updated.
              </p>
            ) : (
              <p>{actionData.result.error || "An unexpected error occurred."}</p>
            )}
          </Banner>
        )}

        {/* Overview Metric Cards */}
        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="100">
                <Text as="h3" variant="headingSm" tone="subdued">
                  Total Partial COD Orders
                </Text>
                <Text as="p" variant="headingLg">
                  {metrics.count}
                </Text>
                <Text as="span" variant="bodyXs" tone="subdued">
                  {metrics.totalCancelledCount} cancelled / refunded
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="100">
                <Text as="h3" variant="headingSm" tone="subdued">
                  Advance Deposits Collected
                </Text>
                <Text as="p" variant="headingLg">
                  ₹{metrics.totalDeposits.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </Text>
                <Text as="span" variant="bodyXs" tone="success">
                  Protected & tracked online
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="100">
                <Text as="h3" variant="headingSm" tone="subdued">
                  Doorstep COD Balance Due
                </Text>
                <Text as="p" variant="headingLg">
                  ₹{metrics.totalBalances.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </Text>
                <Text as="span" variant="bodyXs" tone="subdued">
                  Collectable in cash at delivery
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Filters and Table */}
        <Card padding="0">
          <Box padding="400">
            <InlineStack align="space-between" blockAlign="center" gap="400">
              <InlineStack gap="300" blockAlign="center">
                <div style={{ width: "280px" }}>
                  <TextField
                    label="Search orders"
                    labelHidden
                    placeholder="Search by order #, customer, phone..."
                    value={searchQuery}
                    onChange={(val) => setSearchQuery(val)}
                    autoComplete="off"
                    clearButton
                    onClearButtonClick={() => setSearchQuery("")}
                  />
                </div>
                <Select
                  label="Filter by status"
                  labelHidden
                  options={[
                    { label: "All Orders", value: "all" },
                    { label: "Active & Pending", value: "active" },
                    { label: "Cancelled & Refunded", value: "cancelled" },
                  ]}
                  value={statusFilter}
                  onChange={(val) => setStatusFilter(val as any)}
                />
              </InlineStack>

              <Text as="span" variant="bodySm" tone="subdued">
                Showing {filteredOrders.length} of {orders.length} orders
              </Text>
            </InlineStack>
          </Box>

          <Divider />

          {filteredOrders.length === 0 ? (
            <EmptyState
              heading="No Partial COD Orders Found"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>
                {searchQuery || statusFilter !== "all"
                  ? "No orders match your search criteria. Try clearing filters."
                  : "Orders placed through the Partial COD storefront checkout will appear here automatically."}
              </p>
            </EmptyState>
          ) : (
            <IndexTable
              resourceName={{ singular: "order", plural: "orders" }}
              itemCount={filteredOrders.length}
              headings={[
                { title: "Order" },
                { title: "Date" },
                { title: "Customer" },
                { title: "Total Value" },
                { title: "Deposit (Online)" },
                { title: "Balance (Doorstep)" },
                { title: "Status" },
                { title: "Action" },
              ]}
              selectable={false}
            >
              {rowMarkup}
            </IndexTable>
          )}
        </Card>
      </BlockStack>

      {/* Confirmation Modal */}
      {selectedOrder && (
        <Modal
          open={Boolean(selectedOrder)}
          onClose={handleCloseRefundModal}
          title={`Cancel Order & Refund Deposit: ${selectedOrder.name}`}
          primaryAction={{
            content: `Confirm & Refund ₹${selectedOrder.refundableDeposit.toFixed(2)}`,
            onAction: handleConfirmRefund,
            loading: isSubmitting,
            destructive: true,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: handleCloseRefundModal,
              disabled: isSubmitting,
            },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="400">
              <Banner tone="warning">
                <p>
                  <strong>Deposit Guard:</strong> Only the{" "}
                  <strong>₹{selectedOrder.refundableDeposit.toFixed(2)}</strong> online advance deposit will be refunded. 
                  The unpaid doorstep balance of <strong>₹{selectedOrder.remainingBalance.toFixed(2)}</strong> will{" "}
                  <strong>NOT</strong> be refunded, preventing accidental financial loss.
                </p>
              </Banner>

              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">
                  Order Breakdown
                </Text>
                <InlineStack align="space-between">
                  <Text as="span" tone="subdued">Customer:</Text>
                  <Text as="span" fontWeight="medium">{selectedOrder.customerName} ({selectedOrder.customerPhone || "No Phone"})</Text>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="span" tone="subdued">Total Order Value:</Text>
                  <Text as="span" fontWeight="medium">₹{selectedOrder.totalPrice.toFixed(2)}</Text>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="span" tone="subdued">Online Deposit (To be refunded):</Text>
                  <Text as="span" fontWeight="bold" tone="success">₹{selectedOrder.refundableDeposit.toFixed(2)}</Text>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="span" tone="subdued">Doorstep Balance (Unpaid / Kept at ₹0):</Text>
                  <Text as="span" fontWeight="bold">₹{selectedOrder.remainingBalance.toFixed(2)}</Text>
                </InlineStack>
              </BlockStack>

              <Divider />

              <Select
                label="Cancellation Reason"
                options={[
                  { label: "Customer changed mind / requested cancellation", value: "CUSTOMER" },
                  { label: "Customer declined / unverified OTP", value: "DECLINED" },
                  { label: "Suspected fraudulent order", value: "FRAUD" },
                  { label: "Item out of stock / inventory unavailable", value: "INVENTORY" },
                  { label: "Other reason", value: "OTHER" },
                ]}
                value={cancelReason}
                onChange={(val) => setCancelReason(val)}
              />

              <TextField
                label="Staff Internal Note"
                value={staffNote}
                onChange={(val) => setStaffNote(val)}
                autoComplete="off"
                multiline={2}
                helpText="This note will be saved in Shopify order history and refund details."
              />
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}
