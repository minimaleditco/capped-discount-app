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
  Button,
  Banner,
  Text,
  BlockStack,
  InlineStack,
  Box,
  Badge,
  IndexTable,
  EmptyState,
  Modal,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import {
  getDepositRules,
  createDepositRule,
  updateDepositRule,
  deleteDepositRule,
  getPartialCodSettings,
  type DepositRuleRecord,
  type PartialCodSettings,
} from "../db.server";
import { normalizePincodeList, parsePincodeList } from "../services/pincode";

function formatPincodeTargets(value: string): string {
  const codes = parsePincodeList(value);
  if (codes.length === 0) return "—";
  if (codes.length <= 3) return codes.join(", ");
  return `${codes.slice(0, 3).join(", ")} +${codes.length - 3} more`;
}

interface LoaderData {
  rules: DepositRuleRecord[];
  settings: PartialCodSettings;
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

  const [rules, settings] = await Promise.all([
    getDepositRules(shop),
    getPartialCodSettings(shop),
  ]);

  return json<LoaderData>({
    rules,
    settings,
    shop,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session?.shop || "unknown";

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  try {
    if (intent === "create" || intent === "update") {
      const conditionType = (formData.get("conditionType") as string) || "Cart Value";
      const rawConditionValue = (formData.get("conditionValue") as string) || "";
      const conditionValue =
        conditionType === "Pincode"
          ? normalizePincodeList(rawConditionValue)
          : rawConditionValue.trim();
      const depositType = (formData.get("depositType") as string) || "Flat";
      const depositValue = parseFloat((formData.get("depositValue") as string) || "0");
      const priority = parseInt((formData.get("priority") as string) || "0", 10);

      const errors: string[] = [];
      if (!conditionValue) {
        errors.push(
          conditionType === "Pincode"
            ? "Enter at least one pincode (separate multiple codes with commas)."
            : "Condition criteria value is required."
        );
      }
      if (isNaN(depositValue) || depositValue <= 0) {
        errors.push("Deposit value must be a positive number.");
      }
      if (depositType === "Percentage" && depositValue > 100) {
        errors.push("Percentage deposit cannot exceed 100%.");
      }

      if (errors.length > 0) {
        return json<ActionData>({ success: false, errors }, { status: 400 });
      }

      if (intent === "create") {
        await createDepositRule(shop, {
          conditionType: conditionType as any,
          conditionValue,
          depositType: depositType as any,
          depositValue,
          priority: isNaN(priority) ? 0 : priority,
        });
        return json<ActionData>({
          success: true,
          message: "New deposit rule created successfully!",
        });
      } else {
        const id = formData.get("id") as string;
        if (!id) {
          return json<ActionData>({ success: false, errors: ["Missing rule ID for update."] }, { status: 400 });
        }
        await updateDepositRule(shop, id, {
          conditionType: conditionType as any,
          conditionValue,
          depositType: depositType as any,
          depositValue,
          priority: isNaN(priority) ? 0 : priority,
        });
        return json<ActionData>({
          success: true,
          message: "Deposit rule updated successfully!",
        });
      }
    } else if (intent === "delete") {
      const id = formData.get("id") as string;
      if (!id) {
        return json<ActionData>({ success: false, errors: ["Missing rule ID for deletion."] }, { status: 400 });
      }
      await deleteDepositRule(shop, id);
      return json<ActionData>({
        success: true,
        message: "Deposit rule deleted successfully.",
      });
    }

    return json<ActionData>({ success: false, errors: ["Unknown action intent."] }, { status: 400 });
  } catch (err) {
    console.error("[DepositRules Action Error]:", err);
    return json<ActionData>(
      { success: false, errors: [err instanceof Error ? err.message : "Failed to process rule action."] },
      { status: 500 }
    );
  }
};

export default function DepositRulesPage() {
  const { rules, settings } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const submit = useSubmit();

  const isSubmitting = navigation.state === "submitting";

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<DepositRuleRecord | null>(null);

  // Form Fields
  const [conditionType, setConditionType] = useState<"Cart Value" | "SKU" | "Pincode">("Cart Value");
  const [conditionValue, setConditionValue] = useState("");
  const [depositType, setDepositType] = useState<"Flat" | "Percentage">("Flat");
  const [depositValue, setDepositValue] = useState("200");
  const [priority, setPriority] = useState("0");

  const openCreateModal = useCallback(() => {
    setEditingRule(null);
    setConditionType("Cart Value");
    setConditionValue("");
    setDepositType("Flat");
    setDepositValue("200");
    setPriority("0");
    setModalOpen(true);
  }, []);

  const openEditModal = useCallback((rule: DepositRuleRecord) => {
    setEditingRule(rule);
    setConditionType(rule.conditionType);
    setConditionValue(rule.conditionValue);
    setDepositType(rule.depositType);
    setDepositValue(String(rule.depositValue));
    setPriority(String(rule.priority));
    setModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setEditingRule(null);
  }, []);

  const handleSave = useCallback(() => {
    const formData = new FormData();
    formData.append("intent", editingRule ? "update" : "create");
    if (editingRule) {
      formData.append("id", editingRule.id);
    }
    formData.append("conditionType", conditionType);
    formData.append("conditionValue", conditionValue);
    formData.append("depositType", depositType);
    formData.append("depositValue", depositValue);
    formData.append("priority", priority);

    submit(formData, { method: "post" });
    setModalOpen(false);
  }, [editingRule, conditionType, conditionValue, depositType, depositValue, priority, submit]);

  const handleDelete = useCallback(
    (id: string) => {
      if (confirm("Are you sure you want to delete this deposit rule?")) {
        const formData = new FormData();
        formData.append("intent", "delete");
        formData.append("id", id);
        submit(formData, { method: "post" });
      }
    },
    [submit]
  );

  const conditionHelpText = useMemo(() => {
    switch (conditionType) {
      case "Cart Value":
        return "Minimum subtotal threshold to trigger this deposit (e.g. 3000 will match carts ≥ ₹3,000).";
      case "SKU":
        return "Enter product SKU or Variant ID (e.g. WATCH-GOLD-01 or 45192837192).";
      case "Pincode":
        return "One or more postal codes, separated by commas (e.g. 400053, 400054). A shorter code matches the whole area (4000 matches every 4000xx pincode).";
      default:
        return "";
    }
  }, [conditionType]);

  const conditionLabel = useMemo(() => {
    switch (conditionType) {
      case "Cart Value":
        return "Minimum Cart Value (₹)";
      case "SKU":
        return "Product SKU or Variant ID";
      case "Pincode":
        return "Postal Codes / Pincodes";
      default:
        return "Condition Value";
    }
  }, [conditionType]);

  const conditionPlaceholder = useMemo(() => {
    switch (conditionType) {
      case "Cart Value":
        return "3000";
      case "SKU":
        return "WATCH-GOLD-01";
      case "Pincode":
        return "400053, 400054, 5600";
      default:
        return "";
    }
  }, [conditionType]);

  return (
    <Page
      title="Dynamic Deposit Rules"
      subtitle="Configure risk-based required advance deposits evaluated in descending priority order."
      primaryAction={{
        content: "Create Rule",
        onAction: openCreateModal,
      }}
    >
      <BlockStack gap="400">
        {actionData?.success && (
          <Banner title="Success" tone="success">
            <p>{actionData.message}</p>
          </Banner>
        )}

        {actionData?.errors && actionData.errors.length > 0 && (
          <Banner title="Please correct the following errors" tone="critical">
            <ul>
              {actionData.errors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </Banner>
        )}

        <Banner title="How Rule Evaluation Works" tone="info">
          <p>
            When a buyer selects <strong>Partial COD</strong> at checkout, our rules engine evaluates
            your rules starting from the <strong>highest Priority</strong>. The first matching rule
            determines the mandatory advance deposit. If no rule matches, your store's default deposit of{" "}
            <strong>
              {settings.depositType === "fixed" ? `₹${settings.depositValue}` : `${settings.depositValue}%`}
            </strong>{" "}
            is automatically applied.
          </p>
        </Banner>

        <Layout>
          <Layout.Section>
            <Card padding="0">
              {rules.length === 0 ? (
                <EmptyState
                  heading="No dynamic deposit rules yet"
                  action={{
                    content: "Create your first rule",
                    onAction: openCreateModal,
                  }}
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>
                    Set up higher deposits for high-value carts, fragile/custom SKUs, or high-RTO delivery
                    zones to protect your merchant margins.
                  </p>
                </EmptyState>
              ) : (
                <IndexTable
                  resourceName={{ singular: "rule", plural: "rules" }}
                  itemCount={rules.length}
                  headings={[
                    { title: "Priority" },
                    { title: "Condition Type" },
                    { title: "Target Criteria" },
                    { title: "Required Deposit" },
                    { title: "Actions" },
                  ]}
                  selectable={false}
                >
                  {rules.map((rule, index) => {
                    let badgeTone: "info" | "attention" | "warning" = "info";
                    if (rule.conditionType === "SKU") badgeTone = "attention";
                    if (rule.conditionType === "Pincode") badgeTone = "warning";

                    return (
                      <IndexTable.Row id={rule.id} key={rule.id} position={index}>
                        <IndexTable.Cell>
                          <Badge tone="new">{`Priority ${rule.priority}`}</Badge>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Badge tone={badgeTone}>{rule.conditionType}</Badge>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Text variant="bodyMd" fontWeight="semibold" as="span">
                            {rule.conditionType === "Cart Value"
                              ? `Carts ≥ ₹${Number(rule.conditionValue).toLocaleString("en-IN")}`
                              : rule.conditionType === "SKU"
                              ? `SKU: ${rule.conditionValue}`
                              : `PIN: ${formatPincodeTargets(rule.conditionValue)}`}
                          </Text>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Text variant="bodyMd" fontWeight="bold" as="span">
                            {rule.depositType === "Flat"
                              ? `₹${rule.depositValue} Flat`
                              : `${rule.depositValue}% of Cart`}
                          </Text>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <InlineStack gap="200">
                            <Button size="slim" onClick={() => openEditModal(rule)}>
                              Edit
                            </Button>
                            <Button
                              size="slim"
                              tone="critical"
                              onClick={() => handleDelete(rule.id)}
                            >
                              Delete
                            </Button>
                          </InlineStack>
                        </IndexTable.Cell>
                      </IndexTable.Row>
                    );
                  })}
                </IndexTable>
              )}
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>

      <Modal
        open={modalOpen}
        onClose={handleCloseModal}
        title={editingRule ? "Edit Deposit Rule" : "Create New Deposit Rule"}
        primaryAction={{
          content: isSubmitting ? "Saving..." : "Save Rule",
          onAction: handleSave,
          disabled: isSubmitting || !conditionValue.trim(),
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: handleCloseModal,
          },
        ]}
      >
        <Modal.Section>
          <FormLayout>
            <Select
              label="Condition Type"
              options={[
                { label: "Cart Value (Subtotal Threshold)", value: "Cart Value" },
                { label: "Product SKU / Variant", value: "SKU" },
                { label: "Delivery Pincode / Postal Area", value: "Pincode" },
              ]}
              value={conditionType}
              onChange={(val) => setConditionType(val as any)}
            />

            <TextField
              label={conditionLabel}
              value={conditionValue}
              onChange={setConditionValue}
              autoComplete="off"
              placeholder={conditionPlaceholder}
              helpText={conditionHelpText}
            />

            <InlineStack gap="400">
              <Box minWidth="200px">
                <Select
                  label="Deposit Type"
                  options={[
                    { label: "Flat Amount (₹)", value: "Flat" },
                    { label: "Percentage of Cart (%)", value: "Percentage" },
                  ]}
                  value={depositType}
                  onChange={(val) => setDepositType(val as any)}
                />
              </Box>
              <Box minWidth="200px">
                <TextField
                  label="Deposit Amount"
                  type="number"
                  value={depositValue}
                  onChange={setDepositValue}
                  prefix={depositType === "Flat" ? "₹" : undefined}
                  suffix={depositType === "Percentage" ? "%" : undefined}
                  autoComplete="off"
                />
              </Box>
            </InlineStack>

            <TextField
              label="Evaluation Priority"
              type="number"
              value={priority}
              onChange={setPriority}
              autoComplete="off"
              helpText="Higher priority numbers are checked first (e.g. Priority 10 takes precedence over Priority 1)."
            />
          </FormLayout>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
