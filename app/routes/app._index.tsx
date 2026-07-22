import { useNavigate, useFetcher, useOutletContext, useBlocker } from "react-router";
import { useState, useEffect, type ReactNode } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { Recent, type Log } from "app/component/HistoryForm";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineGrid,
  Banner,
  Icon,
  Button,
  Box,
  Modal,
  InlineStack,
  ProgressBar,
  Badge,
} from "@shopify/polaris";
import {
  DiscountIcon,
  DeleteIcon,
  DatabaseIcon,
  QuestionCircleIcon,
  ClockIcon,
  CreditCardIcon,
} from "@shopify/polaris-icons";
import { RouteErrorBoundary } from "../component/RouteErrorBoundary";

type AppOutletContext = {
  planData: any;
};


export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

interface ModalState {
  isOpen?: boolean;
  title?: string;
  message?: ReactNode;
  logToRestore?: Log | null;
}

export default function HomePage() {
  const navigate = useNavigate();
  const fetcher = useFetcher<any>();
  const subscriptionFetcher = useFetcher<any>();
  const { planData } = useOutletContext<AppOutletContext>();
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [restoreTotal, setRestoreTotal] = useState(0);
  const [restoreCompleted, setRestoreCompleted] = useState(0);
  const [globalId, setGlobalId] = useState<string | null>(null);
  const [restore, setRestore] = useState(true);
  const [logs, setLogs] = useState<Log[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    title: "",
    message: "",
    logToRestore: null,
  });
  const [active, setActive] = useState(false);

  useBlocker(({ currentLocation, nextLocation }) => {
    return isRestoring && currentLocation.pathname !== nextLocation.pathname;
  });

  const handleClose = () => {
    setActive(false);
    subscriptionFetcher.load("/api/closePopup/subscription");
  };

  useEffect(() => {
    subscriptionFetcher.load("/api/checkPopup/subscription");
  }, []);

  useEffect(() => {
    if (
      subscriptionFetcher.state === "idle" &&
      subscriptionFetcher.data &&
      (subscriptionFetcher.data as any).showPopup
    ) {
      setActive(true);
    }
  }, [subscriptionFetcher.state, subscriptionFetcher.data]);

  let remainingDays = planData?.remainingDays;

  // Prevent reload/close while running
  useEffect(() => {
    if (!isRestoring) return;

    // 1. Block reload / tab close
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    // 2. Block back / forward navigation
    const blockNavigation = () => {
      window.history.pushState(null, "", window.location.href);
    };

    // Push a state so back button has nowhere to go
    window.history.pushState(null, "", window.location.href);

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", blockNavigation);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", blockNavigation);
    };
  }, [isRestoring]);

  //  Run fetch only when restore is triggered manually
  useEffect(() => {
    if (!restore) return;

    const run = async () => {
      try {
        // 1️⃣ Always call timeout API first
        await fetch("/api/timeout/db", { method: "POST" });

        // 2️⃣ Call check API only after timeout succeeds (limit to 4 for home page)
        const url = "/api/check/db?limit=4";
        fetcher.load(url);
      } catch (error) {
        console.error("Restore flow failed:", error);
      }
    };

    run();
  }, [restore]);

  useEffect(() => {
    const runRestore = async () => {
      const shouldRunRestore = restoreCompleted >= restoreTotal && isRestoring;
      if (!shouldRunRestore) return;

      const formData = new FormData();
      formData.append("rowId", globalId || "");

      const response = await fetch("/api/update-restore/db", {
        method: "POST",
        body: formData,
      });

      let res;
      try {
        res = await response.json();
      } catch (err) {
        res = { success: false };
      }

      if (res?.success) {
        setRestore(true); // triggers fetcher.load
      }
    };

    runRestore();
  }, [restoreCompleted, restoreTotal]);

  // Handle fetch results safely
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    setRestore(false);
    setLogs(fetcher?.data?.database || []);
    setIsLoading(false);
    setModalState((prev) => ({ ...prev, isOpen: false }));
    setIsSubmitting(false);
  }, [fetcher.state, fetcher.data]);

  //  User clicks restore
  const handleRestoreClick = (log: Log) => {
    let message = "Are you sure you want to restore the removed data?";
    if (log.operation === "Tags-removed") {
      message = "Are you sure you want to restore the removed tags?";
    } else if (log.operation === "Tags-Added") {
      message = "Are you sure you want to remove the added tags?";
    } else if (log.operation === "Metafield-removed") {
      message = "Are you sure you want to restore the removed metafields?";
    } else if (log.operation === "Metafield-updated") {
      message = "Are you sure you want to revert the metafield updates?";
    }

    setModalState({
      isOpen: true,
      title: "Confirm Restore",
      message,
      logToRestore: log,
    });
    setGlobalId(log.id);
  };

  //  Confirm restore or create DB
  const handleConfirmAction = async () => {
    setIsSubmitting(true);
    const log = modalState.logToRestore;
    if (!log) {
      setIsSubmitting(false);
      setModalState({ ...modalState, isOpen: false });
      return;
    }

    const operation = log.operation;
    const objectType = log.objectType;
    const rows =
      operation === "Tags-removed"
        ? log.value.filter((v) => v.removedTags?.length > 0)
        : log.value || [];

    if (!rows.length) {
      setIsSubmitting(false);
      return;
    }

    setRestoreCompleted(0);
    setRestoreTotal(rows.length);
    setIsRestoring(true);
    setIsSubmitting(false);

    for (let i = 0; i < rows.length; i++) {
      const v = rows[i];
      let payload: any = { id: v.id, objectType, operation };

      if (operation === "Tags-removed") {
        payload.tags = v.removedTags;
      } else if (operation === "Tags-Added") {
        payload.tags = v.tagList
          ? v.tagList.split(",").map((t: string) => t.trim())
          : [];
      } else if (operation === "Metafield-removed") {
        payload.namespace = v.namespace || v.data?.namespace;
        payload.key = v.key || v.data?.key;
        payload.type = v.type || v.data?.type;
        payload.value = v.value || v.data?.value;
      } else if (operation === "Metafield-updated") {
        payload.namespace = v.namespace || v.data?.namespace;
        payload.key = v.key || v.data?.key;
        payload.type = v.type || v.data?.type;
        payload.value = v.value || v.data?.value;
      }
      const formData = new FormData();
      formData.append("rows", JSON.stringify([payload]));

      const res = await fetch("/api/revert/db", {
        method: "POST",
        body: formData,
      }).then((r) => r.json()).catch(() => ({ success: false }));

      if (res.success) {
        setRestoreCompleted((prev) => prev + 1);
      }
    }
  };

  // ---- MODULES ----
  const modules = [
    {
      title: "Add Tags",
      desc:
        "Quickly append multiple tags to products, customers, blogposts, or orders using a simple CSV identifier list.",
      route: "/app/add-tags",
      icon: DiscountIcon,
      action: "Add Tags",
      tone: "success",
    },
    {
      title: "Remove Tags",
      desc:
        "Search for tags by condition and remove them from your entire store or specific items via CSV upload.",
      route: "/app/remove-tags",
      icon: DeleteIcon,
      action: "Remove Tags",
      tone: "critical",
    },
    {
      title: "Metafield Manager",
      desc:
        "Manage metafield definitions and values. Clear data globally or perform bulk updates using CSV files.",
      route: "/app/metafield-manage",
      icon: DatabaseIcon,
      action: "Manage Metafields",
      tone: "highlight",
    },
  ];

  return (
    <Page
      title="MetaForge Manager"
      subtitle="The all-in-one toolkit for bulk store data manipulation."
      secondaryActions={[
        {
          content: "History",
          icon: ClockIcon,
          onAction: () => navigate("/app/history"),
        },
        {
          content: "FAQ",
          icon: QuestionCircleIcon,
          onAction: () => navigate("/app/faq"),
        },
      ]}
    >

      <BlockStack gap="300">
        {/* Modal for updates */}
        <Modal
          open={active}
          onClose={handleClose}
          title=""
          primaryAction={{
            content: "Close",
            onAction: handleClose,
          }}
        >
          <Modal.Section>
            <BlockStack gap="300" inlineAlign="center">
              {/* Celebration Emoji */}
              <Text as="span" variant="heading2xl" alignment="center">
                🎉
              </Text>

              <Text variant="headingMd" as="h2" alignment="center">
                Plan Upgraded
              </Text>

              <Text variant="bodyMd" tone="subdued" alignment="center" as="p">
                Your subscription has been successfully updated.
              </Text>
            </BlockStack>
          </Modal.Section>
        </Modal>

        {/* HIGH VISIBILITY SUBSCRIPTION SECTION */}
        <Card padding="400">
          <InlineStack align="space-between" blockAlign="center">
            {/* Left: Plan Info */}
            <BlockStack gap="100">
              <InlineStack gap="200" align="start" blockAlign="center">
                <Text variant="headingMd" as="h2">
                  Current Subscription
                </Text>
                <Badge tone="attention">{planData?.plan}</Badge>
              </InlineStack>
              <Text tone="subdued" as="p">
                Your plan controls how many actions you can perform.
              </Text>
            </BlockStack>

            {/* Right: Icon + Time and Button */}
            <InlineStack gap="600" blockAlign="center">
              {remainingDays !== undefined && (
                <Box
                  paddingInlineEnd="400"
                  borderInlineEndWidth={
                    planData?.plan !== "ADVANCED" ? "025" : "0"
                  }
                  borderColor="border-secondary"
                >
                  <InlineStack gap="300" blockAlign="center">
                    <Box
                      padding="200"
                      background={
                        remainingDays <= 5
                          ? "bg-surface-critical"
                          : "bg-surface-secondary"
                      }
                      borderRadius="200"
                    >
                      <Icon
                        source={ClockIcon}
                        tone={remainingDays <= 5 ? "critical" : "base"}
                      />
                    </Box>
                    <BlockStack gap="100">
                      {remainingDays === 0 ? (
                        <>
                          <Text
                            variant="headingSm"
                            as="p"
                            fontWeight="bold"
                            tone="critical"
                          >
                            Plan Expired
                          </Text>
                          <Text
                            variant="bodyXs"
                            tone="critical"
                            fontWeight="bold"
                            as={"dd"}
                          >
                            UPGRADE NOW TO USE
                          </Text>
                        </>
                      ) : (
                        <>
                          <Text
                            variant="headingLg"
                            as="p"
                            fontWeight="bold"
                            tone={remainingDays <= 5 ? "critical" : undefined}
                          >
                            {remainingDays} {remainingDays === 1 ? "Day" : "Days"}
                          </Text>
                          <Text
                            variant="bodyXs"
                            tone="subdued"
                            fontWeight="medium"
                            as={"dd"}
                          >
                            REMAINING
                          </Text>
                        </>
                      )}
                    </BlockStack>
                  </InlineStack>
                </Box>
              )}
              {planData?.plan !== "ADVANCED" && (
                <Button
                  variant="primary"
                  icon={CreditCardIcon}
                  onClick={() => navigate("/app/billing/subscribe")}
                >
                  Manage Subscription
                </Button>
              )}
            </InlineStack>
          </InlineStack>
        </Card>

        {/* MODULE GRID */}
        <Layout>

          <Layout.Section>
            <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
              {modules.map((module, index) => (
                <Card key={index} roundedAbove="sm">
                  <BlockStack gap="400">
                    <Box
                      background="bg-surface-secondary"
                      padding="300"
                      borderRadius="200"
                      width="40px"
                    >
                      <Icon source={module.icon} tone={module.tone as any} />
                    </Box>

                    <BlockStack gap="200">
                      <Text as="h2" variant="headingMd">
                        {module.title}
                      </Text>
                      <Box minHeight="64px">
                        <Text as="p" variant="bodyMd" tone="subdued">
                          {module.desc}
                        </Text>
                      </Box>
                    </BlockStack>

                    <Button
                      fullWidth
                      variant="primary"
                      onClick={() => navigate(module.route)}
                    >
                      {module.action}
                    </Button>
                  </BlockStack>
                </Card>
              ))}
            </InlineGrid>
          </Layout.Section>

          <Layout.Section>
            <Banner
              title="Export your store data"
              tone="info"
              action={{
                content: "Export Data",
                onAction: () => navigate("/app/export-data"),
              }}
            >
              <p>
                Export your store data as CSV to review and prepare changes
                before running any operation.
              </p>
            </Banner>
          </Layout.Section>



          {/* RECENT ACTIVITY SECTION */}

          {logs.length > 0 && (
            <Layout.Section>
              <BlockStack gap="200">
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="200" blockAlign="center">
                    <Box
                      background="bg-surface-info"
                      padding="200"
                      borderRadius="200"
                    >
                      <Icon source={ClockIcon} tone="info" />
                    </Box>
                    <BlockStack gap="050">
                      <Text as="h2" variant="headingMd">
                        Recent Activity
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Check what you did recently.
                      </Text>
                    </BlockStack>
                  </InlineStack>

                </InlineStack>

                <Recent
                  logs={logs}
                  openRow={openRow}
                  setOpenRow={setOpenRow}
                  handleRestore={handleRestoreClick}
                  isLoading={isLoading}
                />
              </BlockStack>
            </Layout.Section>
          )}


        </Layout>
      </BlockStack>

      <Modal
        open={modalState.isOpen || isRestoring}
        onClose={() => {
          if (isRestoring && restoreCompleted < restoreTotal) return;
          if (isRestoring && restoreCompleted >= restoreTotal) {
            setIsRestoring(false);
            setModalState({ ...modalState, isOpen: false });
            return;
          }
          setModalState({ ...modalState, isOpen: false });
        }}
        title={
          isRestoring
            ? restoreCompleted < restoreTotal
              ? "Restoring Data..."
              : "Restore Complete"
            : modalState.title || "Confirm Action"
        }
        primaryAction={
          isRestoring
            ? restoreCompleted >= restoreTotal
              ? {
                content: "Done",
                onAction: () => {
                  setIsRestoring(false);
                  setModalState({ ...modalState, isOpen: false });
                },
              }
              : undefined
            : {
              content: "Restore",
              onAction: handleConfirmAction,
              destructive: true,
              loading: isSubmitting,
            }
        }
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Text as="p">{modalState.message}</Text>
            {isRestoring && (
              <BlockStack gap="200">
                <ProgressBar
                  progress={
                    restoreTotal > 0
                      ? (restoreCompleted / restoreTotal) * 100
                      : 0
                  }
                  tone="highlight"
                />
                <Text as="p" tone="subdued">
                  {restoreCompleted < restoreTotal
                    ? `Restoring item ${restoreCompleted} of ${restoreTotal}`
                    : `Successfully restored ${restoreTotal} items.`}
                </Text>
              </BlockStack>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>

    </Page >
  );
}

export function ErrorBoundary() {
  return <RouteErrorBoundary routeName="Home" />;
}


