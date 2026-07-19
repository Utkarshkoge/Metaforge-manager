import { useState, useEffect, useCallback, useRef } from "react";
import type { KeyboardEvent } from "react";
import { useFetcher, useNavigate, useOutletContext, useBlocker } from "react-router";
import { authenticate } from "../shopify.server";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  handleFetch,
  handleRemoveFromAll,
  handleRemoveSpecific,
  handleFetchCount,
} from "app/functions/remove-tag-action";
import Papa from "papaparse";
import CsvPreviewModal from "../component/CsvPreviewModal";
import { RemoveTagsInstructionsModal } from "../component/InstructionsModal";
import {
  Page,
  Layout,
  LegacyCard,
  Select,
  TextField,
  Button,
  Banner,
  BlockStack,
  DropZone,
  IndexTable,
  Text,
  Badge,
  Box,
  InlineStack,
  ProgressBar,
  Modal,
  Spinner,
  EmptyState,
  ChoiceList,
  ButtonGroup,
  useBreakpoints,
  Icon,
} from "@shopify/polaris";
import { DatabaseIcon, PlusIcon, XIcon, ClockIcon, CreditCardIcon } from "@shopify/polaris-icons";
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

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();
    const mode = formData.get("mode");

    if (mode === "fetch") {
      return await handleFetch(admin, formData);
    }
    if (mode === "fetch-count") {
      return await handleFetchCount(admin, formData);
    }
    if (mode === "remove-global") {
      return await handleRemoveFromAll(admin, formData);
    }
    if (mode === "remove-specific") {
      return await handleRemoveSpecific(admin, formData);
    }

    return { error: "Invalid mode" };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Something went wrong in the action handler.",
    };
  }
};


type AppOutletContext = {
  planData: any;
};

export default function TagManager() {
  const fetcher = useFetcher();
  const countFetcher = useFetcher();
  const navigate = useNavigate();
  const breakpoints = useBreakpoints();
  const { planData } = useOutletContext<AppOutletContext>();

  // State
  const [objectType, setObjectType] = useState("product");
  const [matchingCount, setMatchingCount] = useState<number | null>(null);
  const [isCountFetching, setIsCountFetching] = useState(false);
  const isFetchingCount = isCountFetching || (countFetcher.state !== "idle" && countFetcher.formData?.get("mode") === "fetch-count");
  const [matchType, setMatchType] = useState("contain");
  const [conditions, setConditions] = useState([{ tag: "", operator: "OR" }]);
  const [fetchedItems, setFetchedItems] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [removalMode, setRemovalMode] = useState<"global" | "specific">(
    "global",
  );
  const [csvIds, setCsvIds] = useState<string[]>([]);

  // Modals & Alerts
  const [modalOpen, setModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [rawCsvData, setRawCsvData] = useState<any[]>([]);
  const [alert, setAlert] = useState<{
    active: boolean;
    title: string;
    message: string;
    tone?: "critical" | "success";
  }>({
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

  const updateTagRemoveCsvLimit = (
    tagRemoveCsvCount: number,
    planData: any,
  ) => {
    fetcher.submit(
      {
        plan: planData?.plan,
        updates: {
          tagRemoveCsvLimit:
            planData?.limits?.tagRemoveCsvLimit - tagRemoveCsvCount,
        },
      },
      {
        method: "POST",
        encType: "application/json",
        action: "/api/update/plan",
      },
    );
  };

  const updateTagGlobalLimit = (planData: any) => {
    fetcher.submit(
      {
        plan: planData?.plan,
        updates: {
          tagGlobal: planData?.limits?.tagGlobal - 1,
        },
      },
      {
        method: "POST",
        encType: "application/json",
        action: "/api/update/plan",
      },
    );
  };


  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [noTagsFound, setNoTagsFound] = useState(false);
  const [specificField, setSpecificField] = useState("Id");
  const [csvType, setCsvType] = useState("Id"); // Default for product
  const [currentrow, setcurrentrow] = useState<string>();
  const [allFetchedTags, setAllFetchedTags] = useState<string[]>([]);
  const [isFetchingTags, setIsFetchingTags] = useState(false);

  // Results
  const [finalSpecificResults, setFinalSpecificResults] = useState<any[]>([]);
  const [csvIndex, setCsvIndex] = useState(1);
  const [search, setSearch] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [specificEnd, setSpecificEnd] = useState(false);
  const lastProcessedRef = useRef<any>(null);
  const hasUpdatedLimitRef = useRef(false);

  // Global Results
  const [globalResult, setGlobalResult] = useState({
    results: [],
    totalProcessed: 0,
    success: true,
    complete: false,
    nextCursor: null,
  });

  const emptyGlobalState = {
    results: [],
    totalProcessed: 0,
    success: true,
    complete: false,
    nextCursor: null,
    mode: null,
  };


  // ---- STATE ----
  const [isDbCreated, setIsDbCreated] = useState(false);
  const [dbChecked, setDbChecked] = useState(false); // 👈 critical
  const [modalOpendb, setModalOpendb] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const isFetching = fetcher.state !== "idle" && fetcher.formData?.get("mode") === "fetch";
  const isActionDisabled = isRemoving;


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

  // -- Helpers --
  function filterTagsBasedOnConditions(
    allTags: string[],
    conditions: any[],
    matchType: string,
  ) {
    if (!conditions?.length) return allTags;

    const match = (tag: string, cond: any) => {
      const value = cond.tag.trim().toLowerCase();
      const t = tag.toLowerCase();
      switch (matchType) {
        case "exact":
          return t === value;
        case "start":
          return t.startsWith(value);
        case "end":
          return t.endsWith(value);
        default:
          return t.includes(value);
      }
    };

    let result = allTags.filter((tag) => match(tag, conditions[0]));
    for (let i = 1; i < conditions.length; i++) {
      const cond = conditions[i];
      if (cond.tag === "") continue;
      if (cond.operator === "AND") {
        result = result.filter((tag) => match(tag, cond));
      } else {
        const matches = allTags.filter((tag) => match(tag, cond));
        result = Array.from(new Set([...result, ...matches]));
      }
    }
    return result;
  }

  function startFetchTags() {
    setAllFetchedTags([]);
    setFetchedItems([]);
    setNoTagsFound(false);
    setIsFetchingTags(true);
    setSearch(true);
    setRemovalMode("global");

    if (objectType === "product") setCsvType("Sku");
    else if (objectType === "customer") setCsvType("Email");
    else if (objectType === "order") setCsvType("Name");
    else if (objectType === "article") setCsvType("Handle");

    const last = conditions[conditions.length - 1];
    if (last && last.tag.trim() === "") return;

    const lastTag = last.tag.trim();
    const isDuplicate = conditions.some(
      (c, idx) =>
        idx !== conditions.length - 1 &&
        c.tag.trim().toLowerCase() === lastTag.toLowerCase(),
    );

    if (isDuplicate) {
      setAlert({
        active: true,
        title: "Duplicate Tag",
        message: `The tag "${lastTag}" is already added.`,
        tone: "critical",
      });
      return;
    }
    setSpecificField("Id");
    setFileName(null);
    setAlert((prev) => ({ ...prev, active: false }));
    const fd = new FormData();
    fd.append("mode", "fetch");
    fd.append("objectType", objectType);
    fetcher.submit(fd, { method: "POST" });
  }

  // UseEffects for Fetching Logic
  useEffect(() => {
    if (!isFetchingTags && allFetchedTags.length > 0) {
      const uniqueTags = Array.from(new Set(allFetchedTags));
      const filtered = filterTagsBasedOnConditions(
        uniqueTags,
        conditions,
        matchType,
      );
      setFetchedItems(filtered);
      setNoTagsFound(filtered.length === 0);
    }
    if (search && allFetchedTags.length === 0) {
      setNoTagsFound(true);
    }
  }, [isFetchingTags]);

  useEffect(() => {
    if (removalMode === "global" && selectedTags.length > 0 && matchingCount === null && !isCountFetching) {
      setIsCountFetching(true);
      const fd = new FormData();
      fd.append("mode", "fetch-count");
      fd.append("objectType", objectType);
      fd.append("tags", JSON.stringify(selectedTags));
      countFetcher.submit(fd, { method: "POST" });
    }
  }, [removalMode, selectedTags, objectType, matchingCount, isCountFetching]);

  useEffect(() => {
    if (countFetcher.data && countFetcher.state === "idle") {
      const returnedTags = countFetcher.data.tags || [];
      const returnedType = countFetcher.data.objectType;
      const currentTagsSorted = [...selectedTags].sort().join(",");
      const returnedTagsSorted = [...returnedTags].sort().join(",");

      if (currentTagsSorted === returnedTagsSorted && returnedType === objectType) {
        if (countFetcher.data.success) {
          setMatchingCount(countFetcher.data.count);
        } else {
          setAlert({
            active: true,
            title: "Failed to Fetch Count",
            message: countFetcher.data.error || "Failed to fetch matching resource count.",
            tone: "critical",
          });
        }
        setIsCountFetching(false);
      }
    }
  }, [countFetcher.data, countFetcher.state, selectedTags, objectType]);

  useEffect(() => {
    setMatchingCount(null);
    setIsCountFetching(false);
  }, [selectedTags, conditions, objectType, matchType]);

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (lastProcessedRef.current === fetcher.data) return;
    lastProcessedRef.current = fetcher.data;

    const data = fetcher.data;
    if (fetcher.data?.successdb === undefined) {

      // Fetch Mode
      if (data.mode === "fetch" && data.success) {
        setAllFetchedTags((prev) => [...prev, ...data.tags]);
        if (data.hasNextPage) {
          const fd = new FormData();
          fd.append("mode", "fetch");
          fd.append("objectType", objectType);
          fd.append("cursor", data.nextCursor);
          fetcher.submit(fd, { method: "POST" });
        } else {
          setRemovalMode("global");
          setIsFetchingTags(false);
        }
      }

      // Specific Remove Mode
      if (data.mode === "remove-specific") {

        const updatedResults = data.results.map((item: any) => ({
          ...item,
          row: currentrow,
        }));
        setFinalSpecificResults((prev) => [...prev, ...updatedResults]);
        const nextIndex = csvIndex + 1;
        if (nextIndex < csvIds.length) {
          setCsvIndex(nextIndex);
          setcurrentrow(csvIds[nextIndex]);
          const fd = new FormData();
          fd.append("mode", "remove-specific");
          fd.append("tags", JSON.stringify(selectedTags));
          fd.append("row", JSON.stringify(csvIds[nextIndex]));
          fd.append("flag", JSON.stringify(specificField === "Id"));
          fd.append("resource", JSON.stringify(objectType));
          fetcher.submit(fd, { method: "POST" });
        } else {
          setSpecificEnd(true);
          setIsRemoving(false);
        }
        return;
      }

      // Global Remove Mode
      if (data.mode === "remove-global") {
        const currentProcessed = globalResult.results.length + (data.results?.length || 0);
        const maxGlobalItems = plan === "FREE" ? 50 : plan === "BASIC" ? 100 : 5000;
        const limitReached = currentProcessed >= maxGlobalItems;

        setGlobalResult((prev: any) => {
          const merged = [...prev.results, ...(data.results || [])];
          return {
            ...prev,
            mode: "remove-global",
            results: merged,
            totalProcessed: merged.length,
            success: prev.success && data.success,
            complete: !data.hasNextPage || limitReached,
            nextCursor: data.nextCursor || null,
          };
        });
        if (data.hasNextPage && !limitReached) {
          const fd = new FormData();
          fd.append("objectType", objectType);
          fd.append("tags", JSON.stringify(selectedTags));
          fd.append("mode", "remove-global");
          fd.append("cursor", data.nextCursor);
          setTimeout(() => {
            fetcher.submit(fd, { method: "POST" });
          }, 100);
        } else {
          setIsRemoving(false);
        }
        return;
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
  }, [fetcher.state, fetcher.data]);

  // Prevent unload during removal
  // Logging
  useEffect(() => {
    let results = [];
    if (globalResult.complete && globalResult.results.length > 0) {
      results = globalResult.results;
    }

    if (specificEnd && finalSpecificResults.length > 0) {
      const successRows = finalSpecificResults.filter((r) => r.success);
      if (successRows.length > 0) results = successRows;
    }

    if (results.length > 0 && !hasUpdatedLimitRef.current) {
      hasUpdatedLimitRef.current = true;
      if (plan !== "ADVANCED") {
        if (removalMode === "global") {
          updateTagGlobalLimit(planData);
        } else {
          updateTagRemoveCsvLimit(results.length, planData);
        }
      }
      const Data = {
        operation: "Tags-removed", // only operation
        objectType: objectType === "article" ? "blogPost" : objectType, // only objectType
        value: results, // only value
      };

      fetch("/api/add/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Data),
      }).catch((err) => console.error("Logging error", err));
    }
  }, [specificEnd, globalResult.results, plan, planData, removalMode, objectType]);

  useBlocker(({ currentLocation, nextLocation }) => {
    return isRemoving && currentLocation.pathname !== nextLocation.pathname;
  });

  useEffect(() => {
    if (!isRemoving) return;

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
  }, [isRemoving]);


  useEffect(() => {
    if (selectedTags.length === 0) {
      setCsvIds([]);
      setFileName(null);
      setAlert((prev) => ({ ...prev, active: false }));
    }
  }, [selectedTags]);

  // Logic helpers
  const handleClearCSV = () => {
    setCsvIds([]);
    setRawCsvData([]);
    setFileName(null);
  };

  const handleCsvInput = useCallback(
    (_dropFiles: File[], acceptedFiles: File[], _rejectedFiles: File[]) => {
      if (remainingDays === 0) {
        setAlert({
          active: true,
          title: "Plan Expired",
          message: "Your plan has expired (0 days remaining). Please upgrade your subscription to continue.",
          tone: "critical",
        });
        setWarning((prev) => ({ ...prev, active: false }));
        handleClearCSV();
        return;
      }

      const file = acceptedFiles[0];
      if (!file) {
        handleClearCSV();
        return;
      }
      setFileName(file.name);
      const normalizedField = specificField.toLowerCase();

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.toLowerCase().trim(),
        complete: (res) => {
          // Strict column validation
          const headers = res.meta.fields?.map((h: string) => h.trim().toLowerCase()) || [];
          const expectedHeaders = [normalizedField];
          const extraHeaders = headers.filter((h: string) => !expectedHeaders.includes(h));

          if (extraHeaders.length > 0) {
            setAlert({
              active: true,
              title: "Invalid CSV Format",
              message: `The CSV contains extra columns: ${extraHeaders.join(', ')}. Only the '${specificField}' column is allowed.`,
              tone: "critical",
            });
            handleClearCSV();
            return;
          }

          const values = res.data
            .map((row: any) => {
              const rawValue = row[normalizedField];
              const id = typeof rawValue === "string" ? rawValue.trim() : null;
              if (!id) return null;


              return id;
            })
            .filter(Boolean);


          const maxCsvRows = plan === "FREE" ? 50 : plan === "BASIC" ? 100 : 5000;
          if (values.length > maxCsvRows) {
            setAlert({
              active: true,
              title: "Limit Exceeded",
              message: `Your plan allows removing tags from up to ${maxCsvRows} records at a time. Please upgrade your plan to add more.`,
              tone: "critical",
            });
            setWarning((prev) => ({ ...prev, active: false }));
            handleClearCSV();
            return;
          }

          if (
            values.length > planData?.limits?.tagRemoveCsvLimit &&
            plan !== "ADVANCED"
          ) {
            setWarning({
              active: true,
              title: "Limit Exceeded",
              message: `You only have access to add ${planData?.limits?.tagRemoveCsvLimit} csv entries remaining according to your plan. Please update your plan to add more.`,
              tone: "warning",
            });
            setAlert((prev) => ({ ...prev, active: false }));
            handleClearCSV();
            return;
          }

          if (values.length === 0) {
            setAlert({
              active: true,
              title: "Valid Record Not Found",
              message:
                "No valid records found in the CSV file. Please follow the CSV Format",
              tone: "critical",
            });
            setWarning((prev) => ({ ...prev, active: false }));
            handleClearCSV();
            return;
          }

          setCsvIds(values as string[]);
          setRawCsvData(res.data);
          setAlert((prev) => ({ ...prev, active: false }));
          setWarning((prev) => ({ ...prev, active: false }));
        },
        error: (err) => {
          setAlert({
            active: true,
            title: "Parsing Error",
            message: "Failed to parse CSV file.",
            tone: "critical",
          });
          handleClearCSV();
        },
      });
    },
    [specificField, objectType, planData, plan],
  );

  const downloadResultCSV = () => {
    let result: any[] = [];
    let header = "";
    let rows: string[] = [];

    if (removalMode === "global") {
      result = globalResult?.results || [];
      header = ["Id", "Tags", "Success", "Error"].join(",") + "\n";
      rows = result.map((r) => {
        const id = r.id || "";
        const removedTags = Array.isArray(r.removedTags)
          ? r.removedTags.join(", ")
          : "";
        const success = r.success ? "true" : "false";
        const error = r.error || "";
        return `"${id}","${removedTags}","${success}","${error}"`;
      });
    } else {
      result = finalSpecificResults;
      header = [specificField, "Tags", "Success", "Error"].join(",") + "\n";
      rows = result.map((r) => {
        const id = r.row || "";
        const removedTags = Array.isArray(r.removedTags)
          ? r.removedTags.join(", ")
          : "";
        const success = r.success ? "true" : "false";
        const error = r.error || "";
        return `"${id}","${removedTags}","${success}","${error}"`;
      });
    }
    const csvContent = header + rows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tag-removal-results-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadTemplate = () => {
    const header = specificField === "Id" ? "Id" : csvType;
    let sampleValues: string[] = [];
    if (header === "Id") {
      // Simplified GID logic
      const t = objectType.charAt(0).toUpperCase() + objectType.slice(1);
      sampleValues = [`gid://shopify/${t}/123456789`];
    } else if (header === "Sku") sampleValues = ["SKU-1"];
    else if (header === "Email") sampleValues = ["example@mail.com"];
    else if (header === "Name") sampleValues = ["#1001"];
    else if (header === "Handle") sampleValues = ["handle-1"];

    const csvContent = [header, ...sampleValues].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([csvContent], { type: "text/csv;charset=utf-8;" }),
    );
    link.download = `sample-${header}-template.csv`;
    link.click();
  };

  const handleRemoveConfirm = () => {
    // Always close modal at the end
    setModalOpen(false);
    setMatchingCount(null);
    setIsCountFetching(false);
    hasUpdatedLimitRef.current = false;

    // GLOBAL REMOVE
    if (removalMode === "global") {
      if (planData?.limits?.tagGlobal === 0 && plan !== "ADVANCED") {
        setWarning({
          active: true,
          title: "Limit Exceeded",
          message:
            "Your global tag removal limit has been reached. Please upgrade your plan to continue.",
          tone: "warning",
        });
        setAlert((prev) => ({ ...prev, active: false }));
        return; // ⛔ stop execution, no submit
      }

      if (remainingDays === 0) {
        setAlert({
          active: true,
          title: "Plan Expired",
          message: "Your plan has expired (0 days remaining). Please upgrade your subscription to continue.",
          tone: "critical",
        });
        setWarning((prev) => ({ ...prev, active: false }));
        handleClearCSV();
        return;
      }

      setIsRemoving(true);
      setFinalSpecificResults([]);
      setGlobalResult(emptyGlobalState);

      const fd = new FormData();
      fd.append("objectType", objectType);
      fd.append("tags", JSON.stringify(selectedTags));
      fd.append("mode", "remove-global");

      fetcher.submit(fd, { method: "POST" });
      return;
    }


    // SPECIFIC REMOVE
    setIsRemoving(true);
    setFinalSpecificResults([]);
    setGlobalResult(emptyGlobalState);

    const fd = new FormData();
    fd.append("objectType", objectType);
    fd.append("tags", JSON.stringify(selectedTags));
    fd.append("mode", "remove-specific");

    setCsvIndex(0);
    setcurrentrow(csvIds[0]);

    fd.append("row", JSON.stringify(csvIds[0]));
    fd.append("flag", JSON.stringify(specificField === "Id"));
    fd.append("resource", JSON.stringify(objectType));

    fetcher.submit(fd, { method: "POST" });
  };

  const resetAll = () => {
    setConditions([{ tag: "", operator: "OR" }]);
    setFetchedItems([]);
    setSelectedTags([]);
    setCsvIds([]);
    setRawCsvData([]);
    setGlobalResult(emptyGlobalState);
    setFinalSpecificResults([]);
    setNoTagsFound(false);
    setIsRemoving(false);
    setSpecificField("Id");
    setRemovalMode("global");
    setSpecificEnd(false);
    setSearch(false);
    setFileName(null);
    setAlert((prev) => ({ ...prev, active: false }));
    hasUpdatedLimitRef.current = false;
    setMatchingCount(null);
  };

  useEffect(() => {
    if (removalMode === "global") {
      setSpecificField("Id");
      setCsvIds([]);
      setRawCsvData([]);
      setGlobalResult(emptyGlobalState);
      setFinalSpecificResults([]);
      setNoTagsFound(false);
      setIsRemoving(false);
      setSearch(false);
      setFileName(null);
    }
    setCsvIds([]);
    setRawCsvData([]);
    setFileName(null);
    setAlert((prev) => ({ ...prev, active: false }));

  }, [removalMode, specificField]);

  // Condition Inputs
  const addCondition = () => {
    const last = conditions[conditions.length - 1];
    if (last && last.tag.trim() === "") return;

    const lastTag = last.tag.trim();
    const isDuplicate = conditions.some(
      (c, idx) =>
        idx !== conditions.length - 1 &&
        c.tag.trim().toLowerCase() === lastTag.toLowerCase(),
    );

    if (isDuplicate) {
      setAlert({
        active: true,
        title: "Duplicate Tag",
        message: `The tag "${lastTag}" is already added.`,
        tone: "critical",
      });
      return;
    }
    setAlert((prev) => ({ ...prev, active: false }));
    setConditions((prev) => [...prev, { tag: "", operator: "OR" }]);
  };
  const updateCondition = (i: number, field: string, val: string) => {
    setConditions((prev) =>
      prev.map((c, idx) => (idx === i ? { ...c, [field]: val } : c)),
    );
    setGlobalResult(emptyGlobalState);
    setFinalSpecificResults([]);
  };
  const removeCondition = (i: number) =>
    setConditions((prev) => prev.filter((_, idx) => idx !== i));
  const validTagsEntered = conditions.filter((c) => c.tag.trim().length >= 2);
  const readyToFetch =
    validTagsEntered.length > 0 &&
    conditions.every(
      (c) => c.tag.trim().length === 0 || c.tag.trim().length >= 2,
    );
  const readyToAdd = conditions.every(
    (c) => c.tag.trim().length === 0 || c.tag.trim().length >= 2,
  );

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!isActionDisabled && readyToFetch && fetchedItems.length === 0) {
        startFetchTags();
      }
    }
  };

  function goToHome() {
    if (!isRemoving) navigate("/app");
  }

  // Render
  return (
    <Page
      title="Remove Tags"
      subtitle="Search for tags and remove them globally or from specific items."
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
                            ? (planData?.limits?.tagRemoveCsvLimit === Infinity
                              ? ""
                              : planData?.limits?.tagRemoveCsvLimit)
                            : 0
                      }

                    </Text>
                  </BlockStack>

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
                            ? (planData?.limits?.tagGlobal === Infinity
                              ? ""
                              : planData?.limits?.tagGlobal)
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
                        {remainingDays} {remainingDays === 0 ? "Day" : "Days"}
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
                  onClick={() => setModalOpendb(true)}
                  disabled={isRemoving}
                >
                  Create Database
                </Button>
              </InlineStack>
            </Banner>
          </Box>
        )}
        <Layout>
          {/* LEFT COLUMN */}
          <Layout.Section variant={breakpoints.mdDown ? "fullWidth" : "oneThird"}>
            <BlockStack gap="500">
              <LegacyCard sectioned>
                <BlockStack gap="400">
                  <Select
                    label="Resource Type"
                    options={[
                      { label: "Product", value: "product" },
                      { label: "Customer", value: "customer" },
                      { label: "Order", value: "order" },
                      { label: "BlogPost", value: "article" },
                    ]}
                    value={objectType}
                    onChange={(val) => {
                      setObjectType(val);
                      resetAll();
                    }}
                    disabled={isActionDisabled || fetchedItems.length > 0}
                  />
                  <Select
                    label="Match Type"
                    options={[
                      { label: "Contains", value: "contain" },
                      { label: "Starts With", value: "start" },
                      { label: "Ends With", value: "end" },
                      { label: "Exact Match", value: "exact" },
                    ]}
                    value={matchType}
                    onChange={setMatchType}
                    disabled={isActionDisabled || fetchedItems.length > 0}
                  />
                  {objectType === "product" && (
                    <Banner tone="warning">
                      <p>
                        Updates may take 2-5 minutes to reflect due to Shopify
                        indexing.
                      </p>
                    </Banner>
                  )}
                </BlockStack>
              </LegacyCard>

              <LegacyCard title="Search Conditions" sectioned>
                <BlockStack gap="300">
                  {conditions.map((c, i) => (
                    <InlineStack key={i} gap="200" align="center">
                      <div style={{ flex: 1 }} onKeyDown={handleKeyDown}>
                        <TextField
                          label="Tag"
                          labelHidden
                          placeholder="Enter tag (Min 2 chars)"
                          value={c.tag}
                          onChange={(val) => updateCondition(i, "tag", val)}
                          autoComplete="off"
                          disabled={isActionDisabled || fetchedItems.length > 0}
                          connectedRight={
                            conditions.length > 1 && (
                              <Button
                                icon={XIcon}
                                onClick={() => removeCondition(i)}
                                disabled={
                                  isActionDisabled || fetchedItems.length > 0
                                }
                              />
                            )
                          }
                        />
                      </div>
                    </InlineStack>
                  ))}

                  <Button
                    variant="plain"
                    icon={PlusIcon}
                    onClick={addCondition}
                    disabled={
                      !readyToAdd ||
                      isActionDisabled ||
                      fetchedItems.length > 0 ||
                      (conditions.length > 0 &&
                        conditions[conditions.length - 1].tag.trim() === "")
                    }
                  >
                    Add Another Tag
                  </Button>

                  <ButtonGroup fullWidth>
                    <Button
                      variant="primary"
                      onClick={startFetchTags}
                      loading={isFetching}
                      disabled={
                        isActionDisabled ||
                        !readyToFetch ||
                        fetchedItems.length > 0
                      }
                    >
                      Fetch Tags
                    </Button>
                    {fetchedItems.length > 0 && (
                      <Button onClick={resetAll} disabled={isActionDisabled}>
                        Reset
                      </Button>
                    )}
                  </ButtonGroup>
                </BlockStack>
              </LegacyCard>
            </BlockStack>
          </Layout.Section>

          <Layout.Section>
            <BlockStack gap="500">
              {alert.active && (
                <Banner
                  title={alert.title}
                  tone={alert.tone}
                  onDismiss={() =>
                    setAlert((prev) => ({ ...prev, active: false }))
                  }
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


              {/* 1. Fetching Loading */}
              {isFetching && (
                <LegacyCard sectioned>
                  <BlockStack align="center" inlineAlign="center" gap="400">
                    <Spinner size="large" />
                    <Text as="h3" variant="headingMd">
                      Scanning Store Tags
                    </Text>
                    <Text as="p" tone="subdued">
                      Searching through your {objectType}s...
                    </Text>
                  </BlockStack>
                </LegacyCard>
              )}

              {/* 2. Empty State */}
              {!isFetching &&
                !noTagsFound &&
                fetchedItems.length === 0 &&
                !isRemoving &&
                !globalResult.complete &&
                !specificEnd && (
                  <LegacyCard sectioned>
                    <EmptyState
                      heading="Ready to Search"
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                      <p>
                        Select an resource type on the left, enter tags, and click
                        Fetch Tags.
                      </p>
                    </EmptyState>
                  </LegacyCard>
                )}

              {/* 3. No Tags Found */}
              {noTagsFound &&
                !isFetching &&
                fetchedItems.length === 0 &&
                !alert.active && !isFetchingTags && noTagsFound && (
                  <Banner
                    title="No tags found"
                    tone="info"
                    onDismiss={() => setNoTagsFound(false)}
                  >
                    <p>Try adjusting your search conditions or Match Type.</p>
                    <Button variant="plain" onClick={resetAll}>
                      Reset Search
                    </Button>
                  </Banner>
                )}

              {/* 4. Results & Selection */}
              {!isFetching &&
                fetchedItems.length > 0 &&
                !isRemoving &&
                !globalResult.complete &&
                !specificEnd && (
                  <BlockStack gap="400">
                    <LegacyCard
                      title={`Select Tags to Remove (${fetchedItems.length} found)`}
                      sectioned
                    >
                      <BlockStack gap="200">
                        <Box
                          padding="200"
                          background="bg-surface-secondary"
                          borderRadius="200"
                        >
                          <InlineStack gap="200" wrap>
                            {fetchedItems.map((tag) => {
                              const isSelected = selectedTags.includes(tag);
                              return (
                                <Button
                                  key={tag}
                                  size="slim"
                                  pressed={isSelected}
                                  variant={isSelected ? "primary" : "secondary"}
                                  onClick={() => {
                                    const maxTags = plan === "FREE" ? 2 : plan === "BASIC" ? 10 : 20;
                                    setSelectedTags((prev) => {
                                      if (prev.includes(tag)) {
                                        return prev.filter((t) => t !== tag);
                                      } else {
                                        if (prev.length >= maxTags) {
                                          setAlert({
                                            active: true,
                                            title: "Tag Limit Exceeded",
                                            message: `Your plan allows selecting up to ${maxTags} tags at a time. Please upgrade to select more.`,
                                            tone: "critical",
                                          });
                                          setWarning((prevWarning) => ({ ...prevWarning, active: false }));
                                          return prev;
                                        }
                                        return [...prev, tag];
                                      }
                                    });
                                  }}
                                >
                                  {tag}
                                </Button>
                              );
                            })}
                          </InlineStack>
                        </Box>
                        {selectedTags.length > 0 && (
                          <Button
                            variant="plain"
                            tone="critical"
                            onClick={() => setSelectedTags([])}
                          >
                            Clear Selection
                          </Button>
                        )}
                      </BlockStack>
                    </LegacyCard>

                    {selectedTags.length > 0 && (
                      <LegacyCard title="Removal Method" sectioned>
                        <BlockStack gap="400">
                          <ChoiceList
                            title=""
                            choices={[
                              {
                                label: `Global Removal (From ${plan === "FREE" ? 50 : plan === "BASIC" ? 100 : 5000} ${objectType}s at a time)`,
                                value: "global",
                              },
                              {
                                label: "Specific Removal (From CSV)",
                                value: "specific",
                              },
                            ]}
                            selected={[removalMode]}
                            onChange={(val) => setRemovalMode(val[0] as any)}
                            disabled={isActionDisabled}
                          />

                          {removalMode === "specific" && (
                            <Box
                              padding="400"
                              background="bg-surface-secondary"
                              borderRadius="200"
                            >
                              <BlockStack gap="200">
                                <ChoiceList
                                  title="Match by"
                                  choices={[
                                    { label: "Shopify GID", value: "Id" },
                                    { label: csvType, value: csvType },
                                  ]}
                                  selected={[specificField]}
                                  onChange={(val) => setSpecificField(val[0])}
                                />
                                <Button
                                  variant="plain"
                                  onClick={handleDownloadTemplate}
                                >
                                  Download Sample CSV
                                </Button>
                                <DropZone
                                  onDrop={handleCsvInput}
                                  accept=".csv"
                                  allowMultiple={false}
                                  disabled={isActionDisabled}
                                >
                                  {fileName ? (
                                    <DropZone.FileUpload actionTitle="Replace file" />
                                  ) : (
                                    <DropZone.FileUpload actionTitle="Add file" />
                                  )}

                                </DropZone>
                                {fileName && (
                                  <Text as="p" tone="success">
                                    {fileName} — {csvIds.length} records.
                                  </Text>
                                )}
                                <Text as="p" tone="subdued">Only {plan === "FREE" ? 50 : plan === "BASIC" ? 100 : 5000} records will be processed at a time</Text>
                              </BlockStack>

                            </Box>
                          )}

                          <Button
                            variant="primary"
                            tone="critical"
                            fullWidth
                            disabled={
                              removalMode === "specific" && csvIds.length === 0
                            }
                            onClick={() => {
                              if (!csvIds.length && removalMode !== "global") {
                                setAlert({
                                  active: true,
                                  title: "Missing CSV",
                                  message: "Upload CSV first",
                                  tone: "critical",
                                });
                                return;
                              }
                              if (removalMode !== "global" && csvIds.length > 0) {
                                setPreviewModalOpen(true);
                              } else {
                                setModalOpen(true);
                              }
                            }}
                          >
                            Remove Selected Tags
                          </Button>
                        </BlockStack>
                      </LegacyCard>
                    )}
                  </BlockStack>
                )}

              {/* 5. Removing Progress */}
              {isRemoving && (
                <LegacyCard sectioned>
                  <BlockStack gap="600" align="center" inlineAlign="center">
                    {/* Header Section */}
                    <BlockStack gap="200" align="center" inlineAlign="center">
                      <div style={{ marginBottom: "8px" }}>
                        <Spinner size="large" />
                      </div>
                      <Text as="h2" variant="headingLg">
                        Removing tags
                      </Text>
                      <Text as="p" tone="subdued" alignment="center">
                        {removalMode === "global"
                          ? "We're processing your request. This may take a moment."
                          : "Please keep this browser tab open until the removal is complete."}
                      </Text>
                    </BlockStack>

                    {/* Progress & Stats Section */}
                    <Box width="100%" maxWidth="400px">
                      <BlockStack gap="400">
                        {removalMode !== "global" && (
                          <BlockStack gap="200">
                            <ProgressBar
                              progress={Math.round(
                                (finalSpecificResults.length / csvIds.length) *
                                100,
                              )}
                              tone="highlight"
                              size="small"
                            />
                            <InlineStack align="space-between">
                              <Text as="span" variant="bodySm" tone="subdued">
                                {finalSpecificResults.length < csvIds.length
                                  ? "In progress..."
                                  : "Finalizing..."}
                              </Text>
                              <Text as="span" variant="bodySm" fontWeight="bold">
                                {Math.round(
                                  (finalSpecificResults.length / csvIds.length) *
                                  100,
                                )}
                                %
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
                                {removalMode === "global"
                                  ? globalResult.totalProcessed.toLocaleString()
                                  : `${finalSpecificResults.length.toLocaleString()} / ${csvIds.length.toLocaleString()}`}
                              </strong>
                              {removalMode === "global"
                                ? ` ${objectType}s processed`
                                : ` entries processed`}
                            </Text>
                          </InlineStack>
                        </Box>
                      </BlockStack>
                    </Box>
                  </BlockStack>
                </LegacyCard>
              )}

              {/* 6. Completion */}
              {(globalResult.complete || specificEnd) && !isRemoving && (
                <LegacyCard sectioned>
                  <BlockStack align="center" inlineAlign="center" gap="500">
                    <Badge tone={globalResult.success ? "success" : "critical"}>
                      Operation Complete
                    </Badge>
                    <Text as="h2" variant="headingLg">
                      {removalMode === "global"
                        ? `Removed tags from ${globalResult.totalProcessed} items.`
                        : `Processed ${finalSpecificResults.length} items.`}
                    </Text>
                    <InlineStack gap="300">
                      <Button onClick={downloadResultCSV} variant="primary">
                        Download Results
                      </Button>
                      <Button onClick={resetAll}>Clear</Button>
                    </InlineStack>
                  </BlockStack>
                </LegacyCard>
              )}

              {/* 7. Live Logs */}
              {finalSpecificResults.length > 0 && (
                <LegacyCard>
                  <div style={{ maxHeight: "250px", overflowY: "auto", overflowX: "hidden" }}>
                    <IndexTable
                      resourceName={{ singular: "result", plural: "results" }}
                      itemCount={finalSpecificResults.length}
                      headings={[
                        { title: "#" },
                        { title: "Identifier" },
                        { title: "Status" },
                        { title: "Error" },
                      ]}
                      selectable={false}
                      condensed={breakpoints.smDown}
                    >
                      {[...finalSpecificResults].reverse().map((r, i) => (
                        <IndexTable.Row key={i} id={i.toString()} position={i}>
                          <IndexTable.Cell>
                            {finalSpecificResults.length - i}
                          </IndexTable.Cell>
                          <IndexTable.Cell>{r.row}</IndexTable.Cell>
                          <IndexTable.Cell>
                            <Badge tone={r.success ? "success" : "critical"}>
                              {r.success ? "Success" : "Failed"}
                            </Badge>
                          </IndexTable.Cell>
                          <IndexTable.Cell>{r.error || "-"}</IndexTable.Cell>
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
          handleRemoveConfirm();
        }}
        data={rawCsvData}
        title="Confirm Removal"
        confirmText="Yes, Remove Tags"
        destructive={true}
        confirmationMessage={`Are you sure you want to remove ${selectedTags.length === 1 ? "1 tag" : `${selectedTags.length} tag's`} from ${rawCsvData.length} ${rawCsvData.length == 1 ? objectType : `${objectType}'s`} ?`}
      />

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setIsCountFetching(false);
        }}
        title="Confirm Removal"
        primaryAction={{
          content: "Yes, Remove Tags",
          onAction: handleRemoveConfirm,
          destructive: true,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => {
              setModalOpen(false);
              setIsCountFetching(false);
            },
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            {isFetchingCount ? (
              <InlineStack gap="300" blockAlign="center">
                <Spinner size="small" />
                <Text as="p" tone="subdued">
                  Loading total of matching {objectType}s...
                </Text>
              </InlineStack>
            ) : (
              matchingCount !== null && (
                <Text as="p" variant="headingMd">
                  Total matching {objectType}s: <strong>{matchingCount.toLocaleString()}</strong>
                </Text>
              )
            )}
            <Text as="p">
              Are you sure you want to remove {selectedTags.length === 1 ? "1 tag" : `${selectedTags.length} tags`} from up to 5,000 {objectType} entries where these tags are present? If more matching entries are available, repeat this operation again.
            </Text>
          </BlockStack>
        </Modal.Section>
      </Modal>
      <RemoveTagsInstructionsModal
        open={instructionsOpen}
        onClose={() => setInstructionsOpen(false)}
      />
    </Page>
  );
}

export function ErrorBoundary() {
  return <RouteErrorBoundary routeName="Remove Tags" />;
}



