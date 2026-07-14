import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    try {
        const { session } = await authenticate.admin(request);
        const shopDomain = session.shop;

        const body = await request.json();

        const { plan, updates } = body as {
            plan: "FREE" | "BASIC";
            updates: Partial<{
                tagGlobal: number;
                tagSpecific: number;
                metaGlobal: number;
                tagAddCsvLimit: number;
                tagRemoveCsvLimit: number;
                metaUpdateCsvLimit: number;
                metaRemoveCsvLimit: number;
            }>;
        };

        if (!plan || !updates || Object.keys(updates).length === 0) {
            throw new Response("Plan and update fields are required", { status: 400 });
        }

        let updated;

        if (plan === "FREE") {
            updated = await prisma.freePlanLimits.update({
                where: { shopDomain },
                data: updates,
            });
        }

        if (plan === "BASIC") {
            updated = await prisma.basicPlanLimits.update({
                where: { shopDomain },
                data: updates,
            });
        }

        if (!updated) {
            throw new Response("Invalid plan", { status: 400 });
        }

        return true;
    } catch (error) {
        console.error("Error in api.update.plan action:", error);
        if (error instanceof Response) {
            throw error;
        }
        throw new Response("Internal Server Error", { status: 500 });
    }
};
