import { LoaderFunctionArgs, ActionFunctionArgs, useNavigate, useLoaderData, useFetcher } from "react-router";
import { useEffect, useState } from "react";
import {
    Page,
    Layout,
    Card,
    Text,
    Button,
    BlockStack,
    Box,
    Badge,
    Grid,
    InlineStack,
    List,
    Divider,
    Icon,
    Modal,
    Banner
} from "@shopify/polaris";
import { HomeIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { RouteErrorBoundary } from "app/component/RouteErrorBoundary";
import {
    GET_RECURRING_APPLICATION_CHARGES,
    CANCEL_SUBSCRIPTION,
    CREATE_SUBSCRIPTION
} from "../graphql/subscriptionQueries";

export const PLANS = {
    BASIC: {
        name: "Basic",
        price: 5,
    },
    ADVANCED: {
        name: "Advanced",
        price: 10,
    },
} as const;

export type PlanKey = keyof typeof PLANS;

export async function loader({ request }: LoaderFunctionArgs) {
    try {
        const { session } = await authenticate.admin(request);
        const shopDomain = session.shop;

        const active = await prisma.activeSubscription.findUnique({
            where: { shopDomain },
            select: {
                plan: true,
                subscriptionId: true,
            },
        });

        // Default to FREE if no active subscription
        const currentPlan = active?.plan ?? "FREE";

        return {
            currentPlan,
            subscriptionId: active?.subscriptionId ?? null,
        };
    } catch (error) {
        console.error("Error in billing subscribe loader:", error);
        if (error instanceof Response) {
            throw error;
        }
        throw new Response("Internal Server Error", { status: 500 });
    }
}

export async function action({ request }: ActionFunctionArgs) {
    try {
        const { admin, session } = await authenticate.admin(request);
        const shop = session.shop;

        const url = new URL(request.url);
        const formData = await request.formData();
        const actionType = formData.get("actionType") || "SUBSCRIBE";

        if (actionType === "CANCEL") {
            // 1. Check active subscriptions from Shopify first to cancel the correct one
            const checkResponse = await admin.graphql(GET_RECURRING_APPLICATION_CHARGES);
            const checkData = await checkResponse.json();
            const activeSubscriptions = checkData.data?.currentAppInstallation?.activeSubscriptions || [];
            const activeSubscription = activeSubscriptions.find((sub: any) => sub.status === "ACTIVE" || sub.status === "ACCEPTED");

            if (activeSubscription) {
                const cancelResponse = await admin.graphql(
                    CANCEL_SUBSCRIPTION,
                    {
                        variables: {
                            id: activeSubscription.id,
                            prorate: true,
                        },
                    }
                );
                const cancelData = await cancelResponse.json();
                const cancelResult = cancelData.data?.appSubscriptionCancel;
                if (cancelResult?.userErrors?.length) {
                    throw new Response(
                        cancelResult.userErrors.map((e: any) => e.message).join(", "),
                        { status: 400 }
                    );
                }
            }

            // Remove shop from ActiveSubscription if present
            await prisma.activeSubscription.deleteMany({
                where: { shopDomain: shop }
            });

            // Remove shop from BasicPlanLimits if present
            await prisma.basicPlanLimits.deleteMany({
                where: { shopDomain: shop }
            });

            return { success: true };
        } else {
            // ActionType is SUBSCRIBE
            let host = url.searchParams.get("host") || "";
            if (!host) {
                const hostUrl = `${shop}/admin`;
                host = Buffer.from(hostUrl).toString("base64");
            }

            const planKey = formData.get("plan") as PlanKey;
            const plan = PLANS[planKey];
            if (!plan) {
                throw new Response("Invalid plan", { status: 400 });
            }

            // Check active subscriptions from Shopify first to cancel any previous plan
            const checkResponse = await admin.graphql(GET_RECURRING_APPLICATION_CHARGES);

            const checkData = await checkResponse.json();
            const activeSubscriptions = checkData.data?.currentAppInstallation?.activeSubscriptions || [];
            const activeSubscription = activeSubscriptions.find((sub: any) => sub.status === "ACTIVE" || sub.status === "ACCEPTED");

            // Cancel previous plan on Shopify first if it's a different plan
            if (activeSubscription && activeSubscription.name.toUpperCase() !== planKey) {
                const cancelResponse = await admin.graphql(
                    CANCEL_SUBSCRIPTION,
                    {
                        variables: {
                            id: activeSubscription.id,
                            prorate: true,
                        },
                    }
                );
                const cancelData = await cancelResponse.json();
                const cancelResult = cancelData.data?.appSubscriptionCancel;
                if (cancelResult?.userErrors?.length) {
                    throw new Response(
                        cancelResult.userErrors.map((e: any) => e.message).join(", "),
                        { status: 400 }
                    );
                }

            }

            const returnUrl =
                `${process.env.SHOPIFY_APP_URL}/app` +
                `?shop=${shop}&host=${encodeURIComponent(host)}`;

            const graphqlResponse = await admin.graphql(
                CREATE_SUBSCRIPTION,
                {
                    variables: {
                        name: plan.name,
                        returnUrl,
                        test: process.env.SUBSCRIPTION === "true",
                        amount: plan.price,
                        currency: "USD",
                    },
                }
            );

            const data = await graphqlResponse.json();
            const result = data.data?.appSubscriptionCreate;

            if (!result) {
                throw new Response("Billing error", { status: 500 });
            }

            if (result.userErrors?.length) {
                throw new Response(
                    result.userErrors.map((e: any) => e.message).join(", "),
                    { status: 400 }
                );
            }

            return { confirmationUrl: result.confirmationUrl };

        }

    } catch (error) {
        console.error("Error in billing subscribe action:", error);
        if (error instanceof Response) {
            throw error;
        }
        throw new Response("Internal Server Error", { status: 500 });
    }
}

export default function BillingPage() {
    const { currentPlan } = useLoaderData<typeof loader>();
    const fetcher = useFetcher<typeof action>();
    const navigate = useNavigate();

    // Cancellation Modal States
    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [cancelSuccess, setCancelSuccess] = useState(false);
    const cancelLoading = fetcher.state === "submitting" && fetcher.formData?.get("actionType") === "CANCEL";

    // Subscription Confirmation Modal States
    const [subscribeModalOpen, setSubscribeModalOpen] = useState(false);
    const [pendingPlan, setPendingPlan] = useState<PlanKey | null>(null);

    const handleSubscribeClick = (plan: PlanKey) => {
        setPendingPlan(plan);
        setSubscribeModalOpen(true);
    };

    const handleSubscribeConfirm = () => {
        if (pendingPlan) {
            fetcher.submit(
                { plan: pendingPlan, actionType: "SUBSCRIBE" },
                {
                    method: "post",
                    action: "/app/billing/subscribe",
                }
            );
        }
        setSubscribeModalOpen(false);
    };

    const handleCancelConfirm = () => {
        fetcher.submit(
            { actionType: "CANCEL" },
            {
                method: "post",
                action: "/app/billing/subscribe",
            }
        );
    };

    useEffect(() => {
        if (fetcher.data) {
            if ("confirmationUrl" in fetcher.data) {
                const url = (fetcher.data as { confirmationUrl: string }).confirmationUrl;
                if (window.top) {
                    window.top.location.href = url;
                }
            } else if ("success" in fetcher.data && fetcher.data.success) {
                setCancelSuccess(true);
            }
        }
    }, [fetcher.data]);

    return (
        <Page>
            <div className="flex flex-col space-y-0.5 mb-5 rounded-sm">
                {/* Header Row */}
                <div className="flex items-center space-x-2">
                    {/* Home Icon Button */}
                    <button
                        onClick={() => navigate("/app")}
                        className="flex items-center cursor-pointer justify-center text-[#303030] hover:opacity-70 transition-opacity focus:outline-none"
                        aria-label="Go to Home"
                    >
                        <Icon source={HomeIcon} />
                    </button>

                    {/* Vertical Divider */}
                    <span
                        className="h-5 w-px bg-[#D2D2D2]"
                        aria-hidden="true"
                    />

                    {/* Title */}
                    <div className="text-xl font-bold leading-tight">
                        Subscription Plans
                    </div>
                </div>

                {/* Subtitle - Aligned to start under the Title text */}
                <Text as="p" variant="bodySm" tone="subdued">
                    Choose the best plan for your shop's growth.
                </Text>
            </div>
            <Layout>
                <Layout.Section>
                    <Grid>
                        {/* ================= FREE PLAN ================= */}
                        <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 4, lg: 4, xl: 4 }}>
                            <div style={{
                                height: "100%",
                                display: "flex",
                                flexDirection: "column"
                            }}>
                                <Card>
                                    <BlockStack gap="400">
                                        <BlockStack gap="200">
                                            <InlineStack align="space-between" gap="200">
                                                <Text as="h2" variant="headingLg">Starting 7 Days Free Plan</Text>
                                                {currentPlan === "FREE" && <Badge tone="success">Active</Badge>}
                                            </InlineStack>
                                        </BlockStack>

                                        <Divider />

                                        <BlockStack gap="200">
                                            <BlockStack gap="150">
                                                <FeatureItem text="2 Global Tag Removal Actions" detail="50 items/run, max 2 tags" />
                                                <FeatureItem text="2 Global Metafield Removal Actions" detail="100 items/run" />
                                                <FeatureItem text="200 CSV Entries" />
                                                <FeatureItem text="Standard Support" />
                                            </BlockStack>
                                        </BlockStack>

                                        <Divider />

                                        <Box paddingTop="100">
                                            <Text as="p" variant="bodyXs" tone="subdued">
                                                Upgrade to a premium plan after your starting 7-day trial or once free limits are reached.
                                            </Text>
                                        </Box>
                                    </BlockStack>
                                </Card>
                            </div>
                        </Grid.Cell>

                        {/* ================= BASIC PLAN ================= */}
                        <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 4, lg: 4, xl: 4 }}>
                            <div style={{
                                height: "100%",
                                display: "flex",
                                flexDirection: "column"
                            }}>
                                <Card>
                                    <BlockStack gap="400">
                                        <BlockStack gap="200">
                                            <InlineStack align="space-between" gap="200">
                                                <Text as="h2" variant="headingLg">Basic</Text>
                                                {currentPlan === "BASIC" && <Badge tone="success">Active</Badge>}
                                            </InlineStack>
                                            <Text as="p" variant="bodyLg" fontWeight="bold">$5 <Text as="span" variant="bodySm" tone="subdued">/ month</Text></Text>
                                        </BlockStack>

                                        <Divider />

                                        <BlockStack gap="200">
                                            <Text as="p" variant="bodyMd" fontWeight="medium">Monthly Limits:</Text>
                                            <BlockStack gap="150">
                                                <FeatureItem
                                                    text="20 Global Tag Removal Actions"
                                                    detail="100 items/run action, max 10 tags"
                                                />

                                                <FeatureItem
                                                    text="20 Global Metafield Removal Actions"
                                                    detail="250 items/run action"
                                                />

                                                <FeatureItem
                                                    text="3,000 CSV Entries"
                                                />
                                                <FeatureItem text="Standard Support" />
                                            </BlockStack>
                                        </BlockStack>

                                        <Box paddingTop="400">
                                            {currentPlan === "BASIC" ? (
                                                <BlockStack gap="200">
                                                    <Button
                                                        variant="secondary"
                                                        fullWidth
                                                        disabled
                                                    >
                                                        Current Plan
                                                    </Button>
                                                    <Box paddingTop="100">
                                                        <button
                                                            onClick={() => setCancelModalOpen(true)}
                                                            style={{
                                                                background: "none",
                                                                border: "none",
                                                                color: "#d91e18",
                                                                cursor: "pointer",
                                                                textDecoration: "underline",
                                                                width: "100%",
                                                                textAlign: "center",
                                                                padding: "8px 0",
                                                                fontSize: "14px",
                                                                fontWeight: "500"
                                                            }}
                                                        >
                                                            Cancel subscription
                                                        </button>
                                                    </Box>
                                                </BlockStack>
                                            ) : (
                                                <Button
                                                    variant={currentPlan === "BASIC" ? "secondary" : "primary"}
                                                    fullWidth
                                                    disabled={currentPlan === "BASIC"}
                                                    onClick={() => handleSubscribeClick("BASIC")}
                                                    loading={fetcher.state === "submitting" && fetcher.formData?.get("plan") === "BASIC"}
                                                >
                                                    {currentPlan === "BASIC" ? "Current Plan" : currentPlan === "ADVANCED" ? "Downgrade to Basic" : "Upgrade to Basic"}
                                                </Button>
                                            )}
                                        </Box>
                                    </BlockStack>
                                </Card>
                            </div>
                        </Grid.Cell>

                        {/* ================= ADVANCED PLAN ================= */}
                        <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 4, lg: 4, xl: 4 }}>
                            {/* Highlighted Card for the Recommended Plan */}
                            <div style={{
                                background: "linear-gradient(135deg, #dfdb15ff 0%, #06a36fff 100%)",
                                padding: "3px",
                                borderRadius: "16px",
                                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.25)",
                                height: "100%",
                                display: "flex",
                                flexDirection: "column"
                            }}>
                                <div style={{
                                    background: "#6b7691ff", // Deep slate background
                                    color: "#ffffff",
                                    padding: "20px",
                                    borderRadius: "13px",
                                    height: "100%",
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "space-between"
                                }}>
                                    <BlockStack gap="400">
                                        <BlockStack gap="200">
                                            <InlineStack align="space-between" gap="200">
                                                <h2 style={{ fontSize: "20px", fontWeight: "600", color: "#ffffff", margin: 0 }}>Advanced</h2>
                                                <InlineStack gap="100">
                                                    {currentPlan === "ADVANCED" && <Badge tone="success">Active</Badge>}
                                                    <Badge tone="attention">Best Value</Badge>
                                                </InlineStack>
                                            </InlineStack>
                                            <p style={{ fontSize: "24px", fontWeight: "700", color: "#ffffff", margin: 0 }}>$10 <span style={{ fontSize: "14px", fontWeight: "normal", color: "#94a3b8" }}>/ month</span></p>
                                        </BlockStack>

                                        <div style={{ height: "1px", backgroundColor: "rgba(255, 255, 255, 0.12)", margin: "8px 0" }} />

                                        <BlockStack gap="200">
                                            <p style={{ fontSize: "14px", fontWeight: "500", color: "#90f590", margin: 0 }}>Everything Unlimited:</p>
                                            <BlockStack gap="150">
                                                <DarkFeatureItem text="Unlimited Tag Removal" detail="5,000 items/run, max 20 tags" />
                                                <DarkFeatureItem text="Unlimited Metafield Removal" detail="5,000 items/run" />
                                                <DarkFeatureItem text="Unlimited CSV Operations" detail="5,000 entries/run" />
                                                <DarkFeatureItem text="Priority Support" />
                                            </BlockStack>
                                        </BlockStack>

                                        <Box paddingTop="400">
                                            {currentPlan === "ADVANCED" ? (
                                                <BlockStack gap="200">
                                                    <Button
                                                        variant="secondary"
                                                        fullWidth
                                                        disabled
                                                    >
                                                        Current Plan
                                                    </Button>
                                                    <Box paddingTop="100">
                                                        <button
                                                            onClick={() => setCancelModalOpen(true)}
                                                            style={{
                                                                background: "none",
                                                                border: "none",
                                                                color: "#141313ff",
                                                                cursor: "pointer",
                                                                textDecoration: "underline",
                                                                width: "100%",
                                                                textAlign: "center",
                                                                padding: "8px 0",
                                                                fontSize: "14px",
                                                                fontWeight: "500"
                                                            }}
                                                        >
                                                            Cancel subscription
                                                        </button>
                                                    </Box>
                                                </BlockStack>
                                            ) : (
                                                <Button
                                                    variant={currentPlan === "ADVANCED" ? "secondary" : "primary"}
                                                    fullWidth
                                                    disabled={currentPlan === "ADVANCED"}
                                                    onClick={() => handleSubscribeClick("ADVANCED")}
                                                    loading={fetcher.state === "submitting" && fetcher.formData?.get("plan") === "ADVANCED"}
                                                >
                                                    {currentPlan === "ADVANCED" ? "Current Plan" : "Upgrade to Advanced"}
                                                </Button>
                                            )}
                                        </Box>
                                    </BlockStack>
                                </div>
                            </div>
                        </Grid.Cell>
                    </Grid>
                </Layout.Section>
            </Layout>

            {/* Cancel/Downgrade Confirmation Modal */}
            <Modal
                open={cancelModalOpen}
                onClose={() => {
                    if (!cancelLoading) {
                        setCancelModalOpen(false);
                        setCancelSuccess(false);
                    }
                }}
                title={cancelSuccess ? "Subscription Cancelled" : "Cancel subscription and downgrade?"}
                primaryAction={cancelSuccess ? {
                    content: 'Close',
                    onAction: () => {
                        setCancelModalOpen(false);
                        setCancelSuccess(false);
                    }
                } : {
                    content: 'Yes, Cancel Subscription',
                    onAction: handleCancelConfirm,
                    loading: cancelLoading,
                    destructive: true,
                }}
                secondaryActions={cancelSuccess ? undefined : [
                    {
                        content: currentPlan === "ADVANCED" ? 'No, Keep Advance Plan' : 'No, Keep Basic Plan',
                        onAction: () => setCancelModalOpen(false),
                        disabled: cancelLoading,
                    },
                ]}
            >
                <Modal.Section>
                    {cancelSuccess ? (
                        <BlockStack gap="400">
                            <Banner tone="success">
                                <Text as="p" variant="bodyMd" fontWeight="semibold">
                                    Your subscription has been cancelled. You are now on the FREE plan.
                                </Text>
                            </Banner>
                        </BlockStack>
                    ) : (
                        <BlockStack gap="400">
                            <Text as="p" tone="critical" fontWeight="semibold">
                                Are you sure you want to cancel your subscription and downgrade to the FREE plan?
                            </Text>
                            <BlockStack gap="200">
                                <Text as="p" variant="bodyMd" fontWeight="medium">
                                    Please review the following details before proceeding:
                                </Text>
                                <List type="bullet">
                                    <List.Item>
                                        You’ll immediately lose access to all {currentPlan === "ADVANCED" ? "ADVANCED" : "BASIC"} features provided by this app.
                                    </List.Item>
                                    <List.Item>
                                        Shopify will stop future charges for this subscription. Any billing adjustments (such as credits or refunds) are handled automatically by Shopify’s billing system.
                                    </List.Item>
                                    <List.Item>
                                        You can upgrade again at any time by re-activating the paid plan in this app.
                                    </List.Item>
                                    <List.Item>
                                        Your existing data and settings will remain in your account, but paid features will be disabled.
                                    </List.Item>
                                </List>
                            </BlockStack>
                        </BlockStack>
                    )}
                </Modal.Section>
            </Modal>

            {/* Subscribe Confirmation Modal */}
            <Modal
                open={subscribeModalOpen}
                onClose={() => setSubscribeModalOpen(false)}
                title={`Subscribe to ${pendingPlan ? PLANS[pendingPlan].name : ""} Plan?`}
                primaryAction={{
                    content: "Confirm and Upgrade",
                    onAction: handleSubscribeConfirm,
                    loading: fetcher.state === "submitting" && fetcher.formData?.get("actionType") === "SUBSCRIBE"
                }}
                secondaryActions={[
                    {
                        content: "Cancel",
                        onAction: () => setSubscribeModalOpen(false)
                    }
                ]}
            >
                <Modal.Section>
                    <BlockStack gap="400">
                        <Text as="p">
                            Are you sure you want to subscribe to the <strong>{pendingPlan ? PLANS[pendingPlan].name : ""} Plan</strong> for <strong>${pendingPlan ? PLANS[pendingPlan].price : ""}/month</strong>?                        </Text>
                        {currentPlan !== "FREE" && (
                            <BlockStack gap="300">
                                <Banner tone="warning">
                                    <Text as="p">
                                        You are currently subscribed to the <strong>{currentPlan}</strong> plan. Continuing will automatically switch your subscription to the <strong>{pendingPlan ? PLANS[pendingPlan].name : ""}</strong> plan.
                                    </Text>
                                </Banner>

                                <List type="bullet">
                                    <List.Item>
                                        Shopify will automatically handle any applicable billing adjustments.
                                    </List.Item>
                                    <List.Item>
                                        Your existing data and settings will remain unchanged.
                                    </List.Item>
                                </List>
                            </BlockStack>
                        )}
                        <Text as="p" variant="bodyMd">
                            You will be redirected to Shopify's secure billing page to approve this charge.
                        </Text>
                    </BlockStack>
                </Modal.Section>
            </Modal>
        </Page>
    );
}

function FeatureItem({ text, detail }: { text: string; detail?: string }) {
    return (
        <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
            <span style={{ color: "#10b981", fontWeight: "bold", fontSize: "14px", lineHeight: "20px" }}>✓</span>
            <div style={{ display: "flex", flexDirection: "column" }}>
                <Text as="span" variant="bodyMd" fontWeight="medium">{text}</Text>
                {detail && (
                    <Text as="span" variant="bodySm" tone="subdued">
                        {detail}
                    </Text>
                )}
            </div>
        </div>
    );
}

function DarkFeatureItem({ text, detail }: { text: string; detail?: string }) {
    return (
        <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
            <span style={{ color: "#10b981", fontWeight: "bold", fontSize: "14px", lineHeight: "20px" }}>✓</span>
            <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ color: "#f1f5f9", fontSize: "14px", fontWeight: "500" }}>{text}</span>
                {detail && (
                    <span style={{ color: "#101011ff", fontSize: "12px" }}>
                        {detail}
                    </span>
                )}
            </div>
        </div>
    );
}

export function ErrorBoundary() {
    return <RouteErrorBoundary routeName="Billing Page" />;
}
