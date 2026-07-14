import { validateShopifyId } from "../utils/shopifyIdValidator";

export const queryMap = {
  product: "products",
  productVariant: "productVariants",
  collection: "collections",
  customer: "customers",
  order: "orders",
  company: "companies",
  companyLocation: "companyLocations",
  location: "locations",
  page: "pages",
  blog: "blog",
  blogPost: "articles",
  market: "markets",
};

export function fail(message: string, error: any = null) {
  return { ok: false, message, error };
}

export function success(data: any) {
  return { ok: true, ...data };
}

const countQueryMap = {
  products: "productsCount",
  productVariants: "productVariantsCount",
  collections: "collectionsCount",
  customers: "customersCount",
  orders: "ordersCount",
  draftOrder: "draftOrdersCount",
  companies: "companiesCount",
  companyLocations: "companyLocationsCount",
  locations: "locationsCount",
  pages: "pagesCount",
  blog: "blogsCount",
  articles: "articlesCount",
  markets: "marketsCount",
  shop: null, // shop has no count
};

export async function fetchResourceCount(admin: any, resource: keyof typeof countQueryMap) {

  const countField = countQueryMap[resource as keyof typeof countQueryMap];

  if (!countField) {
    return { count: 0 };
  }

  const query = `
    query {
      ${countField} {
        count
      }
    }
  `;

  try {
    const res = await admin.graphql(query);
    if (!res) {
      return { count: 0 };
    }
    const json = await res.json();
    const count = json?.data?.[countField]?.count ?? 0;
    return { count };
  } catch (error) {
    return { count: 0 };
  }
}

/* ------------------ FETCH ONE PAGE OF RESOURCE ITEMS ------------------ */
export async function fetchAllItemIds(admin: any, resource: any, cursor: string | null = null) {
  const count = await fetchResourceCount(admin, resource);

  const query = `
    query ($cursor: String) {
      ${resource}(first: 50, after: $cursor) {
        edges {
          cursor
          node { id }
        }
        pageInfo { hasNextPage }
      }
    }
  `;

  const res = await admin.graphql(query, { variables: { cursor } });
  const json = await res.json();
  const data = json?.data?.[resource];

  if (!data) {
    return {
      items: [],
      nextCursor: null,
      hasMore: false,
    };
  }

  const edges = data.edges;
  const items = edges.map((e: any) => e.node);
  const hasMore = data.pageInfo.hasNextPage;
  const nextCursor = hasMore ? edges.at(-1).cursor : null;
  return {
    items,
    nextCursor,
    hasMore,
    count,
  };
}

/* ------------------ REMOVE ALL METAFIELDS IN PAGES OF 200 ------------------ */
export async function removeAllMetafields(
  admin: any,
  resource: any,
  namespace: string,
  key: string,
  cursor: string | null = null,
) {
  const page = await fetchAllItemIds(admin, resource, cursor);

  const metafields = page.items.map((item: any) => ({
    ownerId: item.id,
    namespace,
    key,
  }));

  const batchResults = await deleteMetafields(admin, metafields);

  return {
    results: batchResults,
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
    ResourceCount: page?.count?.count,
  };
}

/* ------------------ REMOVE SPECIFIC METAFIELD ------------------ */
export async function removeSpecificMetafield(
  admin: any,
  id: string,
  namespace: string,
  key: string,
  value: any,
  type: string,
  flag: any,
  flag1: any,
  objectType: string,
) {
  flag = String(flag).toLowerCase() === "true";
  flag1 = String(flag1).toLowerCase() === "true";

  let ownerId = id;

  if (flag) {
    const validator = validateShopifyId(ownerId, objectType);
    if (!validator.isValid) {
      return { id, success: false, errors: validator.error, data: null };
    }
    // Verify resource exists
    try {
      const query = `query getResource($id: ID!) { node(id: $id) { id } }`;
      const res = await admin.graphql(query, { variables: { id: ownerId } });
      const json = await res.json();
      if (!json?.data?.node) {
        return { id, success: false, errors: `Resource not found.\nNo ${objectType} exists for this Shopify ID.\nPlease verify the Shopify ID and try again.`, data: null };
      }
    } catch (e: any) {
      return { id, success: false, errors: `API Error.\nUnable to fetch the Shopify resource.\nError: ${e.message}`, data: null };
    }
  } else {
    const res = await fetchResourceId(admin, objectType, id);
    if (!res) {
      return {
        id,
        success: false,
        errors: `Could not resolve ID for: ${id}`,
        data: null,
      };
    }
    ownerId = res;
  }

  if (isEmptyValue(value) && flag1) {
    return {
      id,
      key,
      value,
      success: false,
      errors: `Value is empty: ${value}`,
    };
  }

  if (flag1 && type.startsWith("list.")) {

    if (type === "list.metaobject_reference") {
      const isMetaobjectId = (v: any) =>
        typeof v === "string" &&
        /^gid:\/\/shopify\/Metaobject\/\d+$/.test(v.trim());

      const resolveRemoveValue = async (raw: any) => {
        if (!raw) return null;
        if (isMetaobjectId(raw)) return raw;

        return await getMetaobjectIdFromMetafield(admin, {
          namespace,
          key,
          objectType: objectType as any,
          metaobjectHandle: raw,
        });
      };

      let removeList;

      if (Array.isArray(value)) {
        removeList = value;
      } else if (typeof value === "string" && value.trim().startsWith("[")) {
        try {
          removeList = JSON.parse(value);
        } catch {
          return {
            id: ownerId,
            success: false,
            errors: "Invalid JSON for remove values",
            data: null,
          };
        }
      } else if (typeof value === "string") {
        removeList = value
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);
      }

      if (!Array.isArray(removeList) || removeList.length === 0) {
        return {
          id: ownerId,
          success: false,
          errors: "No valid values provided for removal",
          data: null,
        };
      }

      const existingRaw = await fetchExistingMetafield(
        admin,
        ownerId,
        namespace,
        key
      );

      if (!existingRaw) {
        return {
          id: ownerId,
          success: false,
          errors: "Metafield does not exist",
          data: null,
        };
      }

      let existingList = [];
      try {
        existingList = JSON.parse(existingRaw);
      } catch {
        existingList = [];
      }

      const resolvedRemoveIds: Array<string> = [];

      for (const item of removeList) {
        const resolved = await resolveRemoveValue(item);
        if (!resolved) {
          return {
            id: ownerId,
            success: false,
            errors: `Metaobject not found: ${item}`,
            data: null,
          };
        }
        resolvedRemoveIds.push(resolved);
      }

      const filteredList = existingList.filter(
        (v: any) => !resolvedRemoveIds.includes(v)
      );

      const mutation = `
    mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id namespace key value type }
        userErrors { field message code }
      }
    }
  `;

      const updateRes = await admin.graphql(mutation, {
        variables: {
          metafields: [
            {
              ownerId,
              namespace,
              key,
              type,
              value: JSON.stringify(filteredList),
            },
          ],
        },
      });

      const json = await updateRes.json();
      const errors = json?.data?.metafieldsSet?.userErrors || [];

      return {
        id: ownerId,
        success: errors.length === 0,
        key,
        namespace,
        type,
        data: removeList,
        errors: errors.length ? errors.map((e: any) => e.message).join(", ") : null,
      };
    }

    else if (type === "list.product_reference" || type === "list.variant_reference" || type === "list.collection_reference" || type === "list.order_reference" || type === "list.customer_reference" || type === "list.page_reference" || type === "list.article_reference" || type === "list.company_reference") {

      const isShopifyGid = (value: any) =>
        typeof value === "string" && value.trim().startsWith("gid://shopify/");


      let incomingList;

      if (Array.isArray(value)) {
        incomingList = value;
      } else if (typeof value === "string" && value.trim().startsWith("[")) {
        try {
          incomingList = JSON.parse(value);
        } catch {
          return {
            id,
            key,
            value,
            success: false,
            errors: "Invalid JSON array for list reference metafield",
          };
        }
      } else if (typeof value === "string") {
        incomingList = value
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);
      }

      if (!Array.isArray(incomingList)) {
        return {
          id,
          key,
          value,
          success: false,
          errors: "Invalid list reference value",
        };
      }

      let resourceType = type
        .replace("list.", "")
        .replace("_reference", "");

      if (resourceType === "variant") resourceType = "productvariant";
      if (resourceType === "article") resourceType = "blogpost";

      const resolvedIds = [];

      for (const item of incomingList) {
        let resolvedId = item;

        if (!isShopifyGid(item)) {
          const resolved = await fetchResourceIdResourceReference(
            admin,
            resourceType.toLowerCase(),
            item
          );

          if (!resolved) {
            return {
              id,
              key,
              value,
              success: false,
              errors: `Could not resolve ${resourceType} reference: ${item}`,
            };
          }

          resolvedId = resolved;
        }

        resolvedIds.push(resolvedId);
      }

      // Deduplicate remove IDs
      const uniqueRemoveIds = [...new Set(resolvedIds)];

      const existingRaw = await fetchExistingMetafield(
        admin,
        ownerId,
        namespace,
        key
      );

      if (!existingRaw) {
        return {
          id: ownerId,
          success: false,
          key,
          namespace,
          type,
          errors: `Metafield value does not exist on ${objectType}`,
        };
      }

      let existingList;
      try {
        existingList = JSON.parse(existingRaw);
        if (!Array.isArray(existingList)) throw new Error();
      } catch {
        return {
          id: ownerId,
          success: false,
          key,
          namespace,
          type,
          errors: "Existing metafield value is not a valid list",
        };
      }

      const existingToRemove = uniqueRemoveIds.filter((id) =>
        existingList.includes(id)
      );

      if (existingToRemove.length === 0) {
        return {
          id: ownerId,
          success: false,
          key,
          namespace,
          type,
          errors: "None of the provided IDs exist in the metafield",
        };
      }

      const filteredList = existingList.filter(
        (v) => !existingToRemove.includes(v)
      );
      if (filteredList.length === 0) {
        await admin.graphql(
          `
      mutation ($metafields: [MetafieldIdentifierInput!]!) {
        metafieldsDelete(metafields: $metafields) {
          userErrors { message }
        }
      }
      `,
          {
            variables: {
              metafields: [{ ownerId, namespace, key }],
            },
          }
        );

        return {
          id: ownerId,
          success: true,
          key,
          namespace,
          type,
          data: existingToRemove,
          errors: null,
        };
      }

      const updateRes = await admin.graphql(
        `
    mutation ($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id namespace key value type }
        userErrors { field message code }
      }
    }
    `,
        {
          variables: {
            metafields: [
              {
                ownerId,
                namespace,
                key,
                type,
                value: JSON.stringify(filteredList),
              },
            ],
          },
        }
      );

      const json = await updateRes.json();

      if (!json?.data?.metafieldsSet) {
        return {
          id: ownerId,
          success: false,
          key,
          namespace,
          type,
          errors: "Metafield update failed",
        };
      }

      const errors = json.data.metafieldsSet.userErrors || [];

      return {
        id: ownerId,
        success: errors.length === 0,
        key,
        namespace,
        type,
        data: existingToRemove,
        errors: errors.length ? errors.map((e: any) => e.message).join(", ") : null,
      };
    }

    else {
      const existingRaw = await fetchExistingMetafield(
        admin,
        ownerId,
        namespace,
        key
      );

      if (!existingRaw) {
        return {
          id: ownerId,
          success: false,
          key,
          namespace,
          type,
          errors: `Metafield value does not exist on ${objectType}`,
        };
      }
      let existingList;
      try {
        existingList = JSON.parse(existingRaw);
        if (!Array.isArray(existingList)) throw new Error();
      } catch {
        return {
          id: ownerId,
          success: false,
          key,
          namespace,
          type,
          errors: "Existing metafield value is not a valid list",
        };
      }

      let valuesToRemove: any[] = [];
      if (
        typeof value === "string" &&
        value.trim().startsWith("[")
      ) {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            valuesToRemove = parsed;
          } else {
            valuesToRemove = [parsed];
          }
        } catch {
          valuesToRemove = [value.trim()];
        }
      } else if (Array.isArray(value)) {
        valuesToRemove = value;
      } else {
        valuesToRemove = [value];
      }

      const normalizeForComparison = (v: any) => typeof v === 'object' ? JSON.stringify(v) : String(v);
      const existingListStr = existingList.map(normalizeForComparison);
      const valuesToRemoveStr = valuesToRemove.map(normalizeForComparison);

      const missingValues = valuesToRemove.filter((v, i) => !existingListStr.includes(valuesToRemoveStr[i]));

      if (missingValues.length > 0) {
        return {
          id: ownerId,
          success: false,
          key,
          namespace,
          type,
          errors: "Provided value(s) do not exist in metafield: " + missingValues.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).join(", "),
        };
      }

      const filteredList = existingList.filter(
        (v) => !valuesToRemoveStr.includes(normalizeForComparison(v))
      );

      if (filteredList.length === 0) {
        await admin.graphql(
          `
      mutation ($metafields: [MetafieldIdentifierInput!]!) {
        metafieldsDelete(metafields: $metafields) {
          userErrors { message }
        }
      }
      `,
          {
            variables: {
              metafields: [{ ownerId, namespace, key }],
            },
          }
        );

        return {
          id: ownerId,
          success: true,
          key,
          namespace,
          type,
          data: valuesToRemove,
          errors: null,
        };
      }

      const updateRes = await admin.graphql(
        `
    mutation ($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id namespace key value type }
        userErrors { field message code }
      }
    }
    `,
        {
          variables: {
            metafields: [
              {
                ownerId,
                namespace,
                key,
                type,
                value: JSON.stringify(filteredList),
              },
            ],
          },
        }
      );

      const json = await updateRes.json();

      if (!json?.data?.metafieldsSet) {
        return {
          id: ownerId,
          success: false,
          key,
          namespace,
          type,
          errors: "Metafield update failed",
        };
      }

      const errors = json.data.metafieldsSet.userErrors || [];

      return {
        id: ownerId,
        success: errors.length === 0,
        key,
        namespace,
        type,
        data: valuesToRemove,
        errors: errors.length ? errors.map((e: any) => e.message).join(", ") : null,
      };
    }

  }

  const result = await deleteMetafields(admin, [{ ownerId, namespace, key }]);

  return {
    id: ownerId,
    success: result[0].success,
    data: result[0].data,
    errors: result[0].errors,
  };
}

export async function deleteMetafields(admin: any, metafields: any[]) {
  const results = [];

  const checkQuery = `
    query ($ownerId: ID!, $namespace: String!, $key: String!) {
      node(id: $ownerId) {
        ... on HasMetafields {
          metafield(namespace: $namespace, key: $key) {
            id
            namespace
            key
            type
            value
          }
        }
      }
    }
  `;

  const deleteQuery = `
    mutation ($metafields: [MetafieldIdentifierInput!]!) {
      metafieldsDelete(metafields: $metafields) {
        deletedMetafields { ownerId namespace key }
        userErrors { field message }
      }
    }
  `;

  for (const mf of metafields) {
    const { ownerId, namespace, key } = mf;

    const checkRes = await admin.graphql(checkQuery, {
      variables: { ownerId, namespace, key },
    });

    const checkJson = await checkRes.json();
    const found = checkJson?.data?.node?.metafield ?? null;

    if (!found) {
      results.push({
        id: ownerId,
        success: false,
        errors: "Metafield value is not present",
        data: null,
      });
      continue;
    }

    const data = {
      ownerId,
      namespace,
      key,
      metafieldId: found.id,
      type: found.type,
      value: found.value,
    };

    const deleteRes = await admin.graphql(deleteQuery, {
      variables: { metafields: [{ ownerId, namespace, key }] },
    });

    const deleteJson = await deleteRes.json();
    const deleted = deleteJson?.data?.metafieldsDelete?.deletedMetafields ?? [];
    const userErrors = deleteJson?.data?.metafieldsDelete?.userErrors ?? [];

    const success = deleted[0] !== null;
    const error = success ? null : userErrors?.[0]?.message || "Failed";

    results.push({
      id: ownerId,
      success,
      errors: error,
      data,
    });
  }
  return results;
}

/* ------------------ FETCH DEFINITIONS / VALUES ------------------ */
export async function fetchDefinitions(admin: any, resource: string) {
  if (resource === "blog") return await fetchBlogMeta(admin);
  if (resource === "article") return await fetchBlogPostMeta(admin);
  return await fetchGenericMeta(admin, resource);
}

/********** BLOG **********/
export async function fetchBlogMeta(admin: any) {
  const first = await admin.graphql(`
    query {
      blogs(first: 1) {
        edges { node { id } }
      }
    }
  `);

  const b = await first.json();
  const blogId = b?.data?.blogs?.edges?.[0]?.node?.id;
  if (!blogId) return fail("No blog found");

  let allMetafields = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const query = `
      query ($blogId: ID!, $cursor: String) {
        blog(id: $blogId) {
          id
          metafieldDefinitions(first: 200, after: $cursor) {
            edges {
              cursor
              node {
                id
                namespace
                key
                name
                description
                type { name }
                validations { name value }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    `;

    const res: any = await admin.graphql(query, {
      variables: { blogId, cursor },
    });

    const json: any = await res.json();
    const defs = json.data?.blog?.metafieldDefinitions;
    if (!defs) break;

    allMetafields.push(...defs.edges.map((e: any) => e.node));

    hasNextPage = defs.pageInfo.hasNextPage;
    cursor = defs.pageInfo.endCursor;
  }

  return success({
    item: { id: blogId },
    metafields: allMetafields,
  });
}

/********** ARTICLE **********/
export async function fetchBlogPostMeta(admin: any) {
  const blogs = await admin.graphql(`
    query {
      blogs(first: 1) {
        edges { node { id } }
      }
    }
  `);
  const b = await blogs.json();
  const blogId = b?.data?.blogs?.edges?.[0]?.node?.id;
  if (!blogId) return fail("No blog found");

  const articles = await admin.graphql(
    `
    query ($blogId: ID!) {
      blog(id: $blogId) {
        articles(first: 1) {
          edges { node { id } }
        }
      }
    }
    `,
    { variables: { blogId } },
  );
  const a = await articles.json();
  const articleId = a?.data?.blog?.articles?.edges?.[0]?.node?.id;
  if (!articleId) return fail("No article found");

  let allMetafields = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const query = `
      query ($articleId: ID!, $cursor: String) {
        article(id: $articleId) {
          id
          metafieldDefinitions(first: 200, after: $cursor) {
            edges {
              cursor
              node {
                id
                namespace
                key
                name
                description
                type { name }
                validations { name value }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    `;

    const response: any = await admin.graphql(query, {
      variables: { articleId, cursor },
    });

    const json: any = await response.json();

    const defs: any = json.data?.article?.metafieldDefinitions;
    if (!defs) break;

    allMetafields.push(...defs.edges.map((e: any) => e.node));

    hasNextPage = defs.pageInfo.hasNextPage;
    cursor = defs.pageInfo.endCursor;
  }

  return success({
    item: { id: articleId },
    metafields: allMetafields,
  });
}

/********** PRODUCT / ORDER / CUSTOMER ETC **********/
export async function fetchGenericMeta(admin: any, resource: string) {
  const resourceOwnerTypeMap: Record<string, string> = {
    products: "PRODUCT",
    productVariants: "PRODUCTVARIANT",
    collections: "COLLECTION",
    customers: "CUSTOMER",
    orders: "ORDER",
    companies: "COMPANY",
    companyLocations: "COMPANY_LOCATION",
    locations: "LOCATION",
    pages: "PAGE",
    blog: "BLOG",
    articles: "ARTICLE",
    markets: "MARKET",
  };

  const ownerType = resourceOwnerTypeMap[resource];
  if (!ownerType) return fail("Unsupported resource type for metafields");

  let allMetafields: any[] = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const pageQuery = `
      query FetchMetafields($cursor: String) {
        metafieldDefinitions(first: 200, after: $cursor, ownerType: ${ownerType}) {
          edges {
            cursor
            node {
              id
              namespace
              key
              name
              description
              type { name }
              validations { name value }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    try {
      const pageRes: any = await admin.graphql(pageQuery, { variables: { cursor } });
      const pageJson: any = await pageRes.json();

      const defs = pageJson.data?.metafieldDefinitions;

      if (!defs) break;

      allMetafields.push(...defs.edges.map((e: any) => e.node));

      hasNextPage = defs.pageInfo.hasNextPage;
      cursor = defs.pageInfo.endCursor;
    } catch (e) {
      return fail("Failed to fetch metafield definitions");
    }
  }

  return success({
    item: null, // Legacy field, no longer needed
    metafields: allMetafields,
  });
}

function isEmptyValue(value: any) {
  if (value == null) return true;
  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (typeof value === 'string') {
    const trimmed = value;

    if (trimmed === '') return true;
    if (trimmed === '[]') return true;

    if (
      (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('{') && trimmed.endsWith('}'))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) && parsed.length === 0;
      } catch {
        return false;
      }
    }

    return false;
  }

  return false;
}

/* ------------------  UPDATE MUTATION ------------------ */
export async function updateSpecificMetafield(
  admin: any,
  id: string,
  namespace: string,
  key: string,
  value: any,
  type: string,
  flag: any,
  flag2: any,
  objectType: string,
) {
  flag = String(flag).toLowerCase() === "true";
  flag2 = String(flag2).toLowerCase() === "true";

  let ownerId = id;

  if (flag) {
    const validator = validateShopifyId(ownerId, objectType);
    if (!validator.isValid) {
      return { id, success: false, errors: validator.error };
    }
    // Verify resource exists
    try {
      const query = `query getResource($id: ID!) { node(id: $id) { id } }`;
      const res = await admin.graphql(query, { variables: { id: ownerId } });
      const json = await res.json();
      if (!json?.data?.node) {
        return { id, success: false, errors: `Resource not found.\nNo ${objectType} exists for this Shopify ID.\nPlease verify the Shopify ID and try again.` };
      }
    } catch (e: any) {
      return { id, success: false, errors: `API Error.\nUnable to fetch the Shopify resource.\nError: ${e.message}` };
    }
  } else {
    const resolved = await fetchResourceId(admin, objectType, id);
    if (!resolved) {
      return {
        id,
        success: false,
        errors: `Could not resolve ID for: ${id}`,
      };
    }
    ownerId = resolved;
  }

  if (isEmptyValue(value)) {
    return {
      id,
      key,
      value,
      success: false,
      errors: `Value is empty: ${value}`,
    };
  }
  function isMetaobjectId(v: any) {
    return (
      typeof v === "string" &&
      /^gid:\/\/shopify\/Metaobject\/\d+$/.test(v.trim())
    );
  }
  function isShopifyGid(value: any) {
    return (
      typeof value === "string" &&
      value.trim().startsWith("gid://shopify/")
    );
  }

  async function resolveMetaobjectValue(raw: any) {
    if (!raw) return null;

    if (isMetaobjectId(raw)) return raw;

    const resolved = await getMetaobjectIdFromMetafield(admin, {
      namespace,
      key,
      objectType: objectType as any,
      metaobjectHandle: raw,
    });

    return resolved || null;
  }

  let normalizedValue;
  let responseValue = value;
  if (type === "metaobject_reference") {
    const resolvedId = await resolveMetaobjectValue(value);

    if (!resolvedId) {
      return {
        id,
        key,
        value,
        success: false,
        errors: `Could not resolve metaobject reference: ${value}`,
      };
    }

    normalizedValue = resolvedId;
    responseValue = resolvedId;
  }

  /* ---------- LIST METAOBJECT REFERENCE ---------- */
  else if (type === "list.metaobject_reference") {
    let incomingList;

    if (Array.isArray(value)) {
      incomingList = value;
    } else if (typeof value === "string" && value.trim().startsWith("[")) {
      try {
        incomingList = JSON.parse(value);
      } catch {
        return {
          id,
          key,
          value,
          success: false,
          errors: "Invalid JSON for list.metaobject_reference",
        };
      }
    } else if (typeof value === "string") {
      incomingList = value.split(",").map(v => v.trim()).filter(Boolean);
    }

    if (!Array.isArray(incomingList)) {
      return {
        id,
        key,
        value,
        success: false,
        errors: "Invalid list.metaobject_reference value",
      };
    }

    const resolvedIds = [];

    for (const item of incomingList) {
      const resolved = await resolveMetaobjectValue(item);
      if (!resolved) {
        return {
          id,
          key,
          value,
          success: false,
          errors: `Could not resolve metaobject reference: ${item}`,
        };
      }
      resolvedIds.push(resolved);
    }

    if (flag2) {
      normalizedValue = JSON.stringify(resolvedIds);
      responseValue = JSON.stringify(resolvedIds);
    } else {
      const existingRaw = await fetchExistingMetafield(
        admin,
        ownerId,
        namespace,
        key,
      );

      let existingList = [];
      try {
        existingList = existingRaw ? JSON.parse(existingRaw) : [];
      } catch { }

      const merged = Array.from(new Set([...existingList, ...resolvedIds]));
      normalizedValue = JSON.stringify(merged);
      responseValue = JSON.stringify(resolvedIds);
    }
  }
  //  SINGLE RESOURCE REFERENCE
  else if (type === "product_reference" || type === "variant_reference" || type === "collection_reference" || type === "order_reference" || type === "customer_reference" || type === "page_reference" || type === "article_reference" || type === "company_reference") {
    if (!isShopifyGid(value)) {
      let resourceType = type;
      if (resourceType === "product_reference") resourceType = "product";
      if (resourceType === "variant_reference") resourceType = "productvariant";
      if (resourceType === "collection_reference") resourceType = "collection";
      if (resourceType === "order_reference") resourceType = "order";
      if (resourceType === "customer_reference") resourceType = "customer";
      if (resourceType === "page_reference") resourceType = "page";
      if (resourceType === "article_reference") resourceType = "blogpost";
      if (resourceType === "company_reference") resourceType = "company";
      const resolved = await fetchResourceIdResourceReference(admin, resourceType?.toLowerCase(), value);
      if (!resolved) {
        return {
          id,
          key,
          value,
          success: false,
          errors: `Could not find ${objectType} for: ${value}`,
        };
      }
      ownerId = resolved;
    }
    normalizedValue = ownerId;
    responseValue = ownerId;
  }

  /* ---------- LIST RESOURCE REFERENCE ---------- */
  else if (
    type === "list.product_reference" ||
    type === "list.variant_reference" ||
    type === "list.collection_reference" ||
    type === "list.order_reference" ||
    type === "list.customer_reference" ||
    type === "list.page_reference" ||
    type === "list.article_reference" ||
    type === "list.company_reference"
  ) {
    let incomingList;

    /* -------- Parse incoming value -------- */
    if (Array.isArray(value)) {
      incomingList = value;
    } else if (typeof value === "string" && value.trim().startsWith("[")) {
      try {
        incomingList = JSON.parse(value);
      } catch {
        return {
          id,
          key,
          value,
          success: false,
          errors: "Invalid JSON array for list reference metafield",
        };
      }
    } else if (typeof value === "string") {
      incomingList = value
        .split(",")
        .map(v => v.trim())
        .filter(Boolean);
    }

    if (!Array.isArray(incomingList)) {
      return {
        id,
        key,
        value,
        success: false,
        errors: "Invalid list reference value",
      };
    }

    /* -------- Determine resource type -------- */
    let resourceType = type
      .replace("list.", "")
      .replace("_reference", "");

    if (resourceType === "variant") resourceType = "productvariant";
    if (resourceType === "article") resourceType = "blogpost";

    const resolvedIds = [];

    /* -------- Resolve each value -------- */
    for (const item of incomingList) {
      let resolvedId = item;

      if (!isShopifyGid(item)) {
        const resolved = await fetchResourceIdResourceReference(
          admin,
          resourceType.toLowerCase(),
          item
        );

        if (!resolved) {
          return {
            id,
            key,
            value,
            success: false,
            errors: `Could not resolve ${resourceType} reference: ${item}`,
          };
        }

        resolvedId = resolved;
      }

      resolvedIds.push(resolvedId);
    }

    /* -------- Apply flag logic -------- */
    if (flag2) {
      normalizedValue = JSON.stringify(resolvedIds);
      responseValue = JSON.stringify(resolvedIds);
    } else {
      const existingRaw = await fetchExistingMetafield(
        admin,
        ownerId,
        namespace,
        key
      );

      let existingList = [];
      try {
        existingList = existingRaw ? JSON.parse(existingRaw) : [];
      } catch { }

      const merged = Array.from(new Set([...existingList, ...resolvedIds]));

      normalizedValue = JSON.stringify(merged);
      responseValue = JSON.stringify(resolvedIds);
    }
  }

  /* ---------- OTHER LIST TYPES ---------- */
  else if (type.startsWith("list.")) {
    let incomingList;

    if (Array.isArray(value)) {
      incomingList = value;
    } else if (typeof value === "string" && value.trim().startsWith("[")) {
      try {
        incomingList = JSON.parse(value);
      } catch {
        return {
          id,
          key,
          value,
          success: false,
          errors: `Invalid JSON for ${type}`,
        };
      }
    } else if (typeof value === "string") {
      incomingList = value.split(",").map(v => v.trim()).filter(Boolean);
    }

    if (!Array.isArray(incomingList)) {
      return {
        id,
        key,
        value,
        success: false,
        errors: `Expected list value for ${type}`,
      };
    }

    if (flag2) {
      normalizedValue = JSON.stringify(incomingList);
      responseValue = JSON.stringify(incomingList);
    } else {
      const existingRaw = await fetchExistingMetafield(
        admin,
        ownerId,
        namespace,
        key,
      );

      let existingList = [];
      try {
        existingList = existingRaw ? JSON.parse(existingRaw) : [];
      } catch { }

      const normalizeForComparison = (v: any) => typeof v === 'object' ? JSON.stringify(v) : String(v);
      const existingListStr = existingList.map(normalizeForComparison);

      const merged = [...existingList];
      for (const item of incomingList) {
        if (!existingListStr.includes(normalizeForComparison(item))) {
          merged.push(item);
          existingListStr.push(normalizeForComparison(item));
        }
      }

      normalizedValue = JSON.stringify(merged);
      responseValue = JSON.stringify(incomingList);
    }
  }

  /* ---------- SCALAR TYPES ---------- */
  else {

    normalizedValue =
      value === null || value === undefined ? "" : String(value);
  }


  //  STEP 3: SET METAFIELD
  const metafieldInput = {
    ownerId,
    namespace,
    key,
    type,
    value: normalizedValue,
  };

  const mutation = `
    mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id namespace key value type }
        userErrors { field message code }
      }
    }
  `;

  const res = await admin.graphql(mutation, {
    variables: { metafields: [metafieldInput] },
  });

  const json = await res.json();
  const errors = json?.data?.metafieldsSet?.userErrors || [];

  return {
    id,
    key,
    namespace,
    value: responseValue,
    success: errors.length === 0,
    errors: errors.length ? errors.map((e: any) => e.message).join(", ") : null,
  };
}

async function fetchExistingMetafield(admin: any, ownerId: string, namespace: string, key: string) {
  const query = `
    query getMetafield($id: ID!, $namespace: String!, $key: String!) {
      node(id: $id) {
        ... on HasMetafields {
          metafield(namespace: $namespace, key: $key) {
            value
          }
        }
      }
    }
  `;

  const res = await admin.graphql(query, {
    variables: { id: ownerId, namespace, key },
  });

  const json = await res.json();
  return json?.data?.node?.metafield?.value ?? null;
}

export async function fetchResourceId(admin: any, objectType: string, value: any) {
  const queries: any = {
    customer: {
      query: `query($value: String!) {
        customers(first: 1, query: $value) {
          edges { node { id } }
        }
      }`,
      buildQuery: (v: string) => `email:${v}`,
      path: (res: any) => res?.customers?.edges?.[0]?.node?.id,
    },

    order: {
      query: `query($value: String!) {
        orders(first: 1, query: $value) {
          edges { node { id } }
        }
      }`,
      buildQuery: (v: string) => `name:${v}`,
      path: (res: any) => res?.orders?.edges?.[0]?.node?.id,
    },

    company: {
      query: `query($value: String!) {
        companies(first: 1, query: $value) {
          edges { node { id  } }
        }
      }`,
      buildQuery: (v: any) => `external_id:${v}`,
      path: (res: any) => res?.companies?.edges?.[0]?.node?.id,
    },

    companyLocation: {
      query: `query($value: String!) {
        companyLocations(first: 1, query: $value) {
          edges { node { id  } }
        }
      }`,
      buildQuery: (v: any) => `external_id:${v}`,
      path: (res: any) => res?.companyLocations?.edges?.[0]?.node?.id,
    },

    location: {
      query: `query($value: String!) {
        locations(first: 1, query: $value) {
          edges { node { id } }
        }
      }`,
      buildQuery: (v: any) => `name:${v}`,
      path: (res: any) => res?.locations?.edges?.[0]?.node?.id,
    },

    page: {
      query: `query($value: String!) {
        pages(first: 1, query: $value) {
          edges { node { id } }
        }
      }`,
      buildQuery: (v: any) => `handle:${v}`,
      path: (res: any) => res?.pages?.edges?.[0]?.node?.id,
    },

    blog: {
      query: `query($value: String!) {
        blogs(first: 1, query: $value) {
          edges { node { id } }
        }
      }`,
      buildQuery: (v: any) => `handle:${v}`,
      path: (res: any) => res?.blogs?.edges?.[0]?.node?.id,
    },

    blogPost: {
      query: `query($value: String!) {
        articles(first: 1, query: $value) {
          edges { node { id } }
        }
      }`,
      buildQuery: (v: any) => `handle:${v}`,
      path: (res: any) => res?.articles?.edges?.[0]?.node?.id,
    },

    product: {
      query: `query($value: String!) {
        productByHandle(handle: $value) {
          id
        }
      }`,
      buildQuery: (v: any) => v,
      path: (res: any) => res?.productByHandle?.id,
    },

    collection: {
      query: `query($value: String!) {
        collectionByHandle(handle: $value) {
          id
        }
      }`,
      buildQuery: (v: any) => v,
      path: (res: any) => res?.collectionByHandle?.id,
    },

    productVariant: {
      query: `query($value: String!) {
    productVariants(first: 1, query: $value) {
      edges {
        node {
          id
        }
      }
    }
  }`,
      buildQuery: (v: any) => `sku:${v}`,
      path: (res: any) => res?.productVariants?.edges?.[0]?.node?.id,
    },

    market: {
      query: `
    query ($value: String!) {
      markets(first: 1, query: $value) {
        nodes {
          id
        }
      }
    }
  `,
      buildQuery: (v: any) => `name:${String(v).trim()}`,
      path: (res: any) => res?.markets?.nodes?.[0]?.id,
    },


  };
  const config = queries[objectType];
  if (!config) {
    throw new Error(`Unsupported resource type: ${objectType}`);
  }

  const builtValue = config.buildQuery(value);
  const variables = { value: builtValue };

  try {
    const response = await admin.graphql(config.query, { variables });
    const json = await response.json();
    return config.path(json?.data) || null;
  } catch (error) {
    return null;
  }
}

const metafieldOwnerTypeMap = {
  product: "PRODUCT",
  productVariant: "PRODUCTVARIANT",
  collection: "COLLECTION",
  customer: "CUSTOMER",
  order: "ORDER",
  company: "COMPANY",
  companyLocation: "COMPANY_LOCATION",
  location: "LOCATION",
  page: "PAGE",
  blog: "BLOG",
  blogPost: "ARTICLE",
  market: "MARKET",
};

export async function getMetaobjectIdFromMetafield(
  admin: any,
  { namespace, key, objectType, metaobjectHandle }: { namespace: string, key: string, objectType: any, metaobjectHandle: string }
) {

  const ownerType = metafieldOwnerTypeMap[objectType as keyof typeof metafieldOwnerTypeMap];

  if (!ownerType) {
    return null;
  }

  const defRes = await admin.graphql(
    `#graphql
    query ($namespace: String!, $key: String!, $ownerType: MetafieldOwnerType!) {
      metafieldDefinition(
        identifier: {
          namespace: $namespace
          key: $key
          ownerType: $ownerType
        }
      ) {
        validations {
          name
          value
        }
      }
    }`,
    { variables: { namespace, key, ownerType } }
  );

  const defJson = await defRes.json();
  const metaobjectDefinitionId =
    defJson?.data?.metafieldDefinition?.validations?.find(
      (v: any) => v.name === "metaobject_definition_id"
    )?.value;

  if (!metaobjectDefinitionId) {
    return null;
  }

  const typeRes = await admin.graphql(
    `#graphql
    query ($id: ID!) {
      metaobjectDefinition(id: $id) {
        type
      }
    }`,
    { variables: { id: metaobjectDefinitionId } }
  );

  const typeJson = await typeRes.json();
  const metaobjectType = typeJson?.data?.metaobjectDefinition?.type;

  if (!metaobjectType) {
    return null;
  }

  const metaRes = await admin.graphql(
    `#graphql
    query ($type: String!, $handle: String!) {
      metaobjectByHandle(handle: { type: $type, handle: $handle }) {
        id
        handle
      }
    }`,
    {
      variables: {
        type: metaobjectType,
        handle: metaobjectHandle,
      },
    }
  );

  const metaJson = await metaRes.json();
  const metaobjectId = metaJson?.data?.metaobjectByHandle?.id;

  if (!metaobjectId) {
    return null;
  }

  return metaobjectId;
}

export async function fetchResourceIdResourceReference(admin: any, objectType: string, value: any) {
  const queries: any = {
    customer: {
      query: `query($value: String!) {
        customers(first: 1, query: $value) {
          edges { node { id } }
        }
      }`,
      buildQuery: (v: string) => `email:${v}`,
      path: (res: any) => res?.customers?.edges?.[0]?.node?.id,
    },

    order: {
      query: `query($value: String!) {
        orders(first: 1, query: $value) {
          edges { node { id } }
        }
      }`,
      buildQuery: (v: string) => `name:${v}`,
      path: (res: any) => res?.orders?.edges?.[0]?.node?.id,
    },

    company: {
      query: `query($value: String!) {
        companies(first: 1, query: $value) {
          edges { node { id  } }
        }
      }`,
      buildQuery: (v: string) => `external_id:${v}`,
      path: (res: any) => res?.companies?.edges?.[0]?.node?.id,
    },

    page: {
      query: `query($value: String!) {
        pages(first: 1, query: $value) {
          edges { node { id } }
        }
      }`,
      buildQuery: (v: string) => `handle:${v}`,
      path: (res: any) => res?.pages?.edges?.[0]?.node?.id,
    },

    blogpost: {
      query: `query($value: String!) {
        articles(first: 1, query: $value) {
          edges { node { id } }
        }
      }`,
      buildQuery: (v: string) => `handle:${v}`,
      path: (res: any) => res?.articles?.edges?.[0]?.node?.id,
    },

    product: {
      query: `query($value: String!) {
        productByHandle(handle: $value) {
          id
        }
      }`,
      buildQuery: (v: string) => v,
      path: (res: any) => res?.productByHandle?.id,
    },

    collection: {
      query: `query($value: String!) {
        collectionByHandle(handle: $value) {
          id
        }
      }`,
      buildQuery: (v: string) => v,
      path: (res: any) => res?.collectionByHandle?.id,
    },

    productvariant: {
      query: `query($value: String!) {
    productVariants(first: 1, query: $value) {
      edges {
        node {
          id
        }
      }
    }
  }`,
      buildQuery: (v: string) => `sku:${v}`,
      path: (res: any) => res?.productVariants?.edges?.[0]?.node?.id,
    },

  };
  const config = queries[objectType];
  if (!config) {
    throw new Error(`Unsupported resource type: ${objectType}`);
  }

  const builtValue = config.buildQuery(value);
  const variables = { value: builtValue };
  const response = await admin.graphql(config.query, { variables });
  const json = await response.json();
  const result = config.path(json.data) || null;

  return result;
}

const paginationQueryMap: Record<string, string> = {
  products: `
    query ProductsPagination($after: String) {
      products(first: 200, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `,
  productVariants: `
    query ProductVariantsPagination($after: String) {
      productVariants(first: 200, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `,
  collections: `
    query CollectionsPagination($after: String) {
      collections(first: 200, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `,
  customers: `
    query CustomersPagination($after: String) {
      customers(first: 200, after: $after, sortKey: CREATED_AT, reverse: true) {
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `,
  orders: `
    query OrdersPagination($after: String) {
      orders(first: 200, after: $after, sortKey: CREATED_AT, reverse: true) {
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `,
  companies: `
    query CompaniesPagination($after: String) {
      companies(first: 200, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `,
  companyLocations: `
    query CompanyLocationsPagination($after: String) {
      companyLocations(first: 200, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `,
  locations: `
    query LocationsPagination($after: String) {
      locations(first: 200, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `,
  pages: `
    query PagesPagination($after: String) {
      pages(first: 200, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `,
  blog: `
    query BlogsPagination($after: String) {
      blogs(first: 200, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `,
  articles: `
    query ArticlesPagination($after: String) {
      articles(first: 200, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `,
  markets: `
    query MarketsPagination($after: String) {
      markets(first: 200, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `,
};

export async function getPaginationInfo(admin: any, resource: string) {
  // 1. Get total resource count
  const countObj = await fetchResourceCount(admin, resource as any);
  const totalCount = countObj.count;

  if (totalCount <= 0) {
    return {
      totalCount: 0,
      pages: [],
    };
  }

  const query = paginationQueryMap[resource];
  if (!query) {
    throw new Error(`Unsupported pagination resource: ${resource}`);
  }

  const pages = [];
  const pageSize = 5000;
  const loopLimit = 200; // items per fetch
  const fetchesPerPage = pageSize / loopLimit; // 25 fetches

  // Page 1 always starts with null cursor
  pages.push({
    page: 1,
    start: 1,
    end: Math.min(pageSize, totalCount),
    cursor: null,
  });

  let currentCursor: string | null = null;
  let hasNextPage = true;

  // Let's loop to find the boundaries
  const totalPages = Math.ceil(totalCount / pageSize);

  for (let p = 1; p < totalPages; p++) {
    for (let f = 0; f < fetchesPerPage; f++) {
      if (!hasNextPage) break;

      const res: any = await admin.graphql(query, { variables: { after: currentCursor } });
      const json = await res.json();
      const connectionKey = resource === "blog" ? "blogs" : resource;
      const connection = json?.data?.[connectionKey];
      const pageInfo = connection?.pageInfo;

      if (!pageInfo) {
        hasNextPage = false;
        break;
      }

      currentCursor = pageInfo.endCursor;
      hasNextPage = pageInfo.hasNextPage;
    }

    if (currentCursor) {
      const pageNum = p + 1;
      const start = p * pageSize + 1;
      const end = Math.min(pageNum * pageSize, totalCount);
      pages.push({
        page: pageNum,
        start,
        end,
        cursor: currentCursor,
      });
    }

    if (!hasNextPage) break;
  }

  return {
    totalCount,
    pages,
  };
}
