import { authenticate } from "../shopify.server";
import type { LoaderFunctionArgs } from "react-router";

const METAOBJECT_TYPE = "__metaforge_app_database";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const { admin } = await authenticate.admin(request);
    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor");
    const direction = url.searchParams.get("direction") || "next"; // "next" or "prev"
    const limit = parseInt(url.searchParams.get("limit") || "10", 10);

    // Check if definition exists
    const definitionQuery = `
      query metaobjectDefinitionExistsByType($type: String!) {
        metaobjectDefinitionByType(type: $type) {
          id
        }
      }
    `;

    const defRes = await admin.graphql(definitionQuery, {
      variables: { type: METAOBJECT_TYPE },
    });

    const defJson = await defRes.json();
    const definitionExists = !!defJson?.data?.metaobjectDefinitionByType;

    if (!definitionExists) {
      return {
        successdb: false,
        database: [],
        pageInfo: { hasNextPage: false, hasPreviousPage: false },
        error: `Metaobject definition "${METAOBJECT_TYPE}" does not exist`,
      };
    }

    // Construct Pagination Arguments
    let paginationArgs = "";
    if (direction === "prev" && cursor) {
      paginationArgs = `last: ${limit}, before: "${cursor}"`;
    } else if (cursor) {
      paginationArgs = `first: ${limit}, after: "${cursor}"`;
    } else {
      paginationArgs = `first: ${limit}`;
    }

    const query = `
      query GetTagMetafieldDB {
        metaobjects(type: "${METAOBJECT_TYPE}", ${paginationArgs}, reverse: true) {
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
          nodes {
            id
            handle
            fields {
              key
              value
            }
          }
        }
      }
    `;

    const response = await admin.graphql(query);
    const data = await response.json();

    if ((data as any).errors) {
      return {
        successdb: false,
        error: "GraphQL error while fetching metaobjects",
      };
    }

    const nodes = data?.data?.metaobjects?.nodes || [];
    const pageInfo = data?.data?.metaobjects?.pageInfo || {
      hasNextPage: false,
      hasPreviousPage: false,
      startCursor: null,
      endCursor: null,
    };

    const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    let hasExpired = false;

    const formatted = [];
    for (const obj of nodes) {
      const fieldMap = Object.fromEntries(
        (obj?.fields || []).map((f: any) => [f.key, f.value]),
      );

      const timeVal = fieldMap.time || null;
      if (timeVal) {
        const createdTime = new Date(timeVal).getTime();
        if (!isNaN(createdTime) && (now - createdTime) > TWO_DAYS_MS) {
          hasExpired = true;
          continue; // Skip expired
        }
      } else {
        hasExpired = true;
        continue; // Skip if no time field
      }

      let parsedValue = [];
      try {
        parsedValue = fieldMap.value ? JSON.parse(fieldMap.value) : [];
      } catch (e) {
        parsedValue = [];
      }

      formatted.push({
        id: obj.id,
        userName: fieldMap.username || "unknown",
        operation: fieldMap.operation || "",
        objectType: fieldMap.objecttype || "",
        value: parsedValue,
        restore: fieldMap.restore === "true",
        time: timeVal,
      });
    }

    if (hasExpired) {
      pageInfo.hasNextPage = false;
      pageInfo.endCursor = null;
    }

    return {
      successdb: true,
      database: formatted,
      pageInfo,
    };

  } catch (error: any) {
    return {
      successdb: false,
      error: "Failed to fetch metaobject database",
    };
  }
}
