/**
 * GraphQL mutation strings for managing Capped Discount App discounts
 * using the Shopify Admin GraphQL API.
 */

/**
 * Creates a code-based discount powered by Shopify Functions.
 */
export const DISCOUNT_CODE_APP_CREATE = `#graphql
  mutation DiscountCodeAppCreate($discount: DiscountCodeAppInput!) {
    discountCodeAppCreate(codeAppDiscount: $discount) {
      codeAppDiscount {
        discountId
        title
        codes(first: 1) {
          nodes {
            code
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * Creates an automatic discount powered by Shopify Functions.
 */
export const DISCOUNT_AUTOMATIC_APP_CREATE = `#graphql
  mutation DiscountAutomaticAppCreate($automaticAppDiscount: DiscountAutomaticAppInput!) {
    discountAutomaticAppCreate(automaticAppDiscount: $automaticAppDiscount) {
      automaticAppDiscount {
        discountId
        title
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * Updates an existing code-based app discount.
 */
export const DISCOUNT_CODE_APP_UPDATE = `#graphql
  mutation DiscountCodeAppUpdate($id: ID!, $codeAppDiscount: DiscountCodeAppInput!) {
    discountCodeAppUpdate(id: $id, codeAppDiscount: $codeAppDiscount) {
      codeAppDiscount {
        discountId
        title
        codes(first: 1) {
          nodes {
            code
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * Updates an existing automatic app discount.
 */
export const DISCOUNT_AUTOMATIC_APP_UPDATE = `#graphql
  mutation DiscountAutomaticAppUpdate($id: ID!, $automaticAppDiscount: DiscountAutomaticAppInput!) {
    discountAutomaticAppUpdate(id: $id, automaticAppDiscount: $automaticAppDiscount) {
      automaticAppDiscount {
        discountId
        title
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * Deletes a code discount by ID.
 */
export const DISCOUNT_CODE_DELETE = `#graphql
  mutation DiscountCodeDelete($id: ID!) {
    discountCodeDelete(id: $id) {
      deletedCodeDiscountId
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * Deletes an automatic discount by ID.
 */
export const DISCOUNT_AUTOMATIC_DELETE = `#graphql
  mutation DiscountAutomaticDelete($id: ID!) {
    discountAutomaticDelete(id: $id) {
      deletedAutomaticDiscountId
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * Activates an existing code discount.
 */
export const DISCOUNT_CODE_ACTIVATE = `#graphql
  mutation DiscountCodeActivate($id: ID!) {
    discountCodeActivate(id: $id) {
      codeDiscountNode {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * Deactivates an active code discount.
 */
export const DISCOUNT_CODE_DEACTIVATE = `#graphql
  mutation DiscountCodeDeactivate($id: ID!) {
    discountCodeDeactivate(id: $id) {
      codeDiscountNode {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * Activates an existing automatic discount.
 */
export const DISCOUNT_AUTOMATIC_ACTIVATE = `#graphql
  mutation DiscountAutomaticActivate($id: ID!) {
    discountAutomaticActivate(id: $id) {
      automaticDiscountNode {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * Deactivates an active automatic discount.
 */
export const DISCOUNT_AUTOMATIC_DEACTIVATE = `#graphql
  mutation DiscountAutomaticDeactivate($id: ID!) {
    discountAutomaticDeactivate(id: $id) {
      automaticDiscountNode {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;
