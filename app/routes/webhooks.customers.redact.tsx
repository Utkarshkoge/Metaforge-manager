import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, topic } = await authenticate.webhook(request);
  
  console.log(`--- Webhook: ${topic} ---`);
  console.log(`Shop: ${shop}`);
  
  // NOTE: This application does not store any customer Personally Identifiable Information (PII)
  // in its database (such as names, emails, addresses, or phone numbers).
  // Therefore, a 200 OK response signifies compliance with this redaction request.

  return new Response();
};
