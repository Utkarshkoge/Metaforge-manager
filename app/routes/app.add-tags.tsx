import { useState, useCallback, useEffect, useRef } from "react";
import { useFetcher, useNavigate, useOutletContext, useBlocker } from "react-router";
import Papa from "papaparse";
import { authenticate } from "../shopify.server";
import {
  Page,
  Layout,
  LegacyCard,
  FormLayout,
  Select,
  TextField,
  Button,
  Banner,
  BlockStack,
  DropZone,
  IndexTable,
  Text,
  Badge,
  InlineStack,
  ProgressBar,
  Modal,
  EmptyState,
  Tag,
  ChoiceList,
  Box,
  Spinner,
  Icon,
} from "@shopify/polaris";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { fetchResourceId } from "app/functions/remove-tag-action";
import CsvPreviewModal from "../component/CsvPreviewModal";
import { AddTagsInstructionsModal } from "../component/InstructionsModal";
import { validateShopifyId } from "../utils/shopifyIdValidator";
import { RouteErrorBoundary } from "../component/RouteErrorBoundary";

import { DatabaseIcon, ClockIcon, CreditCardIcon } from "@shopify/polaris-icons";


export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await authenticate.admin(request);
    // eslint-disable-next-line no-undef
    return { apiKey: process.env.SHOPIFY_API_KEY || "" };
  } catch (error) {
    throw new Response("Unauthorized or Server Error", { status: 500 });
  }
};

async function fetchAllTagsByResource(admin: any, id: string) {
  try {
    const query = `
      query getResourceTags($id: ID!) {
        node(id: $id) {
          __typename
          ... on Product { tags }
          ... on Customer { tags }
          ... on Order { tags }
          ... on Article { tags }
        }
      }
    `;

    const res = await admin.graphql(query, { variables: { id } });
    const json = await res.json();

    const node = json?.data?.node;
    if (!node) return null;

    return Array.isArray(node.tags) ? node.tags : [];
  } catch (error) {
    console.error("Failed to fetch tags for resource", id, error);
    return null;
  }
}


export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();

    const rowsRaw = formData.get("rows");
    const resourceType = formData.get("objectType") as string;
    const flagRaw = formData.get("flag");

    let rows = [];
    let flag = false;

    try {
      rows = JSON.parse((rowsRaw as string) || "[]");
      flag = JSON.parse((flagRaw as string) || "false");
    } catch (parseError) {
      return {
        success: false,
        error: "Invalid data format received.",
        results: [],
      };
    }

    const results = [];
    const mutation = `
      mutation tagOp($id: ID!, $tags: [String!]!) {
        tagsAdd(id: $id, tags: $tags) {
          userErrors { field message }
        }
      } 
    `;

    const normalizeTag = (tag: any) =>
      typeof tag === "string" ? tag.trim().toLowerCase() : tag;

    for (const row of rows) {
      let resourceId = row.id;

      if (!flag) {
        const fetchedId = await fetchResourceId(admin, resourceType, resourceId);
        if (!fetchedId) {
          results.push({
            id: row.id,
            success: false,
            errors: [{ message: `Failed to fetch ${resourceType} ID` }],
          });
          continue;
        }
        resourceId = fetchedId;
      } else {
        const validator = validateShopifyId(resourceId, resourceType);
        if (!validator.isValid) {
          results.push({
            id: row.id,
            success: false,
            errors: [{ message: validator.error }],
          });
          continue;
        }
      }

      const existingTags = await fetchAllTagsByResource(admin, resourceId);

      if (existingTags === null) {
        results.push({
          id: row.id,
          success: false,
          errors: [{ message: `Resource not found.\nNo ${resourceType} exists for this Shopify ID.\nPlease verify the Shopify ID and try again.` }],
        });
        continue;
      }

      const normalizedExisting = existingTags.map(normalizeTag);

      const alreadyPresent = row?.tags?.filter((tag: any) =>
        normalizedExisting.includes(normalizeTag(tag))
      );

      const missingTags = row?.tags?.filter((tag: any) =>
        !normalizedExisting.includes(normalizeTag(tag))
      );

      if (missingTags.length === 0) {
        results.push({
          id: row.id,
          success: false,
          errors: [{
            message: "All tags already exist",
            existingTags: alreadyPresent,
          }],
        });
        continue;
      }
      try {
        const res = await admin.graphql(mutation, {
          variables: {
            id: resourceId,
            tags: missingTags.map((t: any) => t.trim()),
          },
        });

        const parsed = await res.json();
        const errors = parsed?.data?.tagsAdd?.userErrors || [];

        results.push({
          id: row.id,
          success: errors.length === 0,
          errors: alreadyPresent.length
            ? [{
              message: "Some tags already existed",
              existingTags: alreadyPresent,
            }]
            : errors,
        });
      } catch (err: any) {
        results.push({
          id: row.id,
          success: false,
          errors: [{ message: err.message || "Unknown error" }],
        });
      }
    }

    return { results };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Something went wrong in tag add action.",
      results: [],
    };
  }
};

interface Result {
  id?: string;
  success?: boolean;
  errors?: { message: string }[];
  index?: number;
}


type AppOutletContext = {
  planData: any;
};

export default function SimpleTagManager() {
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const { planData } = useOutletContext<AppOutletContext>();

  const [objectType, setObjectType] = useState("product");
  const [csvData, setCsvData] = useState<{ id: string }[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [progress, setProgress] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [csvType, setCsvType] = useState("Id");
  const [specificField, setSpecificField] = useState("Id");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const lastProcessedRef = useRef<any>(null);
  const hasUpdatedLimitRef = useRef(false);

  useBlocker(({ currentLocation, nextLocation }) => {
    return isRunning && currentLocation.pathname !== nextLocation.pathname;
  });

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [rawCsvData, setRawCsvData] = useState<any[]>([]);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [alert, setAlert] = useState<{ active: boolean; title: string; message: string; tone?: 'critical' | 'success' }>({
    active: false,
    title: "",
    message: "",
  });
  const [warning, setWarning] = useState<{
    active: boolean;
    title: string;
    message: string;
    tone?: "success" | "warning";
  }>({
    active: false,
    title: "",
    message: "",
  });

  const isFinished = progress === 100 && !isRunning;

  let plan = planData?.plan || "FREE";
  let remainingDays = planData?.remainingDays;

  const updateTagLimit = (tagAddCsvCount: number, planData: any) => {
    fetcher.submit(
      {
        plan: planData?.plan,
        updates: {
          tagAddCsvLimit: planData?.limits?.tagAddCsvLimit - tagAddCsvCount,
        },
      },
      {
        method: "POST",
        encType: "application/json",
        action: "/api/update/plan",
      },
    );
  };



  // ---- STATE ----
  const [isDbCreated, setIsDbCreated] = useState(false);
  const [dbChecked, setDbChecked] = useState(false); // 👈 critical
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // ---- CHECK DB ON MOUNT ----
  useEffect(() => {
    fetcher.load("/api/check/db");
  }, []);


  // ---- CREATE DB ----
  const createDatabase = () => {
    setIsSubmitting(true);
    fetcher.submit(
      {},
      {
        method: "post",
        action: "/api/metaCreate/db",
      }
    );
  };

  // Effects
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (lastProcessedRef.current === fetcher.data) return;
    lastProcessedRef.current = fetcher.data;

    if (fetcher.data?.successdb === undefined) {

      if (!isRunning) return;
      // Only process when the fetcher is back to idle and has data
      const result = fetcher.data?.results?.[0];
      const processingIndex = currentIndex;
      const rowId = csvData[processingIndex]?.id;
      if (result.id !== rowId) return;
      setResults((prev) => {
        if (prev.length > processingIndex) return prev;
        return [{ ...result, index: processingIndex }, ...prev];
      });

      const nextIndex = processingIndex + 1;
      setProgress(Math.round((nextIndex / csvData.length) * 100));

      // Update current index for UI
      setCurrentIndex(nextIndex);

      if (nextIndex < csvData.length) {
        sendRow(nextIndex);
      } else {
        setIsRunning(false);
      }
    } else {
      const success = Boolean(fetcher.data?.successdb);
      if ((fetcher.data === undefined || success) && !isDbCreated) {
        setIsDbCreated(fetcher.data === undefined ? true : success);
      }

      if (!success && fetcher.data !== undefined && isDbCreated) {
        setIsDbCreated(false);
      }

      setDbChecked(true);

      if (isSubmitting && success) {
        setModalOpen(false);
        setIsSubmitting(false);
        setShowSuccess(true);
      }
    }

  }, [fetcher.state, fetcher.data, isRunning, results.length, csvData]);

  useEffect(() => {
    if (!isRunning) return;

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
  }, [isRunning]);

  useEffect(() => {
    // Reset state on object type change
    setCsvData([]);
    setRawCsvData([]);
    setResults([]);
    setProgress(0);
    setTags([]);
    setTagInput("");
    setSpecificField("Id");
    setFile(null);

    // Set default CSV type
    if (objectType === "product") setCsvType("Sku");
    if (objectType === "customer") setCsvType("Email");
    if (objectType === "order") setCsvType("Name");
    if (objectType === "blogPost") setCsvType("Handle");
  }, [objectType]);

  useEffect(() => {
    setCsvData([]);
    setRawCsvData([]);
    setFile(null);
    setAlert(prev => ({ ...prev, active: false }))
  }, [specificField, csvType]);

  useEffect(() => {
    if (!isRunning && progress === 100 && !hasUpdatedLimitRef.current) {
      const successResults = results.filter((r) => r.success === true);

      if (successResults.length > 0) {
        hasUpdatedLimitRef.current = true;
        const rows = successResults.map((r) => ({
          id: r.id ?? "",
          tagList: Array.isArray(tags) ? tags.join(", ") : "",
          success: true,
          error: "",
        }));

        const Data = {
          operation: "Tags-Added",  // only operation
          objectType,               // only objectType
          value: rows,              // only value
        };

        if (plan !== "ADVANCED") {
          updateTagLimit(rows.length, planData);
        }

        fetch("/api/add/db", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(Data),
        }).catch((err) => console.error("Logging error", err));
      }
    }
  }, [progress, isRunning, planData, plan, results, tags, objectType]);

  const handleCsvInput = useCallback((_dropFiles: File[], acceptedFiles: File[], _rejectedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res: any) => {
        const normalizedField = specificField.toLowerCase();

        // Strict column validation
        const headers = res.meta.fields?.map((h: string) => h.trim().toLowerCase()) || [];
        const expectedHeaders = [normalizedField];
        const extraHeaders = headers.filter((h: string) => !expectedHeaders.includes(h));

        if (extraHeaders.length > 0) {
          setAlert({
            active: true,
            title: "Invalid CSV Format",
            message: `The CSV contains extra columns: ${extraHeaders.join(', ')}. Only the '${specificField}' column is allowed.`,
            tone: 'critical'
          });
          return;
        }

        const rows = res.data
          .map((row: any) => {
            const normalizedRow = Object.keys(row).reduce((acc: any, key) => {
              acc[key.toLowerCase()] = row[key];
              return acc;
            }, {});

            const value = normalizedRow[normalizedField];
            const id = typeof value === "string" ? value.trim() : value;
            if (!id) return null;

            return { id };
          })
          .filter(Boolean);



        if (rows.length > 5000) {
          setAlert({
            active: true,
            title: "Limit Exceeded",
            message: "Only 5000 records will add at a time",
            tone: 'critical'
          })
          setWarning(prev => ({ ...prev, active: false }));
          return;
        }

        if (
          rows.length > planData?.limits?.tagAddCsvLimit &&
          plan !== "ADVANCED"
        ) {
          setWarning({
            active: true,
            title: "Limit Exceeded",
            message: `You only have ${planData?.limits?.tagAddCsvLimit} records remaining according to your plan. Please update your plan to add more.`,
            tone: "warning",
          });
          setAlert((prev) => ({ ...prev, active: false }));
          return;
        }

        if (rows.length === 0) {
          setAlert({
            active: true,
            title: "Valid Record Not Found",
            message: "No valid records found in the CSV file. Please follow the CSV Format",
            tone: 'critical'
          });
          setWarning(prev => ({ ...prev, active: false }));
          return;
        }

        setFile(file);
        setCsvData(rows as { id: string }[]);
        setRawCsvData(res.data);
        setProgress(0);
        setResults([]);
        setAlert(prev => ({ ...prev, active: false }))
        setWarning(prev => ({ ...prev, active: false }));
      },
    });
  }, [specificField, objectType, planData, plan]);

  const handleTagAdd = useCallback(() => {
    const trimmed = tagInput.trim();

    if (trimmed.length < 2) {
      setAlert({
        active: true,
        title: "Minimum Tag Length",
        message: "A tag must contain at least 2 characters.",
        tone: "critical",
      });
      setWarning(prev => ({ ...prev, active: false }));
      return;
    }

    // if (trimmed.length < 2) return;
    if (tags.includes(trimmed)) {
      setAlert({
        active: true,
        title: "Duplicate Tag",
        message: `The tag "${trimmed}" is already added.`,
        tone: "critical",
      });
      setWarning(prev => ({ ...prev, active: false }));
      return;
    }
    setTags((current) => [...current, trimmed]);
    setTagInput("");
    setAlert((prev) => ({ ...prev, active: false }));
    setWarning(prev => ({ ...prev, active: false }));
  }, [tagInput, tags, planData, plan]);

  const handleTagRemove = useCallback((tagToRemove: string) => {
    setTags((current) => current.filter((t) => t !== tagToRemove));
  }, []);

  const sendRow = (index: number) => {
    const row = csvData[index];
    if (!row) return;

    const fd = new FormData();
    fd.append("objectType", objectType === 'blogPost' ? 'article' : objectType);
    fd.append("flag", JSON.stringify(specificField === "Id"));
    fd.append("rows", JSON.stringify([{ id: row.id, tags }]));

    fetcher.submit(fd, { method: "POST" });
  };

  const handleRun = () => {
    setConfirmModalOpen(false);
    if (!csvData.length || !tags.length) return;
    setResults([]);
    setProgress(0);
    setCurrentIndex(0);
    hasUpdatedLimitRef.current = false;
    setIsRunning(true);
    sendRow(0);
  };

  const downloadResults = () => {
    if (!results.length) return;

    const header = [specificField, "Tags", "Success", "Error"].join(",") + "\n";

    const escapeCSV = (value: any) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = results.map((r) => {
      const id = r.id ?? "";

      // ✅ Prefer row-level tags if present, fallback to global tags
      const tagList =
        Array.isArray((r as any).tags)
          ? (r as any).tags.join(", ")
          : Array.isArray(tags)
            ? tags.join(", ")
            : "";

      const success = r.success ? "true" : "false";

      const error =
        Array.isArray(r.errors) && r.errors.length > 0
          ? Array.from(
            new Set(
              r.errors.map((e: any) => {
                if (Array.isArray(e.existingTags) && e.existingTags.length > 0) {
                  return `${e.message}: ${e.existingTags.join(", ")}`;
                }
                return e.message;
              })
            )
          ).join("; ")
          : "";

      return [
        escapeCSV(id),
        escapeCSV(tagList),
        escapeCSV(success),
        escapeCSV(error),
      ].join(",");
    });

    const csvContent = header + rows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `tag_manager_results-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadTemplate = () => {
    const header = specificField === "Id" ? "Id" : csvType;
    let sampleValues: string[] = [];
    if (header === "Id") sampleValues = [`gid://shopify/${objectType === 'blogPost' ? 'Article' : objectType.charAt(0).toUpperCase() + objectType.slice(1)}/123456789`];
    else if (header === "Sku") sampleValues = ["SKU-1"];
    else if (header === "Email") sampleValues = ["example@mail.com"];
    else if (header === "Name") sampleValues = ["#1001"];
    else if (header === "Handle") sampleValues = ["handle-1"];

    const csvContent = [header, ...sampleValues].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sample-${header}-template.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const resetAll = () => {
    setCsvData([]);
    setRawCsvData([]);
    setResults([]);
    setProgress(0);
    setTags([]);
    setTagInput("");
    setSpecificField("Id");
    setFile(null);
    setAlert(prev => ({ ...prev, active: false }));
    hasUpdatedLimitRef.current = false;
  }

  const resourceOptions = [
    { label: "Products", value: "product" },
    { label: "Customers", value: "customer" },
    { label: "Orders", value: "order" },
    { label: "Blog Posts", value: "blogPost" },
  ];

  const matchOptions = [
    { label: "Shopify GID", value: "Id" },
    { label: csvType, value: csvType },
  ];

  function goToHome() {
    if (!isRunning) navigate("/app");
  }
  return (
    <Page
      title="Add Tags"
      subtitle="Search for tags and add them from specific items."
      backAction={{ content: "Home", onAction: goToHome }}
      secondaryActions={[
        {
          content: "Instructions",
          onAction: () => setInstructionsOpen(true),
        },
      ]}
    >
      <BlockStack gap="200">
        <Box
          paddingBlock="300"
          paddingInline="400"
          background="bg-surface"
          borderRadius="200"
        >

          <InlineStack align="space-between" blockAlign="center">
            <InlineStack gap="500">
              {/* Current Plan */}
              <BlockStack gap="200">
                <Text
                  variant="bodyXs"
                  tone="subdued"
                  fontWeight="bold"
                  as={"dd"}
                >
                  CURRENT PLAN
                </Text>
                <Badge tone={plan === "ADVANCED" ? "success" : "info"}>
                  {plan}
                </Badge>
              </BlockStack>

              {plan !== "ADVANCED" ? (
                <>
                  {/* CSV Limit */}
                  <BlockStack gap="200">
                    <Text
                      variant="bodyXs"
                      tone="subdued"
                      fontWeight="bold"
                      as={"dd"}
                    >
                      CSV LIMIT
                    </Text>
                    <Text variant="bodyMd" fontWeight="bold" as={"dd"}>
                      {
                        plan === "ADVANCED"
                          ? "Unlimited"
                          : (plan === "BASIC" || plan === "FREE")
                            ? (planData?.limits?.tagAddCsvLimit === Infinity
                              ? ""
                              : planData?.limits?.tagAddCsvLimit)
                            : 0
                      }
                    </Text>
                  </BlockStack>
                </>
              ) : (
                /* Advanced Status */
                <BlockStack gap="200">
                  <Text
                    variant="bodyXs"
                    tone="subdued"
                    fontWeight="bold"
                    as={"dd"}
                  >
                    STATUS
                  </Text>
                  <Text
                    variant="bodyMd"
                    tone="success"
                    fontWeight="bold"
                    as={"dd"}
                  >
                    Unlimited Access Enabled
                  </Text>
                </BlockStack>
              )}
            </InlineStack>

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
                  Upgrade Plan
                </Button>
              )}
            </InlineStack>
          </InlineStack>
        </Box>

        {dbChecked && !isDbCreated && (
          <Box>

            <Banner
              tone="warning"
              icon={DatabaseIcon}
            >
              <InlineStack gap="300" align="space-between">
                To view activity history and use the one-time restore feature, you’ll need to create the database first.

                <Button
                  variant="secondary"
                  onClick={() => setModalOpen(true)}
                  disabled={isRunning || csvData.length > 0}
                >
                  Create Database
                </Button>
              </InlineStack>
            </Banner>
          </Box>
        )}

        <Layout>
          <Layout.Section variant="oneThird">
            <BlockStack gap="200">

              <LegacyCard title="Configuration" sectioned>
                <Select
                  label="Resource Type"
                  options={resourceOptions}
                  onChange={setObjectType}
                  value={objectType}
                  disabled={isRunning || csvData.length > 0}
                />
              </LegacyCard>

              <LegacyCard title="Add Tags" sectioned>
                <form onSubmit={(e) => { e.preventDefault(); handleTagAdd(); }}>
                  <FormLayout>
                    <TextField
                      label="Enter Tags"
                      value={tagInput}
                      onChange={setTagInput}
                      autoComplete="off"
                      placeholder="Enter tag (Min 2 chars)"
                      connectedRight={
                        <Button onClick={handleTagAdd} disabled={!tagInput.trim()}>Add</Button>
                      }
                      disabled={isRunning || csvData.length > 0}
                      helpText="Press enter or click Add"
                    />
                    {tags.length > 0 && (
                      <InlineStack gap="200" wrap>
                        {tags.map(tag => (
                          <div key={tag}>
                            <Tag onRemove={() => !isRunning && handleTagRemove(tag)} disabled={isRunning || csvData.length > 0}>
                              {tag}
                            </Tag>
                          </div>
                        ))}
                      </InlineStack>
                    )}
                    {tags.length > 0 && !isRunning && !isFinished && (
                      <Button variant="plain" tone="critical" onClick={resetAll}>Clear All Tags</Button>
                    )}
                  </FormLayout>
                </form>
              </LegacyCard>
            </BlockStack>
          </Layout.Section>

          <Layout.Section>
            <BlockStack gap="200">

              {alert.active && (
                <Banner
                  title={alert.title}
                  tone={alert.tone}
                  onDismiss={() => setAlert(prev => ({ ...prev, active: false }))}
                >
                  <p>{alert.message}</p>
                </Banner>
              )}

              {warning.active && (
                <Banner
                  title={warning.title}
                  tone={warning.tone}
                  onDismiss={() => setWarning(prev => ({ ...prev, active: false }))}
                >
                  <p>{warning.message}</p>
                </Banner>
              )}


              {tags.length === 0 && !isFinished && (
                <LegacyCard sectioned>
                  <EmptyState
                    heading="Ready to Add Tags"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>Enter tags on the left to begin configuring your bulk update.</p>
                  </EmptyState>
                </LegacyCard>
              )}

              {tags.length > 0 && !isFinished && !isRunning && (
                <LegacyCard title="Import Data" sectioned>
                  <BlockStack gap="400">
                    <BlockStack gap="200">
                      <ChoiceList
                        title="Match resources by"
                        choices={matchOptions}
                        selected={[specificField]}
                        onChange={(val) => setSpecificField(val[0])}
                      />
                      <Button variant="plain" onClick={handleDownloadTemplate}>Download Sample CSV</Button>
                    </BlockStack>

                    <DropZone onDrop={handleCsvInput} accept=".csv" allowMultiple={false}>
                      {file ? (
                        <DropZone.FileUpload actionTitle="Replace file" />
                      ) : <DropZone.FileUpload actionTitle="Add file" />}
                    </DropZone>
                    {file && (
                      <Text as="p" tone="success">
                        {file.name} — {csvData.length} records loaded. <Button variant="plain" onClick={() => { setFile(null); setCsvData([]); }}>Remove</Button>
                      </Text>
                    )}
                    <Text as="p" tone="subdued">Only 5000 records will add at a time</Text>

                    <Button
                      variant="primary"
                      onClick={() => setPreviewModalOpen(true)}
                      disabled={!csvData.length}
                      fullWidth
                    >
                      Run Bulk Update
                    </Button>
                  </BlockStack>
                </LegacyCard>
              )}

              {/* 5. Processing Progress */}
              {isRunning && (
                <LegacyCard sectioned>
                  <BlockStack gap="600" align="center" inlineAlign="center">
                    {/* Header Section */}
                    <BlockStack gap="200" align="center" inlineAlign="center">
                      <div style={{ marginBottom: "8px" }}>
                        <Spinner size="large" />
                      </div>
                      <Text as="h2" variant="headingLg">
                        Adding tags
                      </Text>
                      <Text as="p" tone="subdued" alignment="center">
                        Please keep this browser tab open until the process is complete.
                      </Text>
                    </BlockStack>

                    {/* Progress & Stats Section */}
                    <Box width="100%" maxWidth="400px">
                      <BlockStack gap="400">
                        <BlockStack gap="200">
                          <ProgressBar
                            progress={progress}
                            tone="highlight"
                            size="small"
                          />
                          <InlineStack align="space-between">
                            <Text as="span" variant="bodySm" tone="subdued">
                              {progress < 100
                                ? "In progress..."
                                : "Finalizing..."}
                            </Text>
                            <Text as="span" variant="bodySm" fontWeight="bold">
                              {progress}%
                            </Text>
                          </InlineStack>
                        </BlockStack>

                        {/* Data Counter - Clean Minimalist Style */}
                        <Box
                          background="bg-surface-secondary"
                          padding="300"
                          borderRadius="200"
                        >
                          <InlineStack align="center">
                            <Text as="p" variant="bodySm" tone="subdued">
                              <strong>
                                {`${results.length.toLocaleString()} / ${csvData.length.toLocaleString()}`}
                              </strong>
                              {" items processed"}
                            </Text>
                          </InlineStack>
                        </Box>
                      </BlockStack>
                    </Box>
                  </BlockStack>
                </LegacyCard>
              )}

              {isFinished && (
                <LegacyCard sectioned>
                  <BlockStack align="center" inlineAlign="center" gap="500">
                    <Badge tone="success" size="large">Operation Complete</Badge>
                    <Text as="h2" variant="headingLg">Successfully processed {results.length} items.</Text>
                    <InlineStack gap="300">
                      <Button onClick={downloadResults} variant="primary">Download Results</Button>
                      <Button onClick={resetAll}>Clear</Button>
                    </InlineStack>
                  </BlockStack>
                </LegacyCard>
              )}

              {results.length > 0 && (
                <LegacyCard>
                  <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                    <IndexTable
                      resourceName={{ singular: 'result', plural: 'results' }}
                      itemCount={results.length}
                      headings={[
                        { title: '#' },
                        { title: 'Identifier' },
                        { title: 'Status' },
                        { title: 'Error' }
                      ]}
                      selectable={false}
                    >
                      {results.map(({ id, success, errors, index }, i) => (
                        <IndexTable.Row id={id || i.toString()} key={i} position={i}>
                          <IndexTable.Cell>{(index ?? 0) + 1}</IndexTable.Cell>
                          <IndexTable.Cell>{id}</IndexTable.Cell>
                          <IndexTable.Cell>
                            <Badge tone={success ? 'success' : 'critical'}>{success ? 'Success' : 'Failed'}</Badge>
                          </IndexTable.Cell>
                          <IndexTable.Cell>
                            {errors && errors.length > 0 ? errors.map(e => e.message).join(', ') : '-'}
                          </IndexTable.Cell>
                        </IndexTable.Row>
                      ))}
                    </IndexTable>
                  </div>
                </LegacyCard>
              )}
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>

      <CsvPreviewModal
        open={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        onConfirm={() => {
          setPreviewModalOpen(false);
          handleRun();
        }}
        data={rawCsvData}
        title="Ready to Add Tags?"
        confirmText="Add Tags"
        destructive={false}
        confirmationMessage={`You are ready to add ${tags.length} tag's to ${csvData.length} ${csvData.length == 1 ? objectType : `${objectType}'s`} from your CSV.`}
      />

      <Modal
        open={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        title="Ready to Add Tags?"
        primaryAction={{
          content: 'Add Tags',
          onAction: handleRun,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setConfirmModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            You are ready to add {tags.length} tag's to {csvData.length} resource's from your CSV.
          </Text>
        </Modal.Section>
      </Modal>

      {/* CREATE DB MODAL */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create Database"
        primaryAction={{
          content: "Yes, Create",
          onAction: createDatabase,
          loading: isSubmitting,
        }}
        secondaryActions={[
          {
            content: "Maybe Later",
            onAction: () => setModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            Creating a metaobject named{" "}
            <Text as="span" fontWeight="bold">
              “MetaForge App Database”
            </Text>{" "}
            to store your app activity history. Would you like to continue?
          </Text>
        </Modal.Section>
      </Modal>

      {/* SUCCESS MODAL */}
      <Modal
        open={showSuccess}
        onClose={() => setShowSuccess(false)}
        title="Database Created Successfully"
        primaryAction={{
          content: "Close",
          onAction: () => setShowSuccess(false),
        }}
      >
        <Modal.Section>
          <Text as="p">
            Your database has been created successfully. You can now track and
            view all history.
          </Text>
        </Modal.Section>
      </Modal>
      <AddTagsInstructionsModal
        open={instructionsOpen}
        onClose={() => setInstructionsOpen(false)}
      />
    </Page>
  );
}

export function ErrorBoundary() {
  return <RouteErrorBoundary routeName="Add Tags" />;
}




