import { authenticate } from "../shopify.server";
import type { ActionFunctionArgs } from "react-router";

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const metaobjectId = formData.get("rowId");

    if (!metaobjectId) {
      return { success: false, message: "Missing metaobject id" };
    }
    const { admin } = await authenticate.admin(request);

    const mutation = `
      mutation UpdateMetaobjectRestore($id: ID!, $metaobject: MetaobjectUpdateInput!) {
  metaobjectUpdate(id: $id, metaobject: $metaobject) {
    metaobject {
      id
      handle
    }
    userErrors {
      field
      message
    }
  }
}
    `;

    const variables = {
      id: metaobjectId,
      metaobject: { fields: [{ key: "restore", value: "false" }] },
    };

    const response = await admin.graphql(mutation, { variables });
    const data: any = await response.json();

    const userErrors = data?.data?.metaobjectUpdate?.userErrors || [];
    if (userErrors.length > 0) {
      return { success: false, message: "Failed to update metaobject", error: userErrors };
    }

    return { success: true, updated: data?.data?.metaobjectUpdate?.metaobject || null };
  } catch (err: any) {
    return {
      success: false,
      message: "Internal server error",
      error: err.message,
    };
  }
}
