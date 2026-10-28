import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseCurrencyAmount,
  formatShopifyOrder,
  cancelAndRefundDeposit,
} from "../app/services/refunds.server";

describe("Phase 5: One-Click Deposit Refunds & Order Cancellation", () => {
  describe("Currency & Numeric Parsing", () => {
    it("should parse standard numeric amounts and string currency values", () => {
      expect(parseCurrencyAmount(108)).toBe(108);
      expect(parseCurrencyAmount("₹108.00")).toBe(108);
      expect(parseCurrencyAmount("₹1,200.50")).toBe(1200.5);
      expect(parseCurrencyAmount("Deposit Paid: ₹36.00")).toBe(36);
      expect(parseCurrencyAmount("")).toBe(0);
      expect(parseCurrencyAmount(null)).toBe(0);
      expect(parseCurrencyAmount(undefined)).toBe(0);
    });
  });

  describe("Shopify Order Normalization & Deposit Guard", () => {
    it("should extract deposit and doorstep balance from customAttributes", () => {
      const mockOrder = {
        id: "gid://shopify/Order/1001",
        name: "#1001",
        createdAt: "2026-10-28T10:00:00Z",
        totalPriceSet: { shopMoney: { amount: "108.00", currencyCode: "INR" } },
        totalRefundedSet: { shopMoney: { amount: "0.00", currencyCode: "INR" } },
        customAttributes: [
          { key: "Advance Deposit Paid", value: "₹108.00" },
          { key: "Doorstep COD Balance Due", value: "₹972.00" },
          { key: "Payment Status", value: "Partially Paid" },
          { key: "Verified Mobile", value: "9876543210" },
        ],
        tags: ["Partially Paid", "Partial COD"],
        customer: {
          displayName: "Saran Jain",
          email: "saran@example.com",
          phone: "+919876543210",
        },
        transactions: [
          {
            id: "gid://shopify/OrderTransaction/5001",
            status: "SUCCESS",
            kind: "SALE",
            gateway: "razorpay",
            amountSet: { shopMoney: { amount: "108.00", currencyCode: "INR" } },
          },
        ],
      };

      const formatted = formatShopifyOrder(mockOrder);
      expect(formatted.depositAmount).toBe(108);
      expect(formatted.remainingBalance).toBe(972);
      expect(formatted.totalPrice).toBe(108);
      expect(formatted.refundableDeposit).toBe(108);
      expect(formatted.canRefund).toBe(true);
      expect(formatted.isCancelled).toBe(false);
      expect(formatted.isRefunded).toBe(false);
      expect(formatted.parentTransactionId).toBe("gid://shopify/OrderTransaction/5001");
      expect(formatted.customerPhone).toBe("+919876543210");
    });

    it("should fallback to tags if customAttributes are missing", () => {
      const mockOrder = {
        id: "gid://shopify/Order/1002",
        name: "#1002",
        createdAt: "2026-10-28T11:00:00Z",
        totalPriceSet: { shopMoney: { amount: "150.00", currencyCode: "INR" } },
        totalRefundedSet: { shopMoney: { amount: "0.00", currencyCode: "INR" } },
        customAttributes: [],
        tags: [
          "Partial COD",
          "Deposit Paid: ₹150",
          "Doorstep Balance: ₹1350",
          "SMS Verified: +919123456789",
        ],
        transactions: [
          {
            id: "gid://shopify/OrderTransaction/5002",
            status: "SUCCESS",
            kind: "CAPTURE",
            gateway: "shopify_payments",
            amountSet: { shopMoney: { amount: "150.00", currencyCode: "INR" } },
          },
        ],
      };

      const formatted = formatShopifyOrder(mockOrder);
      expect(formatted.depositAmount).toBe(150);
      expect(formatted.remainingBalance).toBe(1350);
      expect(formatted.refundableDeposit).toBe(150);
      expect(formatted.canRefund).toBe(true);
    });

    it("should prevent over-refunding when deposit is already refunded", () => {
      const mockOrder = {
        id: "gid://shopify/Order/1003",
        name: "#1003",
        createdAt: "2026-10-28T12:00:00Z",
        cancelledAt: "2026-10-28T12:30:00Z",
        totalPriceSet: { shopMoney: { amount: "108.00", currencyCode: "INR" } },
        totalRefundedSet: { shopMoney: { amount: "108.00", currencyCode: "INR" } },
        customAttributes: [
          { key: "Advance Deposit Paid", value: "₹108.00" },
          { key: "Doorstep COD Balance Due", value: "₹972.00" },
        ],
        transactions: [
          {
            id: "gid://shopify/OrderTransaction/5003",
            status: "SUCCESS",
            kind: "SALE",
            amountSet: { shopMoney: { amount: "108.00", currencyCode: "INR" } },
          },
        ],
      };

      const formatted = formatShopifyOrder(mockOrder);
      expect(formatted.depositAmount).toBe(108);
      expect(formatted.totalRefunded).toBe(108);
      expect(formatted.refundableDeposit).toBe(0);
      expect(formatted.isCancelled).toBe(true);
      expect(formatted.isRefunded).toBe(true);
      expect(formatted.canRefund).toBe(false);
    });
  });

  describe("cancelAndRefundDeposit Atomic Mutation Flow", () => {
    let mockAdmin: any;
    let graphqlCalls: { query: string; variables: any }[] = [];

    beforeEach(() => {
      graphqlCalls = [];
      mockAdmin = {
        graphql: vi.fn().mockImplementation((query: string, options?: any) => {
          graphqlCalls.push({ query, variables: options?.variables });

          if (query.includes("GetSingleOrderForRefund")) {
            return Promise.resolve({
              json: () =>
                Promise.resolve({
                  data: {
                    order: {
                      id: "gid://shopify/Order/9999",
                      name: "#9999",
                      cancelledAt: null,
                      totalPriceSet: { shopMoney: { amount: "108.00", currencyCode: "INR" } },
                      totalRefundedSet: { shopMoney: { amount: "0.00", currencyCode: "INR" } },
                      customAttributes: [
                        { key: "Advance Deposit Paid", value: "₹108.00" },
                        { key: "Doorstep COD Balance Due", value: "₹972.00" },
                      ],
                      tags: ["Partially Paid", "Partial COD"],
                      transactions: [
                        {
                          id: "gid://shopify/OrderTransaction/8888",
                          status: "SUCCESS",
                          kind: "SALE",
                          gateway: "razorpay",
                          amountSet: { shopMoney: { amount: "108.00", currencyCode: "INR" } },
                        },
                      ],
                    },
                  },
                }),
            });
          }

          if (query.includes("CancelOrder")) {
            return Promise.resolve({
              json: () =>
                Promise.resolve({
                  data: {
                    orderCancel: {
                      job: { id: "job_1", done: true },
                      orderCancelUserErrors: [],
                    },
                  },
                }),
            });
          }

          if (query.includes("CreateDepositRefund")) {
            return Promise.resolve({
              json: () =>
                Promise.resolve({
                  data: {
                    refundCreate: {
                      refund: { id: "gid://shopify/Refund/7777", createdAt: "2026-10-28T12:00:00Z" },
                      userErrors: [],
                    },
                  },
                }),
            });
          }

          if (query.includes("UpdateOrderTags")) {
            return Promise.resolve({
              json: () =>
                Promise.resolve({
                  data: {
                    tagsAdd: { userErrors: [] },
                    tagsRemove: { userErrors: [] },
                  },
                }),
            });
          }

          return Promise.resolve({ json: () => Promise.resolve({ data: {} }) });
        }),
      };
    });

    it("should cancel order with restock and refund exact deposit amount", async () => {
      const result = await cancelAndRefundDeposit(mockAdmin, "test-shop.myshopify.com", {
        orderId: "gid://shopify/Order/9999",
        reason: "CUSTOMER",
        staffNote: "Customer requested cancellation via WhatsApp",
        restock: true,
      });

      expect(result.success).toBe(true);
      expect(result.refundedAmount).toBe(108);
      expect(result.cancelled).toBe(true);
      expect(result.restocked).toBe(true);

      // Verify GraphQL mutation sequence
      const cancelCall = graphqlCalls.find((c) => c.query.includes("CancelOrder"));
      expect(cancelCall).toBeDefined();
      expect(cancelCall?.variables.orderId).toBe("gid://shopify/Order/9999");
      expect(cancelCall?.variables.reason).toBe("CUSTOMER");
      expect(cancelCall?.variables.restock).toBe(true);

      const refundCall = graphqlCalls.find((c) => c.query.includes("CreateDepositRefund"));
      expect(refundCall).toBeDefined();
      expect(refundCall?.variables.input.orderId).toBe("gid://shopify/Order/9999");
      expect(refundCall?.variables.input.transactions[0].amount).toBe("108.00");
      expect(refundCall?.variables.input.transactions[0].parentId).toBe("gid://shopify/OrderTransaction/8888");
      expect(refundCall?.variables.input.transactions[0].gateway).toBe("razorpay");

      const tagsCall = graphqlCalls.find((c) => c.query.includes("UpdateOrderTags"));
      expect(tagsCall).toBeDefined();
      expect(tagsCall?.variables.tagsToAdd).toContain("Partial COD Cancelled");
      expect(tagsCall?.variables.tagsToAdd).toContain("Deposit Refunded: ₹108.00");
      expect(tagsCall?.variables.tagsToRemove).toContain("Partially Paid");
      expect(tagsCall?.variables.tagsToRemove).toContain("Partial COD");
    });

    it("should gracefully handle orders that are already cancelled", async () => {
      // Modify mock to return an order that was already cancelled
      mockAdmin.graphql = vi.fn().mockImplementation((query: string, options?: any) => {
        graphqlCalls.push({ query, variables: options?.variables });

        if (query.includes("GetSingleOrderForRefund")) {
          return Promise.resolve({
            json: () =>
              Promise.resolve({
                data: {
                  order: {
                    id: "gid://shopify/Order/9999",
                    name: "#9999",
                    cancelledAt: "2026-10-28T09:00:00Z", // Already cancelled
                    totalPriceSet: { shopMoney: { amount: "108.00", currencyCode: "INR" } },
                    totalRefundedSet: { shopMoney: { amount: "0.00", currencyCode: "INR" } },
                    customAttributes: [
                      { key: "Advance Deposit Paid", value: "₹108.00" },
                      { key: "Doorstep COD Balance Due", value: "₹972.00" },
                    ],
                    tags: ["Partially Paid"],
                    transactions: [
                      {
                        id: "gid://shopify/OrderTransaction/8888",
                        status: "SUCCESS",
                        kind: "SALE",
                        gateway: "razorpay",
                        amountSet: { shopMoney: { amount: "108.00", currencyCode: "INR" } },
                      },
                    ],
                  },
                },
              }),
          });
        }

        if (query.includes("CreateDepositRefund")) {
          return Promise.resolve({
            json: () =>
              Promise.resolve({
                data: {
                  refundCreate: {
                    refund: { id: "gid://shopify/Refund/7777", createdAt: "2026-10-28T12:00:00Z" },
                    userErrors: [],
                  },
                },
              }),
          });
        }

        if (query.includes("UpdateOrderTags")) {
          return Promise.resolve({
            json: () =>
              Promise.resolve({
                data: { tagsAdd: { userErrors: [] }, tagsRemove: { userErrors: [] } },
              }),
          });
        }

        return Promise.resolve({ json: () => Promise.resolve({ data: {} }) });
      });

      const result = await cancelAndRefundDeposit(mockAdmin, "test-shop.myshopify.com", {
        orderId: "gid://shopify/Order/9999",
      });

      expect(result.success).toBe(true);
      expect(result.refundedAmount).toBe(108);

      // Verify CancelOrder mutation was SKIPPED because it was already cancelled
      const cancelCall = graphqlCalls.find((c) => c.query.includes("CancelOrder"));
      expect(cancelCall).toBeUndefined();

      // But refund was still issued
      const refundCall = graphqlCalls.find((c) => c.query.includes("CreateDepositRefund"));
      expect(refundCall).toBeDefined();
    });
  });
});
