import { describe, it, expect, vi } from "vitest";

/**
 * Regression test for the scope-check block in the embedded app layout.
 *
 * It used to call deleteSessionsByShop() whenever the Admin API answered
 * 401/403, which logged merchants out on any transient error and could wipe a
 * freshly refreshed expiring token.
 */

const graphql = vi.fn();

vi.mock("../app/shopify.server", () => ({
  authenticate: {
    admin: vi.fn(async () => ({
      admin: { graphql },
      session: { shop: "example.myshopify.com" },
    })),
  },
}));

const { loader } = await import("../app/routes/app");

describe("app layout scope check", () => {
  it("renders even when the scope query is forbidden", async () => {
    graphql.mockResolvedValue(
      new Response(JSON.stringify({ errors: "Forbidden" }), { status: 403 })
    );

    const res: any = await loader({
      request: new Request("https://app.example.com/app"),
      params: {},
      context: {},
    } as any);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.apiKey).toBeTruthy();
  });

  it("renders when the scope query throws", async () => {
    graphql.mockRejectedValue(new Response(null, { status: 403 }));

    const res: any = await loader({
      request: new Request("https://app.example.com/app"),
      params: {},
      context: {},
    } as any);

    expect(res.status).toBe(200);
  });
});
