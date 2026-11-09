/**
 * Reads the store's base currency. Admin screens use it for every label and
 * prefix so a USD store never shows rupee symbols.
 */
export async function getShopCurrency(admin: any, fallback = "INR"): Promise<string> {
  try {
    const response = await admin.graphql(`#graphql
      query GetShopCurrency {
        shop {
          currencyCode
        }
      }
    `);
    const json: any = await response.json();
    return json?.data?.shop?.currencyCode || fallback;
  } catch {
    return fallback;
  }
}
