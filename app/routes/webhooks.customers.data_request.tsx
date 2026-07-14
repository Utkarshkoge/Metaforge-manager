import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, topic } = await authenticate.webhook(request);
  
  console.log(`--- Webhook: ${topic} ---`);
  console.log(`Shop: ${shop}`);
  console.log("Payload:", JSON.stringify(payload, null, 2));

  return new Response();
};
