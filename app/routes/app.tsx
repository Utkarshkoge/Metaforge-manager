import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import "@shopify/polaris/build/esm/styles.css";
import translations from "@shopify/polaris/locales/en.json";
import prisma from "../db.server";

export function getRemainingDaysCalendar(
  startDate: Date,
  totalDays = 30,
): number {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const elapsedMs = today.getTime() - start.getTime();
  const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));

  const remaining = totalDays - elapsedDays;

  return Math.max(0, remaining);
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { session, admin } = await authenticate.admin(request);

    const shopDomain = session?.shop;

    try {
      await checkAndResetSubscription(shopDomain, prisma);
    } catch (checkError) {
      console.error("checkAndResetSubscription failed", checkError);
    }

    let active = null;
    let dbFailed = false;
    let plan = "FREE";
    let time: Date | null = null;
    let remainingDays: number | null = null;
    let limits: any = null;

    try {
      active = await prisma.activeSubscription.findUnique({
        where: { shopDomain },
      });
    } catch (dbError) {
      console.error("DB failed to read activeSubscription", dbError);
      dbFailed = true;
    }

    if (active && !dbFailed) {
      plan = active.plan ?? "FREE";
      time = active.currentPeriodEnd;
    }

    try {
      if (plan === "FREE") {
        limits =
          (await prisma.freePlanLimits.findUnique({ where: { shopDomain } })) ??
          (await prisma.freePlanLimits.create({ data: { shopDomain } }));
      } else if (plan === "BASIC") {
        limits =
          (await prisma.basicPlanLimits.findUnique({ where: { shopDomain } })) ??
          (await prisma.basicPlanLimits.create({ data: { shopDomain } }));
      } else if (plan === "ADVANCED") {
        limits = Infinity;
      }
    } catch (dbLimitError) {
      console.error("DB failed to read/create limits", dbLimitError);
      dbFailed = true;
    }

    // Calculate remaining days from DB if successful
    if (plan !== "FREE" && active?.currentPeriodEnd) {
      const periodEnd = new Date(active.currentPeriodEnd);
      const today = new Date();
      const diffTime = periodEnd.getTime() - today.getTime();
      const calculatedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      remainingDays = Math.max(0, calculatedDays);
    } else {
      const firstUsedAt = limits?.firstUsedAt;
      if (firstUsedAt) {
        remainingDays = getRemainingDaysCalendar(new Date(firstUsedAt));
      }
    }

    // Fallback to Shopify Subscription API if DB failed or active plan not present in DB
    if (!active || dbFailed) {
      try {
        const response = await admin.graphql(
          `#graphql
          query ActiveSubscriptionsForCurrentApp {
            currentAppInstallation {
              activeSubscriptions {
                id
                name
                status
                createdAt
                currentPeriodEnd
              }
            }
          }
          `
        );
        const responseJson = await response.json();
        const activeSubFromApi = responseJson.data?.currentAppInstallation?.activeSubscriptions?.find(
          (sub: any) => sub.status === "ACTIVE"
        );

        if (activeSubFromApi) {
          plan = activeSubFromApi.name === "Basic" ? "BASIC" : activeSubFromApi.name === "Advanced" ? "ADVANCED" : "FREE";

          if (activeSubFromApi.currentPeriodEnd && plan !== 'FREE') {
            const periodEnd = new Date(activeSubFromApi.currentPeriodEnd);
            const today = new Date();
            const diffTime = periodEnd.getTime() - today.getTime();
            const calculatedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            remainingDays = Math.max(0, calculatedDays);
          }

          if (plan !== 'FREE') {
            try {
              await prisma.activeSubscription.upsert({
                where: { shopDomain },
                update: {
                  plan: plan as any,
                  subscriptionId: activeSubFromApi.id ?? "",
                  popupShown: false,
                  currentPeriodEnd: activeSubFromApi.currentPeriodEnd ? new Date(activeSubFromApi.currentPeriodEnd) : new Date(0),
                },
                create: {
                  shopDomain,
                  plan: plan as any,
                  subscriptionId: activeSubFromApi.id ?? "",
                  popupShown: false,
                  currentPeriodEnd: activeSubFromApi.currentPeriodEnd ? new Date(activeSubFromApi.currentPeriodEnd) : new Date(0),
                },
              });
            } catch (dbUpsertError) {
              console.error("Failed to upsert activeSubscription from API fallback", dbUpsertError);
            }
          }

        }

      } catch (apiError) {
        console.error("Error querying active subscriptions via API:", apiError);
      }
    }

    if (!limits || dbFailed) {
      limits = {
        tagGlobal: Infinity,
        metaGlobal: Infinity,
        metaRemoveCsvLimit: Infinity,
        metaUpdateCsvLimit: Infinity,
        tagAddCsvLimit: Infinity,
        tagRemoveCsvLimit: Infinity,
      };
    }

    return {
      apiKey: process.env.SHOPIFY_API_KEY!,
      planData: {
        plan,
        limits,
        remainingDays,
      },
    };
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    console.error("❌ Loader error:", error);

    throw new Response("Internal Server Error", {
      status: 500,
    });
  }
};

export default function App() {
  const { apiKey, planData } = useLoaderData<typeof loader>();
  return (
    <AppProvider embedded apiKey={apiKey}>
      <PolarisAppProvider i18n={translations}>
        <s-app-nav>
          <s-link href="/app/export-data">Export Data</s-link>
          <s-link href="/app/history">History</s-link>
          <s-link href="/app/billing/subscribe">Subscription Plans</s-link>
          <s-link href="/app/faq">FAQ</s-link>
        </s-app-nav>
        {/* 👇 provide plan globally */}
        <Outlet context={{ planData }} />
      </PolarisAppProvider>
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

export async function checkAndResetSubscription(shopDomain: string, prisma: any) {
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  /* ---------------- FREE PLAN ---------------- */
  const freePlan = await prisma.freePlanLimits.findUnique({
    where: { shopDomain },
  });

  if (freePlan) {
    if (freePlan.firstUsedAt < oneMonthAgo) {
      await prisma.$transaction([
        prisma.freePlanLimits.delete({
          where: { shopDomain },
        }),
        prisma.freePlanLimits.create({
          data: { shopDomain },
        }),
      ]);
    }
  }

  /* ---------------- BASIC PLAN ---------------- */
  const basicPlan = await prisma.basicPlanLimits.findUnique({
    where: { shopDomain },
  });

  if (basicPlan) {
    if (basicPlan.firstUsedAt < oneMonthAgo) {
      await prisma.basicPlanLimits.delete({
        where: { shopDomain },
      });
    }
  }

  return { ok: true };
}

