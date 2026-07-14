type ResourceConfig = {
  query: (args?: any) => string;
  getConnection: (data: any) => any;
  baseHeaders: string[];
  buildBaseRow: (record: any) => string[];
};

const excelSafe = (value: unknown) => {
  if (value === null || value === undefined) return "";

  const str = String(value);

  // Excel formula injection protection
  if (/^[=+\-@]/.test(str)) {
    return `="${str}"`;
  }

  return str;
};

export const EXPORT_RESOURCES: Record<string, ResourceConfig> = {
  /* ---------------- PRODUCTS ---------------- */
  product: {
    query: () => `
      query ($cursor: String) {
        products(first: 200, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              id
              title
              handle
              tags
              metafields(first: 200) {
                edges { node { namespace key value } }
              }
            }
          }
        }
      }
    `,
    getConnection: (d) => d?.data?.products,
    baseHeaders: ["resource_id", "title", "handle"],
    buildBaseRow: (r) => [
      excelSafe(r.id),
      excelSafe(r.title),
      excelSafe(r.handle),
    ],

  },

  /* ---------------- PRODUCT VARIANTS ---------------- */
  product_variant: {
    query: () => `
      query ($cursor: String) {
        productVariants(first: 200, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              id
              sku
              title
              metafields(first: 200) {
                edges { node { namespace key value } }
              }
            }
          }
        }
      }
    `,
    getConnection: (d) => d?.data?.productVariants,
    baseHeaders: ["resource_id", "sku", "title"],
    buildBaseRow: (r) => [
      excelSafe(r.id),
      excelSafe(r.sku),
      excelSafe(r.title),
    ],

  },

  /* ---------------- COLLECTIONS ---------------- */
  collection: {
    query: () => `
      query ($cursor: String) {
        collections(first: 200, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              id
              title
              handle
              metafields(first: 200) {
                edges { node { namespace key value } }
              }
            }
          }
        }
      }
    `,
    getConnection: (d) => d?.data?.collections,
    baseHeaders: ["resource_id", "title", "handle"],
    buildBaseRow: (r) => [
      excelSafe(r.id),
      excelSafe(r.title),
      excelSafe(r.handle),
    ],

  },

  /* ---------------- CUSTOMERS ---------------- */
  customer: {
    query: () => `
      query ($cursor: String) {
        customers(first: 200, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              id
              firstName
              lastName
              email
              tags
              metafields(first: 200) {
                edges { node { namespace key value } }
              }
            }
          }
        }
      }
    `,
    getConnection: (d) => d?.data?.customers,
    baseHeaders: ["resource_id", "first_name", "last_name", "email"],
    buildBaseRow: (r) => [
      excelSafe(r.id),
      excelSafe(r.firstName),
      excelSafe(r.lastName),
      excelSafe(r.email),
    ],

  },

  /* ---------------- ORDERS ---------------- */
  order: {
    query: () => `
      query ($cursor: String) {
        orders(first: 200, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              id
              name
              tags
              metafields(first: 200) {
                edges { node { namespace key value } }
              }
            }
          }
        }
      }
    `,
    getConnection: (d) => d?.data?.orders,
    baseHeaders: ["resource_id", "order_name"],
    buildBaseRow: (r) => [
      excelSafe(r.id),
      excelSafe(r.name),
    ],

  },

  /* ---------------- COMPANIES (B2B) ---------------- */
  company: {
    query: () => `
      query ($cursor: String) {
        companies(first: 200, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              id
              name
              externalId
              metafields(first: 200) {
                edges { node { namespace key value } }
              }
            }
          }
        }
      }
    `,
    getConnection: (d) => d?.data?.companies,
    baseHeaders: ["resource_id", "name", "external_id"],
    buildBaseRow: (r) => [
      excelSafe(r.id),
      excelSafe(r.name),
      excelSafe(r.externalId),
    ],

  },

  /* ---------------- COMPANY LOCATIONS ---------------- */
  company_location: {
    query: () => `
      query ($cursor: String) {
        companyLocations(first: 200, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              id
              name
              externalId
              metafields(first: 200) {
                edges { node { namespace key value } }
              }
            }
          }
        }
      }
    `,
    getConnection: (d) => d?.data?.companyLocations,
    baseHeaders: ["resource_id", "name", "external_id"],
    buildBaseRow: (r) => [
      excelSafe(r.id),
      excelSafe(r.name),
      excelSafe(r.externalId),
    ],

  },

  /* ---------------- STORE LOCATIONS ---------------- */
  location: {
    query: () => `
      query ($cursor: String) {
        locations(first: 200, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              id
              name
              metafields(first: 200) {
                edges { node { namespace key value } }
              }
            }
          }
        }
      }
    `,
    getConnection: (d) => d?.data?.locations,
    baseHeaders: ["resource_id", "name"],
    buildBaseRow: (r) => [
      excelSafe(r.id),
      excelSafe(r.name),
    ],

  },

  /* ---------------- PAGES ---------------- */
  page: {
    query: () => `
      query ($cursor: String) {
        pages(first: 200, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              id
              title
              handle
              metafields(first: 200) {
                edges { node { namespace key value } }
              }
            }
          }
        }
      }
    `,
    getConnection: (d) => d?.data?.pages,
    baseHeaders: ["resource_id", "title", "handle"],
    buildBaseRow: (r) => [
      excelSafe(r.id),
      excelSafe(r.title),
      excelSafe(r.handle),
    ],

  },

  /* ---------------- BLOGS ---------------- */
  blog: {
    query: () => `
      query ($cursor: String) {
        blogs(first: 200, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              id
              title
              handle
              metafields(first: 200) {
                edges { node { namespace key value } }
              }
            }
          }
        }
      }
    `,
    getConnection: (d) => d?.data?.blogs,
    baseHeaders: ["resource_id", "title", "handle"],
    buildBaseRow: (r) => [
      excelSafe(r.id),
      excelSafe(r.title),
      excelSafe(r.handle),
    ],
  },

  /* ---------------- BLOG POSTS ---------------- */
  blog_post: {
    query: () => `
      query ($cursor: String) {
        articles(first: 200, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              id
              title
              handle
              tags
              metafields(first: 200) {
                edges { node { namespace key value } }
              }
            }
          }
        }
      }
    `,
    getConnection: (d) => d?.data?.articles,
    baseHeaders: ["resource_id", "title", "handle"],
    buildBaseRow: (r) => [
      excelSafe(r.id),
      excelSafe(r.title),
      excelSafe(r.handle),
    ],

  },

  /* ---------------- MARKETS ---------------- */
  market: {
    query: () => `
      query ($cursor: String) {
        markets(first: 200, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              id
              name
              metafields(first: 200) {
                edges { node { namespace key value } }
              }
            }
          }
        }
      }
    `,
    getConnection: (d) => d?.data?.markets,
    baseHeaders: ["resource_id", "name"],
    buildBaseRow: (r) => [
      excelSafe(r.id),
      excelSafe(r.name),
    ],

  },

  /* ---------------- METAOBJECTS ---------------- */
  metaobject: {
    query: ({ type }: { type: string }) => `
    query ($cursor: String) {
      metaobjects(type: "${type}", first: 200, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        edges {
          node {
            id
            type
            handle
            displayName
            fields {
              key
              value
            }
          }
        }
      }
    }
  `,
    getConnection: (d) => d?.data?.metaobjects,
    baseHeaders: ["resource_id", "type", "handle", "display_name"],
    buildBaseRow: (r) => [
      excelSafe(r.id),
      excelSafe(r.type),
      excelSafe(r.handle),
      excelSafe(r.displayName ?? ""),
    ],
  },
};
