import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, topic } = await authenticate.webhook(request);
  
  console.log(`--- Webhook: ${topic} ---`);
  console.log(`Shop: ${shop}`);
  
  try {
    // 1. Delete all sessions for the shop
    await db.session.deleteMany({ where: { shop } });

    // 2. Delete Active Subscription
    await db.activeSubscription.deleteMany({ where: { shopDomain: shop } });

    // 3. Delete Free Plan Limits
    await db.freePlanLimits.deleteMany({ where: { shopDomain: shop } });

    // 4. Delete Basic Plan Limits
    await db.basicPlanLimits.deleteMany({ where: { shopDomain: shop } });
    
    console.log(`Successfully redacted data for shop: ${shop}`);
  } catch (error) {
    console.error(`Error redacting data for shop ${shop}:`, error);
  }

  return new Response();
};
