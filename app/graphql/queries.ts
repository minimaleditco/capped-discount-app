/**
 * GraphQL query strings for querying discount nodes, metafields,
 * and Shopify Functions from the Shopify Admin GraphQL API.
 */

/**
 * Fetches a single discount node by its Global ID (gid://shopify/DiscountNode/...),
 * including app discount configurations stored in metafields.
 */
export const GET_DISCOUNT_NODE = `#graphql
  query GetDiscountNode($id: ID!) {
    discountNode(id: $id) {
      id
      discount {
        __typename
        ... on DiscountCodeApp {
          title
          status
          startsAt
          endsAt
          codes(first: 1) {
            nodes {
              code
            }
          }
          combinesWith {
            orderDiscounts
            productDiscounts
            shippingDiscounts
          }
        }
        ... on DiscountAutomaticApp {
          title
          status
          startsAt
          endsAt
          combinesWith {
            orderDiscounts
            productDiscounts
            shippingDiscounts
          }
        }
      }
      metafield(namespace: "capped_discount", key: "configuration") {
        id
        value
      }
    }
  }
`;

/**
 * Lists all discounts created by this app along with their capped discount configuration metafields.
 */
export const GET_APP_DISCOUNTS = `#graphql
  query GetAppDiscounts($first: Int!) {
    discountNodes(first: $first, query: "type:app") {
      nodes {
        id
        discount {
          __typename
          ... on DiscountCodeApp {
            title
            status
            startsAt
            endsAt
          }
          ... on DiscountAutomaticApp {
            title
            status
            startsAt
            endsAt
          }
        }
        metafield(namespace: "capped_discount", key: "configuration") {
          value
        }
      }
    }
  }
`;

/**
 * Fetches registered Shopify Functions for the app to obtain the functionId
 * needed when creating or updating app discounts.
 */
export const GET_FUNCTION_ID = `#graphql
  query GetFunctionId {
    shopifyFunctions(first: 25) {
      nodes {
        apiType
        title
        id
      }
    }
  }
`;
