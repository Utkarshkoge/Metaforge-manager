import { useState, useEffect, useCallback, useRef } from "react";
import { useFetcher, useNavigate, useOutletContext, useBlocker } from "react-router";
import { authenticate } from "../shopify.server";
import {
  Page,
  Layout,
  LegacyCard,
  Select,
  Button,
  Spinner,
  Text,
  EmptyState,
  BlockStack,
  Box,
  Badge,
  Banner,
  ProgressBar,
  DropZone,
  IndexTable,
  Modal,
  ChoiceList,
  InlineStack,
  Icon,
  ResourceList,
  ResourceItem,
} from "@shopify/polaris";
import {
  SearchIcon,
  DeleteIcon,
  FileIcon,
  CheckCircleIcon,
  RefreshIcon,
  NoteIcon,
  ImportIcon,
  DatabaseIcon,
  ClockIcon,
  CreditCardIcon,
} from "@shopify/polaris-icons";

import {
  fetchDefinitions,
  queryMap,
  removeAllMetafields,
  removeSpecificMetafield,
  updateSpecificMetafield,
  getPaginationInfo,
} from "app/functions/metafield-manage-action";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import Papa from "papaparse";
import CsvPreviewModal from "../component/CsvPreviewModal";
import { MetafieldManageInstructionsModal } from "../component/InstructionsModal";
import { RouteErrorBoundary } from "../component/RouteErrorBoundary";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await authenticate.admin(request);
    // eslint-disable-next-line no-undef
    return { apiKey: process.env.SHOPIFY_API_KEY || "" };
  } catch (error) {
    throw new Response("Unauthorized or Server Error", { status: 500 });
  }
};

// ----------------action---------------
export async function action({ request }: ActionFunctionArgs) {
  try {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();

    const objectType: any = formData.get("objectType");
    const mode = formData.get("mode");
    const namespace: any = formData.get("namespace");
    const key: any = formData.get("key");
    const value: any = formData.get("value");
    const type: any = formData.get("type");
    const id: any = formData.get("id");
    const flag: any = formData.get("flag");
    const resource = (queryMap as any)[objectType];

    // REMOVE ALL METAFIELDS (PAGINATED)
    if (mode === "removeMetafield") {
      const cursor: any = formData.get("cursor") || null;
      const limitVal = formData.get("limit");
      const limit = limitVal ? parseInt(String(limitVal), 10) : 200;

      const payload = await removeAllMetafields(
        admin,
        resource,
        namespace,
        key,
        cursor,
        limit,
      );

      return { success: true, payload };
    }

    if (mode === "getPaginationInfo") {
      const plan = formData.get("plan") || "FREE";
      const payload = await getPaginationInfo(admin, resource, String(plan));
      return { success: true, payload };
    }

    // REMOVE SPECIFIC METAFIELD (ONE ID)
    if (mode === "removeMetafieldSpecific") {
      const frontendError = formData.get("frontendError");
      if (frontendError) {
        return { success: false, payload: { id, key, namespace, value, type, success: false, errors: String(frontendError) } };
      }

      if (!id) {
        return { success: false, message: "No ID provided" };
      }

      const flag1 = formData.get("flag1");

      const payload = await removeSpecificMetafield(
        admin,
        id,
        namespace,
        key,
        value,
        type,
        flag,
        flag1,
        objectType,
      );
      return { success: payload.success, payload };
    }

    // UPDATE SPECIFIC METAFIELD (ONE ID)
    if (mode === "updateMetafieldSpecific") {
      const frontendError = formData.get("frontendError");
      if (frontendError) {
        return { success: false, payload: { id, key, namespace, value, type, success: false, errors: String(frontendError) } };
      }

      if (!id) {
        return { success: false, message: "No ID provided" };
      }

      const flag2 = formData.get("flag2");

      const payload = await updateSpecificMetafield(
        admin,
        id,
        namespace,
        key,
        value,
        type,
        flag,
        flag2,
        objectType,
      );

      return { success: payload.success, payload };
    }

    // DEFAULT ACTION — FETCH DEFINITIONS
    const payload = await fetchDefinitions(admin, resource);

    return { success: true, payload };
  } catch (err: any) {
    return {
      success: false,
      message: "Internal server error",
      error: err.message || "Unexpected failure",
    };
  }
}

// --- Interfaces ---
interface MetafieldDefinition {
  namespace: string;
  key: string;
  type: string | { name: string };
  id?: string;
  description?: string;
  ownerType?: string;
  validations?: { name: string; value: string }[];
}

interface CsvRow {
  id: string;
  namespace?: string;
  key?: string;
  value?: string | null;
  type?: string | { name: string };
  error?: string;
  raw?: string[];
  updatedValue?: string;
}

interface OperationResult {
  id: string;
  success: boolean;
  error?: string; // normalized error
  errors?: string | any[]; // API might return this
  data?: any;
  namespace?: string;
  key?: string;
  value?: string;
  type?: string;
  updatedValue?: string;
}


type AppOutletContext = {
  planData: any;
};

export default function MetafieldManage() {
  const fetcher = useFetcher<any>();
  const navigate = useNavigate();
  const { planData } = useOutletContext<AppOutletContext>();
  const [objectType, setObjectType] = useState("product");
  const [metafields, setMetafields] = useState<MetafieldDefinition[]>([]);
  const [selectedMetafield, setSelectedMetafield] = useState<MetafieldDefinition | null>(null);
  const [removeMode, setRemoveMode] = useState("all");
  const [listUpdateMode, setListUpdateMode] = useState("merge");
  const [listRemoveMode, setListRemoveMode] = useState("full");
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);

  // Modals & Alerts
  const [modalOpen, setModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [rawCsvData, setRawCsvData] = useState<any[]>([]);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [alert, setAlert] = useState<{ active: boolean; title: string; message: string; tone?: 'critical' | 'success' | 'info' }>({
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

  let plan = planData?.plan || "FREE";
  let remainingDays = planData?.remainingDays;

  const updateMetaLimit = (metaUpdateCsvLimit: number, planData: any) => {
    fetcher.submit(
      {
        plan: planData?.plan,
        updates: {
          metaUpdateCsvLimit:
            planData?.limits?.metaUpdateCsvLimit - metaUpdateCsvLimit,
        },
      },
      {
        method: "POST",
        encType: "application/json",
        action: "/api/update/plan",
      },
    );
  };

  const removeMetaLimit = (metaRemoveCsvCount: number, planData: any) => {
    fetcher.submit(
      {
        plan: planData?.plan,
        updates: {
          metaRemoveCsvLimit:
            planData?.limits?.metaRemoveCsvLimit - metaRemoveCsvCount,
        },
      },
      {
        method: "POST",
        encType: "application/json",
        action: "/api/update/plan",
      },
    );
  };

  const globalMetaLimit = (planData: any) => {
    fetcher.submit(
      {
        plan: planData?.plan,
        updates: {
          metaGlobal: planData?.limits?.metaGlobal - 1,
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
  const [modalOpendb, setModalOpendb] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);


  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<OperationResult[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [accumulatedResults, setAccumulatedResults] = useState<OperationResult[]>([]);
  const [csvType, setcsvType] = useState("Id"); // default selected
  const [specificField, setSpecificField] = useState("Id"); // default selected
  const [resourceCount, setResourceCount] = useState<number | null>(0);
  const [csvData, setCsvData] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [manualLoading, setManualLoading] = useState(false);
  const isFetchingPagination = fetcher.state === "submitting" && fetcher.formData?.get("mode") === "getPaginationInfo";
  const loading = !isSubmitting && (isDeleting || ((fetcher.state === "submitting" && !isFetchingPagination) || manualLoading));
  const [showInfo, setshowInfo] = useState("");
  const [showInfoMeta, setshowInfoMeta] = useState(false);
  const lastProcessedRef = useRef<any>(null);
  const hasUpdatedLimitRef = useRef(false);
  const isFetchingPaginationInfoRef = useRef(false);

  // Pagination states for Remove All
  const [paginationInfo, setPaginationInfo] = useState<{
    totalCount: number;
    pages: { page: number; start: number; end: number; cursor: string | null }[];
  } | null>(null);
  const [loadingPagination, setLoadingPagination] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<{
    page: number;
    start: number;
    end: number;
    cursor: string | null;
  } | null>(null);
  const [batchProcessedCount, setBatchProcessedCount] = useState(0);

  useBlocker(({ currentLocation, nextLocation }) => {
    return isDeleting && currentLocation.pathname !== nextLocation.pathname;
  });

  useEffect(() => {
    if (!isDeleting) return;

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
  }, [isDeleting]);

  // --- Core Utility Functions ---
  function downloadResultsCSV(results: OperationResult[], removeMode: string) {
    if (!results || results.length === 0) {
      setAlert({
        active: true,
        title: "No Results",
        message: "No results to download!",
        tone: 'critical'
      });
      return;
    }

    let headers: any = [];
    let rows: any = [];
    let filename = "";

    // REMOVE ALL
    if (removeMode === "all") {
      headers = ["id", "success", "value", "error"];
      rows = results.map((r) => [
        csvSafe(r.id),
        csvSafe(r.success ? "true" : "false"),
        csvSafe(r.data?.value),
        csvSafe(r.errors || r.error),
      ]);
      filename = "removeAll_results";
    }

    // REMOVE SPECIFIC Without partial
    else if (removeMode === "specific" && listRemoveMode !== 'partial') {
      headers = [specificField.toLowerCase(), "success", "value", "error"];
      rows = results.map((r) => [
        csvSafe(r.id),
        csvSafe(r.success ? "true" : "false"),
        csvSafe(r.data?.value),
        csvSafe(r.errors || r.error),
      ]);
      filename = "remove_results";
    }

    // REMOVE SPECIFIC With partial
    else if ((removeMode === "specific" && listRemoveMode === 'partial')) {
      headers = [
        specificField.toLowerCase(),
        "key",
        "value",
        "success",
        "error",
      ];
      rows = results.map((r) => [
        csvSafe(r.id),
        csvSafe(r.key),
        csvSafe(r.value),
        csvSafe(r.success ? "true" : "false"),
        csvSafe(r.error || r.errors),
      ]);
      filename = "remove_results";
    }

    // UPDATE
    else if (removeMode === "update") {
      headers = [
        specificField.toLowerCase(),
        "key",
        "value",
        "success",
        "error",
      ];
      rows = results.map((r) => [
        csvSafe(r.id),
        csvSafe(r.key),
        csvSafe(r.value),
        csvSafe(r.success ? "true" : "false"),
        csvSafe(r.error),
      ]);
      filename = "update_results";
    }

    // BUILD CSV
    const csvArray = [
      headers.map(csvSafe).join(","),
      ...rows.map((row: string[]) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvArray], {
      type: "text/csv;charset=utf-8;",
    });

    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const pad = (n: number) => n.toString().padStart(2, "0");
    const d = new Date();
    const timeOnly = `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;

    link.href = url;
    link.download = `${filename}-${timeOnly}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function csvSafe(value: string | number | null | undefined | boolean | any[]) {
    if (value === null || value === undefined) return "";
    const str = String(value);
    const escaped = str.replace(/"/g, '""');
    if (/[",\n]/.test(escaped)) {
      return `"${escaped}"`;
    }
    return escaped;
  }

  // --- Handler Functions ---
  const fetchMetafields = () => {
    if (!objectType) return;
    const formData = new FormData();
    formData.append("objectType", objectType);
    fetcher.submit(formData, { method: "post" });
    setCsvData(0);
    setManualLoading(true);
    setHasSearched(false);
    setPaginationInfo(null);
    setSelectedBatch(null);
    setLoadingPagination(false);
    isFetchingPaginationInfoRef.current = false;
  };

  const handleMetafieldSelection = (m: MetafieldDefinition) => {
    setSelectedMetafield(m);
    setCsvRows([]);
    setRawCsvData([]);
    setRemoveMode("all");
    setProgress(0);
    setResults([]);
    setCompleted(false);
    setCurrentIndex(0);
    setAccumulatedResults([]);
    setFileName(null);
    setPaginationInfo(null);
    setSelectedBatch(null);
    setLoadingPagination(false);
    isFetchingPaginationInfoRef.current = false;
  };

  const handleCsvInput = useCallback(async (_dropFiles: File[], acceptedFiles: File[], _rejectedFiles: File[]) => {
    if (remainingDays === 0) {
      setAlert({
        active: true,
        title: "Plan Expired",
        message: "Your plan has expired (0 days remaining). Please upgrade your subscription to continue.",
        tone: "critical",
      });
      setWarning((prev) => ({ ...prev, active: false }));
      setCsvRows([]);
      setRawCsvData([]);
      setCsvData(0);
      return;
    }

    const file = acceptedFiles[0];
    if (!file) {
      setCsvRows([]);
      setRawCsvData([]);
      setCsvData(0);
      return;
    }
    setFileName(file.name);

    const isUpdateOrPartial = removeMode === "update" || (removeMode === "specific" && listRemoveMode === "partial");

    if (isUpdateOrPartial) {
      // Handle Update/Partial CSV
      const text = await file.text();
      const parsed = parseCSV(text);

      if (!parsed.length) {
        setAlert({ active: true, title: "Empty CSV", message: "CSV is empty", tone: 'critical' });
        setCsvRows([]); setRawCsvData([]); setCsvData(0); return;
      }

      const headers = parsed[0].map((h: string) => h.trim().toLowerCase());
      const dataRows = parsed.slice(1);

      if (!headers.includes(specificField.toLowerCase()) || !headers.includes("value")) {
        setAlert({ active: true, title: "Missing Columns", message: `CSV must contain '${specificField}' and 'value' columns.`, tone: 'critical' });
        setCsvRows([]); setRawCsvData([]); setCsvData(0); return;
      }

      const expectedHeaders = [specificField.toLowerCase(), "value"];
      const extraHeaders = headers.filter((h: string) => !expectedHeaders.includes(h));
      if (extraHeaders.length > 0) {
        setAlert({ active: true, title: "Invalid CSV Format", message: `The CSV contains extra columns: ${extraHeaders.join(', ')}. Only the '${specificField}' and 'value' columns are allowed.`, tone: 'critical' });
        setCsvRows([]); setRawCsvData([]); setCsvData(0); return;
      }

      const idIndex = headers.indexOf(specificField.toLowerCase());
      const valueIndex = headers.indexOf("value");
      let hasInvalidGid = false;

      const rows = dataRows.map((cols: string[]) => {
        const rawId = cols[idIndex];
        const id = typeof rawId === "string" ? rawId.trim() : rawId;
        const value = cols[valueIndex];
        if (!id || value === undefined) return null;



        let normalizedValue: string | null = null;
        let error = "";

        try {
          const safeValue =
            value === null || value === undefined
              ? ""
              : String(value).trim();

          normalizedValue = normalizeMetafieldValue(
            selectedMetafield,
            safeValue
          );
        } catch (e: any) {
          error = e.message;
        }
        const row: CsvRow = {
          id,
          namespace: selectedMetafield?.namespace,
          key: selectedMetafield?.key,
          value: normalizedValue,
          type: selectedMetafield?.type,
          error,
          raw: cols,
        };
        return row;
      }).filter((r): r is CsvRow => r !== null);


      const maxCsvRows = plan === "FREE" ? 200 : plan === "BASIC" ? 3000 : 5000;
      if (rows.length > maxCsvRows) {
        setAlert({ active: true, title: "Limit Exceeded", message: `Your plan allows updating up to ${maxCsvRows} records at a time. Please upgrade your plan to add more.`, tone: 'critical' });
        setWarning((prev) => ({ ...prev, active: false }));
        setCsvRows([]); setRawCsvData([]); setCsvData(0); return;
      }

      if (
        rows.length > planData?.limits?.metaUpdateCsvLimit &&
        plan !== "ADVANCED"
      ) {
        setWarning({
          active: true,
          title: "Limit Exceeded",
          message: `You only have access to add ${planData?.limits?.metaUpdateCsvLimit} csv entries remaining according to your plan. Please update your plan to add more.`,
          tone: "warning",
        });
        setAlert((prev) => ({ ...prev, active: false }));
        setCsvRows([]); setRawCsvData([]); setCsvData(0); return;
      }

      if (rows.length === 0) {
        setAlert({ active: true, title: "Valid Record Not Found", message: "No valid records found in the CSV file.", tone: 'critical' });
        setWarning((prev) => ({ ...prev, active: false }));
        setCsvRows([]); setRawCsvData([]); setCsvData(0); return;
      }

      const originalHeaders = parsed[0].map((h: string) => h.trim());
      const rawDataObjects = dataRows.map((cols: string[]) => {
        const obj: Record<string, string> = {};
        originalHeaders.forEach((header: string, index: number) => {
          obj[header] = cols[index];
        });
        return obj;
      });

      setCsvRows(rows);
      setCsvData(rows.length);
      setRawCsvData(rawDataObjects);
      setResults([]);
      setProgress(0);
      setCurrentIndex(0);
      setAccumulatedResults([]);
      setAlert({ ...alert, active: false })

    } else {
      // Handle Standard Removal CSV
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => {
          const normalizedField = specificField.toLowerCase();
          let hasInvalidGid = false;

          // Strict column validation
          const headers = res.meta.fields?.map((h: string) => h.trim().toLowerCase()) || [];
          const expectedHeaders = [normalizedField];
          const extraHeaders = headers.filter((h: string) => !expectedHeaders.includes(h));

          if (extraHeaders.length > 0) {
            setAlert({ active: true, title: "Invalid CSV Format", message: `The CSV contains extra columns: ${extraHeaders.join(', ')}. Only the '${specificField}' column is allowed.`, tone: 'critical' });
            setCsvRows([]); setRawCsvData([]); setCsvData(0); return;
          }

          const rows: CsvRow[] = res.data.map((rawRow: any) => {
            const normalizedRow: any = Object.keys(rawRow).reduce((acc: any, key) => {
              acc[key.toLowerCase()] = rawRow[key];
              return acc;
            }, {});

            const rawId = normalizedRow[normalizedField];
            const id = typeof rawId === "string" ? rawId.trim() : rawId;
            if (!id) return null;


            const row: CsvRow = {
              id,
              namespace: selectedMetafield?.namespace,
              key: selectedMetafield?.key,
            };
            return row;
          }).filter((r: unknown): r is CsvRow => r !== null);


          const maxCsvRows = plan === "FREE" ? 200 : plan === "BASIC" ? 3000 : 5000;
          if (rows.length > maxCsvRows) {
            setAlert({ active: true, title: "Limit Exceeded", message: `Your plan allows removing metafields for up to ${maxCsvRows} records at a time. Please upgrade your plan to add more.`, tone: 'critical' });
            setWarning((prev) => ({ ...prev, active: false }));
            setCsvRows([]); setRawCsvData([]); setCsvData(0); return;
          }

          if (
            rows.length > planData?.limits?.metaRemoveCsvLimit &&
            plan !== "ADVANCED"
          ) {
            setWarning({
              active: true,
              title: "Limit Exceeded",
              message: `You only have access to add ${planData?.limits?.metaRemoveCsvLimit} csv entries remaining according to your plan. Please update your plan to add more.`,
              tone: "warning",
            });
            setAlert((prev) => ({ ...prev, active: false }));
            setCsvRows([]); setRawCsvData([]); setCsvData(0); return;
          }

          if (rows.length === 0) {
            setAlert({ active: true, title: "Valid Record Not Found", message: "No valid records found. Please follow the CSV Format", tone: 'critical' });
            setWarning((prev) => ({ ...prev, active: false }));
            setCsvRows([]); setRawCsvData([]); setCsvData(0); return;
          }

          setCsvData(rows.length);
          setCsvRows(rows);
          setRawCsvData(res.data);
          setResults([]);
          setProgress(0);
          setCurrentIndex(0);
          setAccumulatedResults([]);
          setAlert({ ...alert, active: false });
          setWarning((prev) => ({ ...prev, active: false }));
        },
        error: (err) => {
          setAlert({ active: true, title: "Parsing Error", message: "Failed to parse CSV file.", tone: 'critical' });
          setCsvRows([]); setRawCsvData([]); setCsvData(0);
        }
      });
    }
  }, [removeMode, listRemoveMode, listUpdateMode, specificField, objectType, selectedMetafield, planData, plan]);


  function getShopifyObjectTypeFromGid(gid: string) {
    if (typeof gid !== "string") return null;
    const match = gid.match(/^gid:\/\/shopify\/([^/]+)\/\d+$/);
    return match ? match[1].toLowerCase() : null;
  }

  function normalizeMetafieldValue(metafield: MetafieldDefinition | null | undefined, rawValue: string) {
    if (rawValue == null) return null;
    const type = typeof metafield?.type === "string" ? metafield.type : metafield?.type?.name;
    const value: any = rawValue;

    if (type?.startsWith("list.") && type.includes("_reference")) {
      const list = value.trim().startsWith("[")
        ? JSON.parse(value)
        : value.split(",").map((v: any) => v.trim()).filter(Boolean);
      return JSON.stringify(list);
    }

    // if (type?.includes("_reference") && !type?.includes("metaobject_reference")) {
    //   if (!value.trim().startsWith("gid://")) {
    //     throw new Error("Invalid GID reference");
    //   }
    //   return value.trim();
    // }

    switch (type) {
      case "single_line_text_field": return value;
      case "multi_line_text_field": return value.replace(/\\n/g, "\n");
      case "list.single_line_text_field":
        return JSON.stringify(
          value.trim().startsWith("[") ? JSON.parse(value) : value.split(",").map((v: any) => v.trim()).filter(Boolean)
        );
      case "number_integer":
        if (!Number.isInteger(Number(value))) throw new Error("Invalid integer");
        return String(value);
      case "boolean":
        if (value.toLowerCase() === "true" || value === true) return "true";
        if (value.toLowerCase() === "false" || value === false) return "false";
        throw new Error("Invalid boolean");
      case "date_time": return value.includes("T") ? value : `${value}T00:00:00Z`;
      case "json": return typeof value === "string" ? value : JSON.stringify(value);
      case "link": {
        const v = value.trim();
        if (v.startsWith("{")) return v;
        if (/^https?:\/\//i.test(v)) return JSON.stringify({ text: "View", url: v });
        if (v.includes("|")) {
          const [t, gid] = v.split("|");
          if (gid?.startsWith("gid://")) return JSON.stringify({ type: t.trim(), id: gid.trim() });
        }
        throw new Error("Invalid link value");
      }
      case "url":
        if (!/^https?:\/\//i.test(value.trim())) throw new Error("Invalid URL");
        return value.trim();
      case "list.rating":
      case "rating": {
        const buildRatingObj = (val: string) => {
          if (val.trim().startsWith("{")) {
            try {
              return JSON.parse(val.trim());
            } catch {
              return val.trim();
            }
          }
          const num = parseFloat(val);
          if (isNaN(num)) throw new Error("Invalid rating value");

          let minValidation = "1.0";
          let maxValidation = "5.0";
          if (metafield?.validations) {
            const minObj = metafield.validations.find((v: any) => v.name === "min");
            const maxObj = metafield.validations.find((v: any) => v.name === "max");
            if (minObj) minValidation = minObj.value;
            if (maxObj) maxValidation = maxObj.value;
          }

          // Shopify expects decimal values to be passed as strings inside the JSON object
          return {
            scale_min: String(minValidation),
            scale_max: String(maxValidation),
            value: num.toFixed(1)
          };
        };

        if (type === "list.rating") {
          const arr = String(value).trim().startsWith("[")
            ? JSON.parse(String(value))
            : String(value).split(",").map((v: string) => v.trim()).filter(Boolean);
          return JSON.stringify(arr.map((v: string) => buildRatingObj(v)));
        } else {
          return JSON.stringify(buildRatingObj(String(value)));
        }
      }
      default: {
        if (typeof value === "string" && value.trim().startsWith("{")) {
          try {
            const parsed = JSON.parse(value.trim());
            // Map "amount" to "value" if the user accidentally provided "amount" for a measurement type
            if ("amount" in parsed && !("value" in parsed)) {
              parsed.value = parsed.amount;
              delete parsed.amount;
            }
            // Shopify measurement fields require the "value" property to be a numeric type.
            if ("value" in parsed && "unit" in parsed && typeof parsed.value === "string") {
              const num = Number(parsed.value);
              if (!isNaN(num)) {
                parsed.value = num;
              }
            }
            return JSON.stringify(parsed);
          } catch (e) {
            // Fall through if not valid JSON
          }
        }
        return value;
      }
    }
  }

  function parseCSV(text: string) {
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
    return lines.map((line) => {
      const cols = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const next = line[i + 1];
        if (char === '"' && next === '"') { current += '"'; i++; continue; }
        if (char === '"') { inQuotes = !inQuotes; continue; }
        if (char === "," && !inQuotes) { cols.push(current); current = ""; continue; }
        current += char;
      }
      cols.push(current);
      return cols;
    });
  }

  const handleCloseModal = () => {
    setModalOpen(false);
    if (loadingPagination) {
      setLoadingPagination(false);
      setPaginationInfo(null);
      setSelectedBatch(null);
      isFetchingPaginationInfoRef.current = false;
    }
  };

  const confirmDelete = () => {
    if (remainingDays === 0) {
      setAlert({
        active: true,
        title: "Plan Expired",
        message: "Your plan has expired (0 days remaining). Please upgrade your subscription to continue.",
        tone: "critical",
      });
      setWarning((prev) => ({ ...prev, active: false }));
      return;
    }

    if (!selectedMetafield) {
      setAlert({ active: true, title: "Selection Required", message: "Select a metafield!", tone: 'critical' });
      return;
    }

    if (removeMode === "all") {
      if (planData?.limits?.metaGlobal === 0 && plan !== "ADVANCED") {
        setWarning({
          active: true,
          title: "Limit Exceeded",
          message:
            "Your global metafield removal limit has been reached. Please upgrade your plan to continue.",
          tone: "warning",
        });
        setAlert((prev) => ({ ...prev, active: false }));
        return;
      }

      setModalOpen(true);

      // If we already have the paginationInfo loaded, use it!
      if (paginationInfo) {
        setLoadingPagination(false);
        return;
      }

      setLoadingPagination(true);
      setPaginationInfo(null);
      setSelectedBatch(null);

      const formData = new FormData();
      formData.append("mode", "getPaginationInfo");
      formData.append("objectType", objectType);
      formData.append("plan", plan);
      isFetchingPaginationInfoRef.current = true;
      fetcher.submit(formData, { method: "post" });
      return;
    }

    if (["specific", "update"].includes(removeMode) && !csvRows.length) {
      setAlert({ active: true, title: "Missing CSV", message: `Upload a CSV file with ${specificField}'s (and values for update)!`, tone: 'critical' });
      return;
    }

    if (removeMode !== 'all' && csvRows.length > 0) {
      setPreviewModalOpen(true);
    } else {
      setModalOpen(true);
    }
  };


  const handleConfirm = () => {
    setModalOpen(false);
    setProgress(0);
    setAccumulatedResults([]);
    setResults([]);
    setCurrentIndex(0);
    setResourceCount(0);
    hasUpdatedLimitRef.current = false;

    if (removeMode === "all") {
      setIsDeleting(true);
      setBatchProcessedCount(0);
      const maxMetafieldItems = plan === "FREE" ? 100 : plan === "BASIC" ? 250 : 5000;
      const batchSize = selectedBatch ? (selectedBatch.end - selectedBatch.start + 1) : maxMetafieldItems;
      const initialLimit = Math.min(200, batchSize);
      const formData = new FormData();
      formData.append("mode", "removeMetafield");
      formData.append("objectType", objectType);
      formData.append("namespace", selectedMetafield?.namespace || "");
      formData.append("key", selectedMetafield?.key || "");
      formData.append("limit", String(initialLimit));
      if (selectedBatch && selectedBatch.cursor) {
        formData.append("cursor", selectedBatch.cursor);
      }
      fetcher.submit(formData, { method: "post" });
    } else if (removeMode === "specific") {
      setIsDeleting(true);
    } else if (removeMode === "update") {
      setIsDeleting(true);
    }
  };

  const resetToHome = () => {
    setSelectedMetafield(null);
    setCsvRows([]);
    setRawCsvData([]);
    setRemoveMode("all");
    setListUpdateMode("merge");
    setListRemoveMode("full");
    setProgress(0);
    setResults([]);
    setCompleted(false);
    setMetafields([]);
    hasUpdatedLimitRef.current = false;
    setCurrentIndex(0);
    setAccumulatedResults([]);
    setResourceCount(0);
    setHasSearched(false);
    setFileName(null);
    setAlert({ ...alert, active: false });
    setPaginationInfo(null);
    setLoadingPagination(false);
    setSelectedBatch(null);
    setBatchProcessedCount(0);
  };

  const backToSelectedFeild = () => {
    setSelectedMetafield(null);
    setCsvRows([]);
    setRawCsvData([]);
    setRemoveMode("all");
    setListUpdateMode("merge");
    setListRemoveMode("full");
    setProgress(0);
    setResults([]);
    setCompleted(false);
    setCurrentIndex(0);
    setAccumulatedResults([]);
    setResourceCount(0);
    setHasSearched(false);
    setFileName(null);
    setAlert({ ...alert, active: false });
    setPaginationInfo(null);
    setLoadingPagination(false);
    setSelectedBatch(null);
    setBatchProcessedCount(0);
  };

  const handleClearCSV = () => {
    setCsvRows([]);
    setRawCsvData([]);
    setCsvData(0);
    setFileName(null);
  };

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

  // --- Effects for Processing ---
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (lastProcessedRef.current === fetcher.data) return;
    lastProcessedRef.current = fetcher.data;

    if (fetcher.data?.successdb === undefined) {
      const data = fetcher?.data;

      // Handle pagination info response
      if (data?.success && data?.payload && 'pages' in data.payload) {
        if (!isFetchingPaginationInfoRef.current) {
          // The request was cancelled! Do not set pagination info.
          return;
        }
        isFetchingPaginationInfoRef.current = false;
        setPaginationInfo(data.payload);
        setLoadingPagination(false);
        if (data.payload.pages.length > 0) {
          setSelectedBatch(data.payload.pages[0]);
        }
        return;
      }

      if (data?.success && data?.payload?.metafields) {
        setMetafields(data.payload.metafields);
      }
      setHasSearched(true);
      setManualLoading(false);

      const isSuccess = data.success ?? false;
      const response = data?.payload;
      const errorMsg = data?.payload?.errors?.[0]?.message || data?.payload?.errors || data?.error || "";

      if (removeMode === "specific" && isDeleting && listRemoveMode !== 'partial') {
        const row = response || {};
        const updaterow: OperationResult = { ...row, id: csvRows[currentIndex]?.id ?? '' };
        const newResult: OperationResult = { ...updaterow, success: isSuccess, error: errorMsg };
        const updated = [...accumulatedResults, newResult];
        setAccumulatedResults(updated);
        setResults(updated);
        setProgress(Math.round(((currentIndex + 1) / csvRows.length) * 100));

        if (currentIndex + 1 >= csvRows.length) {
          setIsDeleting(false);
          setCompleted(true);
          setSelectedMetafield(null);
        } else {
          setCurrentIndex((prev) => prev + 1);
        }
      }

      if (removeMode === "specific" && isDeleting && listRemoveMode === 'partial') {
        const row = response || {};
        const updaterow: OperationResult = {
          ...row,
          id: csvRows[currentIndex]?.id ?? '',
          value: Array.isArray(row.data) ? row.data.join(", ") : row.data,
          key: row.key,
          type: row.type,
          namespace: row.namespace
        };
        const newResult: OperationResult = {
          ...updaterow,
          success: isSuccess,
          errors: errorMsg || null,
        };
        const updated = [...accumulatedResults, newResult];
        setAccumulatedResults(updated);
        setResults(updated);
        setProgress(Math.round(((currentIndex + 1) / csvRows.length) * 100));

        if (currentIndex + 1 >= csvRows.length) {
          setIsDeleting(false);
          setCompleted(true);
          setSelectedMetafield(null);
        } else {
          setCurrentIndex((prev) => prev + 1);
        }
      }

      if (removeMode === "update" && isDeleting) {
        const row = csvRows[currentIndex];
        const newResult: OperationResult = {
          ...row,
          value: row.value || undefined, // ensure no null
          success: isSuccess,
          error: errorMsg,
          updatedValue: row.value || undefined,
          type: typeof row.type === 'string' ? row.type : row.type?.name,
        };

        if (currentIndex + 1 <= csvRows.length) {
          const updated = [...accumulatedResults, newResult];
          setAccumulatedResults(updated);
          setResults(updated);
        }
        setProgress(Math.round(((currentIndex + 1) / csvRows.length) * 100));

        if (currentIndex + 1 >= csvRows.length) {
          setIsDeleting(false);
          setCompleted(true);
          setSelectedMetafield(null);
        } else {
          setCurrentIndex((prev) => prev + 1);
        }
      }

      if (removeMode === "all" && isDeleting) {
        const payload = data.payload;
        const batch = payload?.results ?? [];
        const nextCursor = payload?.nextCursor ?? null;
        const hasMore = payload?.hasMore ?? false;
        const totalCount = payload?.ResourceCount ?? null;
        if (resourceCount === 0) setResourceCount(totalCount);

        const updatedResults = [...accumulatedResults, ...batch];
        setAccumulatedResults(updatedResults);
        setResults(updatedResults);

        const newProcessedCount = batchProcessedCount + batch.length;
        setBatchProcessedCount(newProcessedCount);

        const maxMetafieldItems = plan === "FREE" ? 100 : plan === "BASIC" ? 250 : 5000;
        const batchSize = selectedBatch ? (selectedBatch.end - selectedBatch.start + 1) : maxMetafieldItems;

        if (batchSize && batchSize > 0) {
          const percent = Math.min(100, Math.round((newProcessedCount / batchSize) * 100));
          setProgress(percent);
        } else {
          setProgress(10);
        }

        if (hasMore && nextCursor && newProcessedCount < batchSize) {
          const nextLimit = Math.min(200, batchSize - newProcessedCount);
          const formData = new FormData();
          formData.append("mode", "removeMetafield");
          formData.append("objectType", objectType);
          formData.append("namespace", selectedMetafield?.namespace || "");
          formData.append("key", selectedMetafield?.key || "");
          formData.append("cursor", nextCursor);
          formData.append("limit", String(nextLimit));
          fetcher.submit(formData, { method: "post" });
        } else {
          setProgress(100);
          setCompleted(true);
          setIsDeleting(false);
          setSelectedMetafield(null);
        }
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
        setModalOpendb(false);
        setIsSubmitting(false);
        setShowSuccess(true);
      }
    }

  }, [
    fetcher.state,
    fetcher.data,
    isDeleting,
    removeMode,
    currentIndex,
    csvRows,
    accumulatedResults,
    listRemoveMode,
    selectedMetafield,
    objectType,
    selectedBatch,
    batchProcessedCount,
    resourceCount,
    isDbCreated,
    isSubmitting
  ]);

  useEffect(() => {
    if (!isDeleting) return;
    if (removeMode === "all") return;
    if (currentIndex >= csvRows.length) {
      setIsDeleting(false);
      setCompleted(true);
      setSelectedMetafield(null);
      return;
    }

    const row = csvRows[currentIndex];
    const formData = new FormData();

    const typeName = typeof selectedMetafield?.type === "string" ? selectedMetafield.type : selectedMetafield?.type?.name;

    if (removeMode === "specific") {
      formData.append("mode", "removeMetafieldSpecific");
      if (listRemoveMode === 'partial' && typeName?.startsWith('list.')) {
        formData.append("flag1", "true");
        formData.append("value", row.value || "");
      } else {
        formData.append("flag1", "false");
      }
    }

    if (removeMode === "update") {
      formData.append("mode", "updateMetafieldSpecific");
      formData.append("value", row.value || "");
      if (listUpdateMode === 'replace' && typeName?.startsWith('list.')) {
        formData.append("flag2", "true");
      } else {
        formData.append("flag2", "false");
      }
    }
    formData.append("flag", String(specificField === "Id"));
    formData.append("namespace", row.namespace || "");
    formData.append("key", row.key || "");
    formData.append("id", row.id || "");
    const safeTypeName = row?.type && typeof row.type === 'object' && 'name' in row.type ? row.type.name : (row?.type as string) || typeName || "single_line_text_field";
    formData.append("type", safeTypeName);
    formData.append("objectType", objectType);
    if (row.error) {
      formData.append("frontendError", row.error);
    }
    fetcher.submit(formData, { method: "post" });
  }, [currentIndex, isDeleting, removeMode]);

  useEffect(() => {
    const typeName = typeof selectedMetafield?.type === 'string' ? selectedMetafield.type : selectedMetafield?.type?.name;

    // Reset
    setshowInfo("");
    setshowInfoMeta(false);

    if (!typeName) return;

    const isList = typeName.startsWith("list.");
    const normalizedType = isList ? typeName.replace("list.", "") : typeName;

    if (!normalizedType.endsWith("_reference")) return;

    const referenceMessageMap: Record<string, string> = {
      product: "product handle",
      collection: "collection handle",
      customer: "customer email",
      order: "order name",
      blogpost: "blog post handle",
      variant: "variant SKU",
      company: "company external ID",
      location: "location name",
      metaobject: "metaobject handle",
    };

    // remove "_reference"
    const key = normalizedType?.toLowerCase().replace(/_reference$/, "");
    const referenceLabel = referenceMessageMap[key];
    if (!referenceLabel) return;

    setshowInfo(
      isList
        ? `CSV values can be multiple ${referenceLabel}s or Shopify GIDs (comma-separated).`
        : `CSV value can be a ${referenceLabel} or a Shopify GID.`
    );

    setshowInfoMeta(true);
  }, [selectedMetafield, objectType]);

  const handleDownloadTemplate = () => {
    const currentField = specificField;
    const currentType = csvType;
    const currentObjectType = objectType;

    const header = currentField === "Id" ? "Id" : currentType;

    const gidMap: Record<string, string> = {
      product: "Product",
      customer: "Customer",
      order: "Order",
      articles: "Article",
      blog: "Blog",
      page: "Page",
      productVariant: "ProductVariant",
      company: "Company",
      companyLocation: "CompanyLocation",
      location: "Location",
      market: "Market",
      collection: "Collection",
    };

    const gidType: string = gidMap[currentObjectType] || "Unknown";

    let sampleIds: string[] = [];

    if (header === "Id") {
      sampleIds = [
        `gid://shopify/${gidType}/123456789`,
        `gid://shopify/${gidType}/987654321`,
      ];
    } else if (header === "Sku") {
      sampleIds = ["SKU-1001", "SKU-1002"];
    } else if (header === "Email") {
      sampleIds = ["user1@example.com", "user2@example.com"];
    } else if (header === "Name") {
      sampleIds = ["#1001", "#1002"];
    } else if (header === "Handle") {
      sampleIds = ["sample-handle-1", "sample-handle-2"];
    } else if (header === "External_ID") {
      sampleIds = ["EXT-1001", "EXT-1002"];
    }

    let csvContent = "";

    // ------------------ SPECIFIC REMOVE (ID ONLY) ------------------
    if (removeMode === "specific" && listRemoveMode !== "partial") {
      csvContent = [header, ...sampleIds].join("\n");
    }

    // ------------------ UPDATE / PARTIAL WITH VALUE ------------------
    else if (
      (removeMode === "update" || removeMode === "specific")
    ) {
      const typeName = typeof selectedMetafield?.type === 'string'
        ? selectedMetafield.type
        : selectedMetafield?.type?.name;

      if (!typeName) return;

      const valueSamples = getMetafieldSampleValues(typeName);

      const rows = [
        `${header},value`,
        ...sampleIds.map(
          (id, i) => `${id},${valueSamples[i] || valueSamples[0]}`
        ),
      ];


      csvContent = rows.join("\n");
    }

    // ------------------ DOWNLOAD ------------------
    if (csvContent) {
      const blob = new Blob([csvContent], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `sample-${header}-template-${Date.now()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  function getMetafieldSampleValues(typeName: string) {
    const isList = typeName.startsWith("list.");
    const baseType = isList ? typeName.replace("list.", "") : typeName;

    // Helper: make value CSV-safe (single column guaranteed)
    const csvSafe = (value: string) =>
      `"${String(value).replace(/"/g, '""').replace(/\r?\n/g, "\\n")}"`;

    // Helper: rich text generator (Shopify-compliant)
    const richText = (text: string, boldWord?: string) =>
      csvSafe(
        JSON.stringify({
          type: "root",
          children: [
            {
              type: "paragraph",
              children: boldWord
                ? [
                  { type: "text", value: `${text} ` },
                  { type: "text", value: boldWord, bold: true },
                ]
                : [{ type: "text", value: text }],
            },
          ],
        })
      );

    const samples: any = {
      /* ---------------- TEXT ---------------- */
      single_line_text_field: ["Sample text", "Another text"],
      multi_line_text_field: [
        csvSafe("Line one\nLine two"),
        csvSafe("Second multi-line value"),
      ],

      rich_text_field: [
        richText("This is", "rich text"),
        richText("Another paragraph"),
      ],

      /* ---------------- EMAIL ---------------- */
      email: ["user@example.com", "admin@example.com"],

      /* ---------------- LANG ---------------- */
      language: ["en", "ar"],

      /* ---------------- NUMBER ---------------- */
      number_integer: ["10", "25"],
      number_decimal: ["10.5", "25.75"],
      rating: ["4.5", "3.0"],

      /* ---------------- MONEY / DIMENSIONS ---------------- */
      money: [
        csvSafe('{"amount":"10.00","currency_code":"USD"}'),
        csvSafe('{"amount":"99.99","currency_code":"USD"}'),
      ],

      weight: [
        csvSafe('{"value":1.5,"unit":"kg"}'),
        csvSafe('{"value":3,"unit":"kg"}'),
      ],

      volume: [
        csvSafe('{"value":2.5,"unit":"l"}'),
        csvSafe('{"value":5,"unit":"l"}'),
      ],

      dimension: [
        csvSafe('{"value":10,"unit":"cm"}'),
        csvSafe('{"value":25,"unit":"cm"}'),
      ],
      antenna_gain: [
        csvSafe('{"value":10,"unit":"decibels_isotropic"}'),
        csvSafe('{"value":20,"unit":"decibels_isotropic"}')
      ],
      area: [
        csvSafe('{"value":10,"unit":"square_meters"}'),
        csvSafe('{"value":25,"unit":"square_meters"}')
      ],
      battery_charge_capacity: [
        csvSafe('{"value":3000,"unit":"milliamp_hours"}'),
        csvSafe('{"value":10,"unit":"milliamp_hours"}')
      ],
      battery_energy_capacity: [
        csvSafe('{"value":50,"unit":"watt_hours"}'),
        csvSafe('{"value":100,"unit":"watt_hours"}')
      ],
      capacitance: [
        csvSafe('{"value":10,"unit":"microfarads"}'),
        csvSafe('{"value":100,"unit":"microfarads"}')
      ],
      concentration: [
        csvSafe('{"value":5,"unit":"milligrams_per_milliliter"}'),
        csvSafe('{"value":10,"unit":"milligrams_per_milliliter"}')
      ],
      data_storage_capacity: [
        csvSafe('{"value":256,"unit":"gigabytes"}'),
        csvSafe('{"value":512,"unit":"gigabytes"}')
      ],
      data_transfer_rate: [
        csvSafe('{"value":100,"unit":"megabits_per_second"}'),
        csvSafe('{"value":1000,"unit":"megabits_per_second"}')
      ],
      display_density: [
        csvSafe('{"value":300,"unit":"pixels_per_inch"}'),
        csvSafe('{"value":400,"unit":"pixels_per_inch"}')
      ],
      distance: [
        csvSafe('{"value":10,"unit":"kilometers"}'),
        csvSafe('{"value":50,"unit":"kilometers"}')
      ],
      duration: [
        csvSafe('{"value":60,"unit":"seconds"}'),
        csvSafe('{"value":120,"unit":"seconds"}')
      ],
      electric_current: [
        csvSafe('{"value":2,"unit":"amperes"}'),
        csvSafe('{"value":5,"unit":"amperes"}')
      ],
      electrical_resistance: [
        csvSafe('{"value":10,"unit":"ohms"}'),
        csvSafe('{"value":100,"unit":"ohms"}')
      ],
      energy: [
        csvSafe('{"value":100,"unit":"joules"}'),
        csvSafe('{"value":500,"unit":"joules"}')
      ],
      frequency: [
        csvSafe('{"value":60,"unit":"hertz"}'),
        csvSafe('{"value":120,"unit":"hertz"}')
      ],
      illuminance: [
        csvSafe('{"value":100,"unit":"lux"}'),
        csvSafe('{"value":500,"unit":"lux"}')
      ],
      inductance: [
        csvSafe('{"value":10,"unit":"millihenries"}'),
        csvSafe('{"value":50,"unit":"millihenries"}')
      ],
      luminous_flux: [
        csvSafe('{"value":800,"unit":"lumens"}'),
        csvSafe('{"value":1600,"unit":"lumens"}')
      ],
      mass_flow_rate: [
        csvSafe('{"value":1,"unit":"kilograms_per_hour"}'),
        csvSafe('{"value":5,"unit":"kilograms_per_hour"}')
      ],
      power: [
        csvSafe('{"value":100,"unit":"watts"}'),
        csvSafe('{"value":500,"unit":"watts"}')
      ],
      pressure: [
        csvSafe('{"value":100,"unit":"pounds_per_square_inch"}'),
        csvSafe('{"value":500,"unit":"pounds_per_square_inch"}')
      ],
      resolution: [
        csvSafe('{"value":1080,"unit":"pixels"}'),
        csvSafe('{"value":2160,"unit":"pixels"}')
      ],
      rotational_speed: [
        csvSafe('{"value":1000,"unit":"revolutions_per_minute"}'),
        csvSafe('{"value":10,"unit":"revolutions_per_minute"}')
      ],
      sound_level: [
        csvSafe('{"value":50,"unit":"decibels"}'),
        csvSafe('{"value":100,"unit":"decibels"}')
      ],
      speed: [
        csvSafe('{"value":10,"unit":"meters_per_second"}'),
        csvSafe('{"value":50,"unit":"meters_per_second"}')
      ],
      temperature: [
        csvSafe('{"value":20,"unit":"celsius"}'),
        csvSafe('{"value":100,"unit":"celsius"}')
      ],
      thermal_power: [
        csvSafe('{"value":100,"unit":"kilowatts"}'),
        csvSafe('{"value":500,"unit":"kilowatts"}')
      ],
      voltage: [
        csvSafe('{"value":110,"unit":"volts"}'),
        csvSafe('{"value":220,"unit":"volts"}')
      ],
      volumetric_flow_rate: [
        csvSafe('{"value":1,"unit":"liters_per_second"}'),
        csvSafe('{"value":5,"unit":"liters_per_second"}')
      ],


      /* ---------------- BOOLEAN ---------------- */
      boolean: ["true", "false"],

      /* ---------------- DATE ---------------- */
      date: ["2025-01-01", "2025-12-31"],
      date_time: ["2025-01-01T10:00:00Z", "2025-12-31T18:30:00Z"],

      /* ---------------- COLOR ---------------- */
      color: ["#FF0000", "#00FF00"],

      /* ---------------- JURISDICTION ---------------- */
      jurisdiction: ["us", "ca"],

      /* ---------------- LINK / URL ---------------- */
      url: ["https://example.com", "https://shopify.com"],
      link: [
        csvSafe('{"type":"URL","value":"https://example.com"}'),
        csvSafe('{"type":"URL","value":"https://shopify.com"}'),
      ],

      /* ---------------- JSON ---------------- */
      json: [
        csvSafe('{"key":"value"}'),
        csvSafe('{"enabled":true,"count":5}'),
      ],

      /* ---------------- FILE / MEDIA ---------------- */
      file_reference: [
        "gid://shopify/MediaImage/123456789",
        "gid://shopify/MediaImage/987654321",
      ],

      /* ---------------- REFERENCES ---------------- */
      product_reference: [
        "gid://shopify/Product/123456789",
        "gid://shopify/Product/987654321",
      ],
      variant_reference: [
        "gid://shopify/ProductVariant/123456789",
        "gid://shopify/ProductVariant/987654321",
      ],
      collection_reference: [
        "gid://shopify/Collection/123456789",
        "gid://shopify/Collection/987654321",
      ],
      customer_reference: [
        "gid://shopify/Customer/123456789",
        "gid://shopify/Customer/987654321",
      ],
      order_reference: [
        "gid://shopify/Order/123456789",
        "gid://shopify/Order/987654321",
      ],
      page_reference: [
        "gid://shopify/Page/123456789",
        "gid://shopify/Page/987654321",
      ],
      blog_reference: [
        "gid://shopify/Blog/123456789",
        "gid://shopify/Blog/987654321",
      ],
      company_reference: [
        "gid://shopify/Company/123456789",
        "gid://shopify/Company/987654321",
      ],
      metaobject_reference: [
        "gid://shopify/Metaobject/123456789",
        "gid://shopify/Metaobject/987654321",
      ],
    };

    const baseSamples: any = samples[baseType] || ["sample-1", "sample-2"];

    // LIST metafields → comma-separated (still CSV-safe)
    if (isList) {
      return [
        csvSafe(baseSamples.map((v: string) => v.replace(/^"|"$/g, "")).join(",")),
        csvSafe(baseSamples.map((v: string) => v.replace(/^"|"$/g, "")).reverse().join(",")),
      ];
    }

    return baseSamples;
  }

  function toJsonArrayString(value: string) {
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return JSON.stringify(parsed);
      } catch { }
    }
    if (Array.isArray(value)) return JSON.stringify(value);
    return JSON.stringify(String(value).split(",").map(v => v.trim()).filter(Boolean));
  }

  useEffect(() => {
    if (objectType === "product") setcsvType("Handle");
    if (objectType === "collection") setcsvType("Handle");
    if (objectType === "customer") setcsvType("Email");
    if (objectType === "order") setcsvType("Name");
    if (objectType === "blogPost") setcsvType("Handle");
    if (objectType === "productVariant") setcsvType("Sku");
    if (objectType === "market") setcsvType("Name");
    if (objectType === "company") setcsvType("External_ID");
    if (objectType === "companyLocation") setcsvType("External_ID");
    if (objectType === "location") setcsvType("Name");
    if (objectType === "page") setcsvType("Handle");
    if (objectType === "blog") setcsvType("Handle");

    if (["specific", "all", "update"].includes(removeMode)) {
      setSpecificField("Id");
    }
    setListUpdateMode("merge");
    setListRemoveMode("full");
    setHasSearched(false);
  }, [objectType, removeMode]);

  useEffect(() => {
    setCsvData(0);
    setCsvRows([]);
    setRawCsvData([]);
    setListUpdateMode("merge");
    setListRemoveMode("full");
    setProgress(0);
    setResults([]);
    setCompleted(false);
    setCurrentIndex(0);
    setAccumulatedResults([]);
    setFileName(null);
    setSpecificField("Id");
    setResourceCount(0);
    setAlert(prev => ({ ...prev, active: false }));
    setPaginationInfo(null);
    setSelectedBatch(null);
    setLoadingPagination(false);
    isFetchingPaginationInfoRef.current = false;
  }, [removeMode]);

  useEffect(() => {
    if (progress === 100 && !isDeleting && !hasUpdatedLimitRef.current) {
      const TrueResult = results.filter((r) => r?.success);

      if (!TrueResult.length) return;
      hasUpdatedLimitRef.current = true;

      let operation = "";
      let formattedResults: any[] = TrueResult;

      if (removeMode === "specific" && listRemoveMode === "partial") {
        operation = "Metafield-removed";
        formattedResults = TrueResult.map((r) => ({
          ...r,
          data: {
            namespace: r.namespace,
            key: r.key,
            type: r.type,
            value: toJsonArrayString(r.data),
          },
        }));
      }

      if (removeMode === "update") {
        operation = "Metafield-updated";
        formattedResults = TrueResult.map((r) => ({
          ...r,
          data: {
            namespace: r.namespace,
            key: r.key,
            type: r.type,
            value: r.value,
          },
        }));
      }

      if (
        removeMode === "all" ||
        (removeMode === "specific" && listRemoveMode !== "partial")
      ) {
        operation = "Metafield-removed";
        formattedResults = TrueResult.map((r) => {
          if (r.data && typeof r.data === "object" && !Array.isArray(r.data)) {
            return {
              ...r,
              namespace: r.data.namespace || r.namespace,
              key: r.data.key || r.key,
              value: r.data.value,
              type: r.data.type || r.type,
            };
          }
          return r;
        });
      }

      if (formattedResults.length > 0 && operation) {
        const Data = {
          operation,              // only operation
          objectType,             // only objectType
          value: formattedResults, // only value
        };

        if (plan !== "ADVANCED") {
          if (operation === "Metafield-removed" && removeMode !== "all") {
            removeMetaLimit(formattedResults?.length, planData);
          }
          if (operation === "Metafield-removed" && removeMode === "all") {
            globalMetaLimit(planData);
          }
          if (operation === "Metafield-updated") {
            updateMetaLimit(formattedResults?.length, planData);
          }
        }

        fetch("/api/add/db", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(Data),
        }).catch((err) => console.error("Logging error", err));
      }
    }
  }, [results, isDeleting, progress, plan, planData, removeMode, objectType]);


  useEffect(() => {
    setCsvData(0);
    setCsvRows([]);
    setRawCsvData([]);
    setProgress(0);
    setResults([]);
    setCompleted(false);
    setCurrentIndex(0);
    setAccumulatedResults([]);
    setFileName(null);
    setResourceCount(0);
    setSpecificField("Id")
    setAlert(prev => ({ ...prev, active: false }));
  }, [listRemoveMode, listUpdateMode]);

  useEffect(() => {
    setCsvData(0);
    setCsvRows([]);
    setRawCsvData([]);
    setProgress(0);
    setResults([]);
    setCompleted(false);
    setCurrentIndex(0);
    setAccumulatedResults([]);
    setFileName(null);
    setResourceCount(0);
    setAlert(prev => ({ ...prev, active: false }));
  }, [specificField]);

  function goToHome() {
    if (!(isDeleting)) navigate("/app");
  }
  return (
    <Page
      title="Metafield Manager"
      subtitle="Manage and sync custom field data across your store."
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
                  {/* Global Ops */}
                  <BlockStack gap="200">
                    <Text
                      variant="bodyXs"
                      tone="subdued"
                      fontWeight="bold"
                      as={"dd"}
                    >
                      GLOBAL OPS
                    </Text>
                    <Text variant="bodyMd" fontWeight="bold" as={"dd"}>
                      {
                        plan === "ADVANCED"
                          ? "Unlimited"
                          : (plan === "BASIC" || plan === "FREE")
                            ? (planData?.limits?.metaGlobal === Infinity
                              ? ""
                              : planData?.limits?.metaGlobal)
                            : 0
                      }

                    </Text>
                  </BlockStack>



                  {/* Update CSV Limit */}
                  <BlockStack gap="200">
                    <Text
                      variant="bodyXs"
                      tone="subdued"
                      fontWeight="bold"
                      as={"dd"}
                    >
                      UPDATE CSV
                    </Text>
                    <Text variant="bodyMd" fontWeight="bold" as={"dd"}>
                      {
                        plan === "ADVANCED"
                          ? "Unlimited"
                          : (plan === "BASIC" || plan === "FREE")
                            ? (planData?.limits?.metaUpdateCsvLimit === Infinity
                              ? ""
                              : planData?.limits?.metaUpdateCsvLimit)
                            : 0
                      }
                    </Text>
                  </BlockStack>

                  {/* Remove CSV Limit */}
                  <BlockStack gap="200">
                    <Text
                      variant="bodyXs"
                      tone="subdued"
                      fontWeight="bold"
                      as={"dd"}
                    >
                      REMOVE CSV
                    </Text>
                    <Text variant="bodyMd" fontWeight="bold" as={"dd"}>
                      {
                        plan === "ADVANCED"
                          ? "Unlimited"
                          : (plan === "BASIC" || plan === "FREE")
                            ? (planData?.limits?.metaRemoveCsvLimit === Infinity
                              ? ""
                              : planData?.limits?.metaRemoveCsvLimit)
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
                  onClick={() => setModalOpendb(true)}
                  disabled={isDeleting}
                >
                  Create Database
                </Button>
              </InlineStack>
            </Banner>
          </Box>
        )}
        <Layout>
          {/* --- LEFT COLUMN: CONFIGURATION --- */}
          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              <LegacyCard sectioned>
                <BlockStack gap="400">
                  <Select
                    label="Resource Type"
                    options={Object.entries(queryMap).map(([key]) => ({
                      label: key.charAt(0).toUpperCase() + key.slice(1),
                      value: key
                    }))}
                    value={objectType}
                    onChange={setObjectType}
                    disabled={loading || isDeleting || metafields.length > 0}
                  />
                  {metafields.length === 0 ? (
                    <Button
                      variant="primary"
                      onClick={fetchMetafields}
                      loading={loading}
                      disabled={isDeleting}
                      fullWidth
                      icon={SearchIcon}
                    >
                      Fetch Metafields
                    </Button>
                  ) : (
                    !completed && progress === 0 && !isDeleting && (
                      <Button
                        onClick={resetToHome}
                        fullWidth
                        icon={RefreshIcon}
                      >
                        Reset
                      </Button>
                    )
                  )}
                </BlockStack>
              </LegacyCard>
            </BlockStack>
          </Layout.Section>

          {/* --- RIGHT COLUMN: RESULTS & ACTIONS --- */}
          <Layout.Section>
            <BlockStack gap="500">
              {alert.active && (
                <Banner
                  title={alert.title}
                  tone={alert.tone || 'info'}
                  onDismiss={() => setAlert({ ...alert, active: false })}
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


              {/* 1. LOADING STATE */}
              {loading && !isDeleting && !completed && (
                <LegacyCard sectioned>
                  <BlockStack align="center" inlineAlign="center" gap="400">
                    <Spinner size="large" />
                    <Text as="h3" variant="headingMd">Scanning Store Metafields</Text>
                    <Text as="p" tone="subdued">Searching through your {objectType}s...</Text>
                  </BlockStack>
                </LegacyCard>
              )}

              {/* 2. COMPLETION STATE */}
              {completed && (
                <LegacyCard sectioned>
                  <BlockStack align="center" inlineAlign="center" gap="500">
                    <Badge tone="success" size="large" icon={CheckCircleIcon}>Operation Complete</Badge>
                    <Text as="p" variant="bodyLg">The metafield operation finished successfully.</Text>

                    <BlockStack gap="200" align="center" inlineAlign="center">
                      <div style={{ width: '100%', minWidth: '300px' }}>
                        <ProgressBar progress={100} tone="success" />
                      </div>
                      <Text as="span" variant="bodyMd" fontWeight="bold">100%</Text>
                    </BlockStack>

                    <InlineStack gap="300">
                      {results?.length > 0 && (
                        <Button onClick={() => downloadResultsCSV(results, removeMode)} variant="primary" icon={FileIcon}>
                          Download Results CSV
                        </Button>
                      )}
                      <Button onClick={resetToHome}>Clear</Button>
                    </InlineStack>
                  </BlockStack>
                </LegacyCard>
              )}

              {/* 3. EMPTY STATE / READY TO SEARCH */}
              {!loading && !completed && metafields.length === 0 && !hasSearched && (
                <LegacyCard sectioned>
                  <EmptyState
                    heading="Ready to Search"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>Select a resource type on the left and click "Fetch Metafields".</p>
                  </EmptyState>
                </LegacyCard>
              )}

              {/* 4. NO METAFIELDS FOUND */}
              {!loading && !completed && metafields.length === 0 && hasSearched && (
                <Banner title="No Metafields Found" tone="info">
                  <p>Try selecting a different resource type.</p>
                </Banner>
              )}

              {(!loading || isDeleting) && !completed && metafields.length > 0 && !selectedMetafield && (
                <LegacyCard>
                  <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                    <ResourceList
                      resourceName={{ singular: 'metafield', plural: 'metafields' }}
                      items={metafields}
                      renderItem={(item: MetafieldDefinition) => {
                        const { namespace, key, type } = item;
                        const media = <Icon source={NoteIcon} tone="base" />;

                        return (
                          <ResourceItem
                            id={`${namespace}-${key}`}
                            url="#"
                            media={media}
                            accessibilityLabel={`Select ${namespace}.${key}`}
                            onClick={() => handleMetafieldSelection(item)}
                          >
                            <BlockStack gap="100">
                              <InlineStack gap="200" align="start">
                                <Text as="h3" variant="headingSm" fontWeight="bold">
                                  {key}
                                </Text>
                                <Badge tone="info">{namespace}</Badge>
                              </InlineStack>
                              <Text as="span" tone="subdued" variant="bodySm">
                                Type: {typeof type === 'string' ? type : (type as any)?.name || "Standard"}
                              </Text>
                            </BlockStack>
                          </ResourceItem>
                        );
                      }}
                    />
                  </div>
                </LegacyCard>
              )}

              {/* 6A. PROCESSING STATE */}
              {isDeleting && (
                <LegacyCard sectioned>
                  <BlockStack gap="600" align="center" inlineAlign="center">
                    {/* Header Section */}
                    <BlockStack gap="200" align="center" inlineAlign="center">
                      <div style={{ marginBottom: "8px" }}>
                        <Spinner size="large" />
                      </div>
                      <Text as="h2" variant="headingLg">
                        {removeMode === 'update' ? "Updating Metafields" :
                          removeMode === 'specific' ? "Removing Specific Metafields" :
                            "Deleting Metafields Globally"}
                      </Text>
                      <Text as="p" tone="subdued" alignment="center">
                        {removeMode === 'all'
                          ? "We're processing your request. This may take a moment."
                          : "Please keep this browser tab open until the process is complete."}
                      </Text>
                    </BlockStack>

                    {/* Progress & Stats Section */}
                    <Box width="100%" maxWidth="400px">
                      <BlockStack gap="400">
                        {removeMode !== "all" && (
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
                        )}

                        {/* Data Counter - Clean Minimalist Style */}
                        <Box
                          background="bg-surface-secondary"
                          padding="300"
                          borderRadius="200"
                        >
                          <InlineStack align="center">
                            <Text as="p" variant="bodySm" tone="subdued">
                              <strong>
                                {removeMode === 'all'
                                  ? results?.length.toLocaleString()
                                  : `${results?.length.toLocaleString() || 0} / ${csvRows.length.toLocaleString()}`}
                              </strong>
                              {removeMode === 'all'
                                ? " items processed"
                                : " items processed"}
                            </Text>
                          </InlineStack>
                        </Box>
                      </BlockStack>
                    </Box>
                  </BlockStack>
                </LegacyCard>
              )}

              {/* 6B. CONFIGURE & RUN OPERATION */}
              {!loading && !isDeleting && !completed && selectedMetafield && (
                <LegacyCard sectioned>
                  <BlockStack gap="500">
                    <InlineStack align="space-between">
                      <Text as="p" variant="headingSm" tone="subdued">
                        Target: {selectedMetafield?.namespace}.{selectedMetafield?.key}
                      </Text>
                      <Button variant="plain" onClick={backToSelectedFeild}>Change Selection</Button>
                    </InlineStack>

                    {/* Modes */}
                    <ChoiceList
                      title="Operation Mode"
                      choices={(typeof selectedMetafield?.type === 'string' ? selectedMetafield.type : selectedMetafield?.type?.name) === 'file_reference' ? [
                        { label: `Global Deletion (from ${plan === "FREE" ? 100 : plan === "BASIC" ? 250 : 5000} records at a time)`, value: 'all' }] :
                        [
                          { label: `Global Deletion (from ${plan === "FREE" ? 100 : plan === "BASIC" ? 250 : 5000} records at a time)`, value: 'all' },
                          { label: 'Targeted Removal (from CSV)', value: 'specific' },
                          { label: 'Bulk Update (Update/Add via CSV)', value: 'update' }
                        ]}
                      selected={[removeMode]}
                      onChange={(val) => setRemoveMode(val[0])}
                      disabled={isDeleting}
                    />

                    {/* Sub-configuration for Specific/Update */}
                    {removeMode !== 'all' && (
                      <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                        <BlockStack gap="400">
                          {showInfoMeta && (
                            <Banner tone="info">
                              <p>{showInfo}</p>
                            </Banner>
                          )}
                          {/* List Handling Options */}
                          {(typeof selectedMetafield?.type === 'string' ? selectedMetafield.type : selectedMetafield?.type?.name)?.startsWith("list.") && (
                            <BlockStack gap="200">
                              <Text as="h3" variant="headingSm">List Strategy</Text>
                              {removeMode === "specific" ? (
                                <ChoiceList
                                  title=""
                                  choices={[
                                    { label: 'Delete Metafield Completely', value: 'full' },
                                    { label: 'Remove Specific Values', value: 'partial' }
                                  ]}
                                  selected={[listRemoveMode]}
                                  onChange={(val) => setListRemoveMode(val[0])}
                                />
                              ) : (
                                <ChoiceList
                                  title=""
                                  choices={[
                                    { label: 'Merge/Append Values', value: 'merge' },
                                    { label: 'Replace Entire List', value: 'replace' }
                                  ]}
                                  selected={[listUpdateMode]}
                                  onChange={(val) => setListUpdateMode(val[0])}
                                />
                              )}
                            </BlockStack>
                          )}

                          {/* CSV Upload Section */}
                          {csvData === 0 ? (
                            <BlockStack gap="300">
                              <BlockStack gap="200">
                                <ChoiceList
                                  title="Match by"
                                  choices={[
                                    { label: 'Shopify GID', value: 'Id' },
                                    { label: csvType, value: csvType }
                                  ]}
                                  selected={[specificField]}
                                  onChange={(val) => setSpecificField(val[0])}
                                />
                                <Button variant="plain" onClick={handleDownloadTemplate} icon={ImportIcon}>Download Sample CSV</Button>
                              </BlockStack>

                              <DropZone onDrop={handleCsvInput} accept=".csv" allowMultiple={false} disabled={isDeleting}>
                                <DropZone.FileUpload actionTitle="Add CSV File" />
                              </DropZone>
                              <Text as="p" tone="subdued">Only {plan === "FREE" ? 100 : plan === "BASIC" ? 250 : 5000} records will be processed at a time</Text>
                            </BlockStack>
                          ) : (
                            <Banner tone="success" onDismiss={handleClearCSV}>
                              <InlineStack align="space-between">
                                <Text as="span">{fileName} — {csvData} records loaded.</Text>
                              </InlineStack>
                            </Banner>
                          )}
                        </BlockStack>
                      </Box>
                    )}

                    <Button
                      variant="primary"
                      tone={removeMode === 'update' ? undefined : 'critical'}
                      disabled={isDeleting || loading || (removeMode !== 'all' && !csvRows.length)}
                      onClick={confirmDelete}
                      fullWidth
                      icon={removeMode === 'update' ? RefreshIcon : DeleteIcon}
                    >
                      {removeMode === 'update' ? "Run Update" : "Delete Metafield"}
                    </Button>

                  </BlockStack>
                </LegacyCard>
              )}

              {/* 7. LIVE LOGS */}
              {results?.length > 0 && removeMode !== "all" && (
                <LegacyCard sectioned>
                  <BlockStack gap="400">
                    <InlineStack align="space-between">
                      <Text as="h3" variant="headingSm">Activity Log</Text>
                      <Badge>{`${results?.length} processed`}</Badge>
                    </InlineStack>
                    <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                      <IndexTable
                        resourceName={{ singular: 'result', plural: 'results' }}
                        itemCount={results?.length}
                        headings={[{ title: '#' }, { title: 'Identifier' }, { title: 'Status' }, { title: 'Error' }]}
                        selectable={false}
                      >
                        {[...results].reverse().map((r, i) => (
                          <IndexTable.Row key={i} id={i.toString()} position={i}>
                            <IndexTable.Cell>{results?.length - i}</IndexTable.Cell>
                            <IndexTable.Cell>{r?.id}</IndexTable.Cell>
                            <IndexTable.Cell>
                              <Badge tone={r?.success ? 'success' : 'critical'}>{r?.success ? 'Success' : 'Failed'}</Badge>
                            </IndexTable.Cell>
                            <IndexTable.Cell>{r?.error || r?.errors || '-'}</IndexTable.Cell>
                          </IndexTable.Row>
                        ))}
                      </IndexTable>
                    </div>
                  </BlockStack>
                </LegacyCard>
              )}
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>

      {/* CREATE DB MODAL */}
      <Modal
        open={modalOpendb}
        onClose={() => setModalOpendb(false)}
        title="Create Database"
        primaryAction={{
          content: "Yes, Create",
          onAction: createDatabase,
          loading: isSubmitting,
        }}
        secondaryActions={[
          {
            content: "Maybe Later",
            onAction: () => setModalOpendb(false),
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

      <CsvPreviewModal
        open={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        onConfirm={() => {
          setPreviewModalOpen(false);
          handleConfirm();
        }}
        data={rawCsvData}
        title={removeMode === "update" ? "Confirm Metafield Update" : "Confirm Metafield Deletion"}
        confirmText={removeMode === "update" ? "Update" : "Delete"}
        destructive={removeMode !== 'update'}
        confirmationMessage={
          removeMode === "update"
            ? `This metafield will be updated/added for the selected ${specificField}'s in the CSV. Only valid records will be processed.`
            : `This metafield will be deleted only for the selected ${specificField}'s in the CSV. Only valid records will be processed.`
        }
      />

      <Modal
        open={modalOpen}
        onClose={handleCloseModal}
        title={removeMode === "update" ? "Confirm Metafield Update" : "Confirm Metafield Deletion"}
        primaryAction={{
          content: removeMode === "update" ? "Update" : "Delete",
          onAction: handleConfirm,
          destructive: removeMode !== 'update',
          disabled: removeMode === "all" && (loadingPagination || !paginationInfo || !selectedBatch),
        }}
        secondaryActions={[{ content: "Cancel", onAction: handleCloseModal }]}
      >
        <Modal.Section>
          {removeMode === "all" ? (
            loadingPagination ? (
              <BlockStack align="center" inlineAlign="center" gap="200">
                <Spinner size="large" />
                <Text as="p" tone="subdued">
                  Loading total counts and pages..
                </Text>
              </BlockStack>
            ) : paginationInfo ? (
              <BlockStack gap="400">
                <Text as="p">
                  This metafield will be deleted across the selected  {
                    plan === "FREE"
                      ? "100"
                      : plan === "BASIC"
                        ? "250"
                        : "5,000"
                  } records/pages.
                </Text>
                <Text as="p">
                  Total {objectType}s: <Text as="span" fontWeight="bold">{paginationInfo.totalCount.toLocaleString()}</Text>
                </Text>
                <Text as="p">
                  Select a batch:
                </Text>

                <Box background="bg-surface-secondary" borderRadius="200" padding="200">
                  <ResourceList
                    resourceName={{ singular: "batch", plural: "batches" }}
                    items={paginationInfo.pages}
                    renderItem={(item) => {
                      const isSelected = selectedBatch?.page === item.page;
                      return (
                        <ResourceItem
                          id={String(item.page)}
                          onClick={() => setSelectedBatch(item)}
                          verticalAlignment="center"
                        >
                          <InlineStack align="space-between">
                            <BlockStack gap="100">
                              <Text as="span" variant="bodyMd" fontWeight={isSelected ? "bold" : "regular"}>
                                Page {item.page} (Records {item.start.toLocaleString()} - {item.end.toLocaleString()})
                              </Text>
                            </BlockStack>
                            {isSelected && (
                              <Badge tone="success">Selected</Badge>
                            )}
                          </InlineStack>
                        </ResourceItem>
                      );
                    }}
                  />
                </Box>
              </BlockStack>
            ) : (
              <Text as="p" tone="critical">
                Failed to load pagination information. Please try again.
              </Text>
            )
          ) : removeMode === "update" ? (
            <Text as="p">
              This metafield will be updated/added for the selected {specificField}'s in the CSV.
            </Text>
          ) : (
            <Text as="p">
              This metafield will be deleted only for the selected {specificField}'s in the CSV.
            </Text>
          )}
        </Modal.Section>
      </Modal>
      <MetafieldManageInstructionsModal
        open={instructionsOpen}
        onClose={() => setInstructionsOpen(false)}
      />
    </Page>
  );
}

export function ErrorBoundary() {
  return <RouteErrorBoundary routeName="Metafield Manager" />;
}

