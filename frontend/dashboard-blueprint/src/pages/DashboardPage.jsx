import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { ChevronDown, ChevronUp, CircleHelp } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import PageContainer from "../components/layout/PageContainer";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Textarea } from "../components/ui/textarea";
import { cn, getTrafficLightMetric } from "../lib/utils";
import InstallationAnalyticsView from "../components/installation/InstallationAnalyticsView";
import InstallationSurveyExplorer from "../components/installation/InstallationSurveyExplorer";
import InstallationTrendsView from "../components/installation/InstallationTrendsView";
import PlatformUserGuidePage from "../components/user-guide/PlatformUserGuidePage";
import SurveysDataTable from "../components/b2b/SurveysDataTable";
import ReviewQueueDataTable from "../components/b2b/ReviewQueueDataTable";
import PlannedVisitsDataTable from "../components/b2b/PlannedVisitsDataTable";
import BusinessesDataTable from "../components/b2b/BusinessesDataTable";
import ExecutivesDataTable from "../components/b2b/ExecutivesDataTable";
import ActionPointsDataTable from "../components/b2b/ActionPointsDataTable";
import SimpleStatusDataTable from "../components/shared/SimpleStatusDataTable";
import MysteryReviewQueueSection from "../features/mystery-shopper/components/MysteryReviewQueueSection";
import MysteryVisitDetailCard from "../features/mystery-shopper/components/MysteryVisitDetailCard";
import MysterySurveyResultsSection from "../features/mystery-shopper/components/MysterySurveyResultsSection";
import MysteryReportsSection from "../features/mystery-shopper/components/MysteryReportsSection";
import MysteryAnalyticsSummarySection from "../features/mystery-shopper/components/MysteryAnalyticsSummarySection";
import MysteryLocationsSection from "../features/mystery-shopper/components/MysteryLocationsSection";
import MysteryPurposesSection from "../features/mystery-shopper/components/MysteryPurposesSection";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const B2B_API_BASE = `${API_BASE}/b2b`;
const ACTION_TIMEFRAME_OPTIONS = ["<1 month", "<3 months", "<6 months", ">6 months"];
const REPORT_TYPE_OPTIONS = [
  { key: "survey", label: "Selected Business", description: "View survey details for a specific business. Pick a business then select an approved survey." },
  { key: "date", label: "Selected Date", description: "All approved surveys completed on a single date or within a date range." },
  { key: "lifetime", label: "Lifetime Overview", description: "Full lifetime metrics, visits per business, and any pending visits across the platform." },
  { key: "action_points", label: "Action Points", description: "All outstanding and completed action points. Filter by business, date range, or status." },
];
const INSTALL_REPORT_TYPE_OPTIONS = [
  { key: "lifetime", label: "Lifetime Summary", description: "Complete analytics overview of all installation assessments with clear, easy-to-understand metrics and explanations." },
  { key: "survey", label: "Single Survey Report", description: "Detailed report for a specific installation survey, including all question scores and overall assessment." },
];

const COLORS = {
  promoters: "#10b981",
  passives: "#f59e0b",
  detractors: "#ef4444",
  very_satisfied: "#10b981",
  satisfied: "#34d399",
  neutral: "#f59e0b",
  dissatisfied: "#fb7185",
  very_dissatisfied: "#ef4444",
};

function normalizeBusinessPriorityLevel(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "large_corporate" || normalized === "high") return "large_corporate";
  return "sme";
}

async function fetchJsonSafe(url, options = {}, timeout = 0) {
  const controller = timeout > 0 ? new AbortController() : null;
  const timeoutId = timeout > 0 ? setTimeout(() => controller.abort(), timeout) : null;
  try {
    const response = await fetch(url, { ...options, ...(controller ? { signal: controller.signal } : {}) });
    const text = await response.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      // ignore parse error
    }
    return { res: response, data };
  } catch (error) {
    if (error?.name === "AbortError") {
      return {
        res: { ok: false, status: 408 },
        data: { detail: "Request timed out", aborted: true },
      };
    }
    return {
      res: { ok: false, status: 500 },
      data: { detail: error?.message || "Request failed" },
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function formatApiError(detail, fallback = "Unexpected error") {
  if (detail == null || detail === "") return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const joined = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const loc = Array.isArray(item.loc) ? item.loc.join(".") : "";
          const msg = typeof item.msg === "string" ? item.msg : "";
          if (loc && msg) return `${loc}: ${msg}`;
          if (msg) return msg;
        }
        try {
          return JSON.stringify(item);
        } catch {
          return String(item);
        }
      })
      .filter(Boolean)
      .join("; ");
    return joined || fallback;
  }
  if (typeof detail === "object") {
    if (typeof detail.msg === "string" && detail.msg) return detail.msg;
    try {
      return JSON.stringify(detail);
    } catch {
      return fallback;
    }
  }
  return String(detail);
}

export default function DashboardPage({ headers, activePlatform, onSessionExpired }) {
  const location = useLocation();
  const normalizedPlatform = String(activePlatform || "").toLowerCase();
  const isB2BPlatform = normalizedPlatform.includes("b2b");
  const isMysteryShopperPlatform = normalizedPlatform.includes("mystery");
  const isInstallationPlatform = normalizedPlatform.includes("installation");
  const [analytics, setAnalytics] = useState(null);
  const [questionAverages, setQuestionAverages] = useState([]);
  const [yesNoQuestionAnalytics, setYesNoQuestionAnalytics] = useState([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState("");
  const [trendData, setTrendData] = useState([]);
  const [accountExecutiveYesNoTrendData, setAccountExecutiveYesNoTrendData] = useState([]);
  const [pendingVisits, setPendingVisits] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [representatives, setRepresentatives] = useState([]);
  const [selectedExecutive, setSelectedExecutive] = useState(null);
  const [executiveForm, setExecutiveForm] = useState({ name: "", email: "" });
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [businessForm, setBusinessForm] = useState({
    name: "",
    location: "",
    priority_level: "sme",
    active: true,
    account_executive_id: ""
  });
  const [accountExecutiveQuery, setAccountExecutiveQuery] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const errorText = useMemo(() => formatApiError(error, ""), [error]);
  const [selectedAnalyticsBusinessIds, setSelectedAnalyticsBusinessIds] = useState([]);
  const [analyticsBusinessSearch, setAnalyticsBusinessSearch] = useState("");
  const [surveyResults, setSurveyResults] = useState([]);
  const [selectedSurveyVisit, setSelectedSurveyVisit] = useState(null);
  const [reviewResponseDrafts, setReviewResponseDrafts] = useState({});
  const [reviewSavingResponseId, setReviewSavingResponseId] = useState("");
  const [actionsBoardItems, setActionsBoardItems] = useState([]);
  const [actionsBoardSummary, setActionsBoardSummary] = useState(null);
  const [actionsBoardLoading, setActionsBoardLoading] = useState(false);
  const [actionsTimelineOptions, setActionsTimelineOptions] = useState(ACTION_TIMEFRAME_OPTIONS);
  const [actionsStatusOptions, setActionsStatusOptions] = useState(["Outstanding", "In Progress", "Completed"]);
  const [actionsFilters, setActionsFilters] = useState({
    lead_owner: "",
    support: "",
    timeline: "",
    action_status: "",
    business_id: "",
  });
  const [plannedVisits, setPlannedVisits] = useState([]);
  const [plannedLoading, setPlannedLoading] = useState(false);
  const [plannedForm, setPlannedForm] = useState({ business_id: "", visit_date: "", visit_type: "Planned" });
  const [editingPlannedVisitId, setEditingPlannedVisitId] = useState("");
  const [plannedEditForm, setPlannedEditForm] = useState({ visit_date: "", visit_type: "Planned" });
  const [surveyStatusFilter, setSurveyStatusFilter] = useState("all");
  const [selectedSurveyBusiness, setSelectedSurveyBusiness] = useState("");
  const [selectedSurveyLocation, setSelectedSurveyLocation] = useState("");
  const [surveyLoading, setSurveyLoading] = useState(false);
  const [reportDateFrom, setReportDateFrom] = useState("");
  const [reportDateTo, setReportDateTo] = useState("");
  const [reportType, setReportType] = useState("lifetime");
  const [reportVisitId, setReportVisitId] = useState("");
  const [reportSelectedDate, setReportSelectedDate] = useState("");
  const [reportBusinessId, setReportBusinessId] = useState("");
  const [reportEmailTo, setReportEmailTo] = useState("");
  const [reportPreview, setReportPreview] = useState(null);
  const [reportPreviewHtml, setReportPreviewHtml] = useState("");
  const [reportEligibleSurveys, setReportEligibleSurveys] = useState([]);
  const [reportIneligibleSurveys, setReportIneligibleSurveys] = useState([]);
  const [reportSurveyLoading, setReportSurveyLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSending, setReportSending] = useState(false);
  const [reviewActionLoadingVisitId, setReviewActionLoadingVisitId] = useState("");


  const [mysteryLocations, setMysteryLocations] = useState([]);
  const [mysteryPurposes, setMysteryPurposes] = useState([]);
  const [newMysteryLocation, setNewMysteryLocation] = useState("");
  const [newMysteryPurpose, setNewMysteryPurpose] = useState("");
  const [mysteryLocationsLoading, setMysteryLocationsLoading] = useState(false);
  const [mysteryPurposesLoading, setMysteryPurposesLoading] = useState(false);
  const [mysteryLegacySeeding, setMysteryLegacySeeding] = useState(false);
  const [selectedAnalyticsLocationIds, setSelectedAnalyticsLocationIds] = useState([]);
  const [analyticsLocationSearch, setAnalyticsLocationSearch] = useState("");
  const [expandedCategory, setExpandedCategory] = useState("");
  const [toasts, setToasts] = useState([]);
  const [installationAnalytics, setInstallationAnalytics] = useState(null);
  const [installationAnalyticsLoading, setInstallationAnalyticsLoading] = useState(false);
  const [installationSurveyFilters, setInstallationSurveyFilters] = useState({
    customer_name: "",
    inspector_name: "",
    work_order: "",
    location: "",
    date_work_done: "",
    date_from: "",
    date_to: "",
    customer_type: "",
    worker_type: "",
  });
   const [installationSurveys, setInstallationSurveys] = useState([]);
   const [installationSurveysLoading, setInstallationSurveysLoading] = useState(false);
   const [selectedInstallationSurvey, setSelectedInstallationSurvey] = useState(null);

   // Installation Report states
   const [installReportType, setInstallReportType] = useState("lifetime");
   const [installReportDateFrom, setInstallReportDateFrom] = useState("");
   const [installReportDateTo, setInstallReportDateTo] = useState("");
   const [installReportMonth, setInstallReportMonth] = useState("");
   const [installReportSurveyId, setInstallReportSurveyId] = useState("");
   const [installReportEmailTo, setInstallReportEmailTo] = useState("");
   const [installReportPreview, setInstallReportPreview] = useState(null);
   const [installReportPreviewHtml, setInstallReportPreviewHtml] = useState("");
   const [installReportSurveyList, setInstallReportSurveyList] = useState([]);
   const [installReportSurveyListLoading, setInstallReportSurveyListLoading] = useState(false);
   const [installReportLoading, setInstallReportLoading] = useState(false);
   const [installReportSending, setInstallReportSending] = useState(false);
   const [installationTrendMonth, setInstallationTrendMonth] = useState("");
   const [installationTrendCustomerType, setInstallationTrendCustomerType] = useState("");
   const [installationTrendWorkerType, setInstallationTrendWorkerType] = useState("");
   const [installationTrends, setInstallationTrends] = useState(null);
   const [installationTrendsLoading, setInstallationTrendsLoading] = useState(false);
   const [installationContractorQuery, setInstallationContractorQuery] = useState("");
   const [installationContractors, setInstallationContractors] = useState([]);
   const [installationContractorsLoading, setInstallationContractorsLoading] = useState(false);
   const [newInstallationContractorName, setNewInstallationContractorName] = useState("");
  const [installationContractorSaving, setInstallationContractorSaving] = useState(false);
  const platformRequestVersion = useRef(0);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((kind, title, duration = 2600) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, kind, title }]);
    window.setTimeout(() => dismissToast(id), duration);
  }, [dismissToast]);

  const loadInstallationAnalytics = useCallback(async () => {
    setInstallationAnalyticsLoading(true);
    setError("");
    try {
      const { res, data } = await fetchJsonSafe(`${API_BASE}/installation/analytics`, { headers });
      if (!res.ok) {
        setError(data?.detail || "Failed to load installation analytics");
        setInstallationAnalytics(null);
        return;
      }
      setInstallationAnalytics(data || null);
    } catch (err) {
      setError("Failed to load installation analytics");
      setInstallationAnalytics(null);
    } finally {
      setInstallationAnalyticsLoading(false);
    }
  }, [headers, fetchJsonSafe]);

  const loadInstallationTrends = useCallback(async () => {
    setInstallationTrendsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (installationTrendMonth) {
        const [year, month] = installationTrendMonth.split("-");
        if (year && month) {
          const start = `${installationTrendMonth}-01`;
          const endDate = new Date(Number(year), Number(month), 0);
          const end = `${installationTrendMonth}-${String(endDate.getDate()).padStart(2, "0")}`;
          params.set("date_from", start);
          params.set("date_to", end);
        }
      }
      if (installationTrendCustomerType) params.set("customer_type", installationTrendCustomerType);
      if (installationTrendWorkerType) params.set("worker_type", installationTrendWorkerType);
      const query = params.toString();
      const { res, data } = await fetchJsonSafe(`${API_BASE}/installation/trends${query ? `?${query}` : ""}`, { headers });
      if (!res.ok) {
        setError(data?.detail || "Failed to load installation trends");
        setInstallationTrends(null);
        return;
      }
      setInstallationTrends(data || null);
    } catch (err) {
      setError("Failed to load installation trends");
      setInstallationTrends(null);
    } finally {
      setInstallationTrendsLoading(false);
    }
  }, [headers, fetchJsonSafe, installationTrendMonth, installationTrendCustomerType, installationTrendWorkerType]);

  const loadInstallationSurveys = useCallback(async () => {
    if (!isInstallationPlatform) return;
    setInstallationSurveysLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      Object.entries(installationSurveyFilters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      const { res, data } = await fetchJsonSafe(`${API_BASE}/installation/surveys?${params.toString()}`, { headers });
      if (!res.ok) {
        setError(data?.detail || "Failed to load installation surveys");
        setInstallationSurveys([]);
        return;
      }
      setInstallationSurveys(Array.isArray(data) ? data : []);
    } catch (err) {
      setError("Failed to load installation surveys");
      setInstallationSurveys([]);
    } finally {
      setInstallationSurveysLoading(false);
    }
  }, [isInstallationPlatform, installationSurveyFilters, headers, fetchJsonSafe]);

  const loadInstallationContractors = useCallback(async (query = installationContractorQuery) => {
    if (!isInstallationPlatform) return;
    setInstallationContractorsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if ((query || "").trim()) params.set("q", query.trim());
      const { res, data } = await fetchJsonSafe(`${API_BASE}/installation/contractors${params.toString() ? `?${params.toString()}` : ""}`, { headers });
      if (!res.ok) {
        setError(data?.detail || "Failed to load contractors");
        setInstallationContractors([]);
        return;
      }
      setInstallationContractors(Array.isArray(data) ? data : []);
    } catch (err) {
      setError("Failed to load contractors");
      setInstallationContractors([]);
    } finally {
      setInstallationContractorsLoading(false);
    }
  }, [isInstallationPlatform, installationContractorQuery, headers, fetchJsonSafe]);

  const createInstallationContractor = useCallback(async () => {
    const trimmedName = newInstallationContractorName.trim();
    if (!trimmedName) {
      setError("Contractor name is required");
      return;
    }
    setInstallationContractorSaving(true);
    setError("");
    try {
      const { res, data } = await fetchJsonSafe(`${API_BASE}/installation/contractors`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });
      if (!res.ok) {
        setError(data?.detail || "Failed to create contractor");
        return;
      }
      setNewInstallationContractorName("");
      pushToast("success", `Contractor '${trimmedName}' saved`);
      loadInstallationContractors(installationContractorQuery);
    } catch (err) {
      setError("Failed to create contractor");
    } finally {
      setInstallationContractorSaving(false);
    }
  }, [newInstallationContractorName, installationContractorQuery, headers, fetchJsonSafe, pushToast, loadInstallationContractors]);

  const handleInstallationFilterChange = useCallback((key, value) => {
    setInstallationSurveyFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetInstallationSurveyFilters = useCallback(() => {
    setInstallationSurveyFilters({
      customer_name: "",
      inspector_name: "",
      work_order: "",
      location: "",
      date_work_done: "",
      date_from: "",
      date_to: "",
      customer_type: "",
      worker_type: "",
    });
  }, []);

  const loadInstallationSurveyDetail = useCallback(async (surveyId) => {
    setError("");
    try {
      const { res, data } = await fetchJsonSafe(`${API_BASE}/installation/surveys/${surveyId}`, { headers });
      if (!res.ok) {
        setError(data?.detail || "Failed to load survey detail");
        return;
      }
      setSelectedInstallationSurvey(data || null);
    } catch (err) {
      setError("Failed to load survey detail");
    }
  }, [headers, fetchJsonSafe]);

  // Load surveys for report selection dropdown
  const loadInstallationReportSurveyList = useCallback(async () => {
    setInstallReportSurveyListLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      const { res, data } = await fetchJsonSafe(`${API_BASE}/installation/surveys?${params.toString()}`, { headers });
      if (!res.ok) {
        setError(data?.detail || "Failed to load surveys for report");
        setInstallReportSurveyList([]);
        return;
      }
      // Expect data as array of surveys
      setInstallReportSurveyList(Array.isArray(data) ? data : []);
    } catch (err) {
      setError("Failed to load surveys for report");
      setInstallReportSurveyList([]);
    } finally {
      setInstallReportSurveyListLoading(false);
    }
  }, [headers, fetchJsonSafe]);

  const handleInstallationPreviewReport = useCallback(async () => {
    // Validation
    if (installReportType === "survey" && !installReportSurveyId) {
      setError("Please select a survey for the single survey report.");
      return;
    }
    setInstallReportLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("report_type", installReportType);
      if (installReportMonth) {
        const [year, month] = installReportMonth.split("-");
        if (year && month) {
          const start = `${installReportMonth}-01`;
          const endDate = new Date(Number(year), Number(month), 0);
          const end = `${installReportMonth}-${String(endDate.getDate()).padStart(2, "0")}`;
          params.set("date_from", start);
          params.set("date_to", end);
        }
      }
      if (installReportDateFrom) params.set("date_from", installReportDateFrom);
      if (installReportDateTo) params.set("date_to", installReportDateTo);
      if (installReportSurveyId) params.set("survey_id", installReportSurveyId);

      const { res, data } = await fetchJsonSafe(`${API_BASE}/installation/reports/export?${params.toString()}`, { headers }, 30000);
      if (!res.ok) {
        setError(data?.detail || "Failed to generate report preview");
        setInstallReportPreview(null);
        setInstallReportPreviewHtml("");
        return;
      }
      setInstallReportPreview(data?.report || null);
      setInstallReportPreviewHtml(data?.report_html || "");
      pushToast("success", "Report preview generated");
    } catch (err) {
      setError("Failed to generate report preview");
      setInstallReportPreview(null);
      setInstallReportPreviewHtml("");
    } finally {
      setInstallReportLoading(false);
    }
  }, [installReportType, installReportDateFrom, installReportDateTo, installReportSurveyId, headers, fetchJsonSafe, pushToast]);

  const handleInstallationDownloadReport = useCallback(async () => {
    if (!installReportPreviewHtml) return;
    const link = document.createElement("a");
    const blob = new Blob([installReportPreviewHtml], { type: "text/html" });
    link.href = URL.createObjectURL(blob);
    link.download = `installation-report-${new Date().toISOString().slice(0,10)}.html`;
    link.click();
    URL.revokeObjectURL(link.href);
    pushToast("success", "Report downloaded");
  }, [installReportPreviewHtml, pushToast]);

  const handleInstallationEmailReport = useCallback(async () => {
    if (!installReportEmailTo.trim()) {
      setError("Please enter at least one email recipient");
      return;
    }
    setInstallReportSending(true);
    setError("");
    try {
      const recipients = installReportEmailTo.split(",").map((e) => e.trim()).filter(Boolean);
      const payload = {
        report_type: installReportType,
        date_from: installReportDateFrom || null,
        date_to: installReportDateTo || null,
        survey_id: installReportSurveyId || null,
        to: recipients,
      };
      const { res, data } = await fetchJsonSafe(`${API_BASE}/installation/reports/email`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }, 30000);
      if (!res.ok) {
        setError(data?.detail || "Failed to send report email");
      } else {
        setInstallReportEmailTo("");
        pushToast("success", `Report emailed to ${recipients.join(", ")}`);
      }
    } catch (err) {
      setError("Failed to send report email");
    } finally {
      setInstallReportSending(false);
    }
  }, [installReportType, installReportDateFrom, installReportDateTo, installReportSurveyId, installReportEmailTo, headers, fetchJsonSafe, pushToast]);

  useEffect(() => {
    if (!isInstallationPlatform) {
      setInstallationAnalytics(null);
      return;
    }
    loadInstallationAnalytics();
  }, [isInstallationPlatform, loadInstallationAnalytics]);

  useEffect(() => {
    if (!isInstallationPlatform || location.pathname !== "/trends") {
      setInstallationTrends(null);
      return;
    }
    loadInstallationTrends();
  }, [isInstallationPlatform, location.pathname, loadInstallationTrends]);

  useEffect(() => {
    if (!isInstallationPlatform || location.pathname !== "/surveys") {
      return;
    }
    loadInstallationSurveys();
   }, [isInstallationPlatform, location.pathname, loadInstallationSurveys]);

   useEffect(() => {
     if (!isInstallationPlatform || location.pathname !== "/contractors") {
       return;
     }
     loadInstallationContractors();
   }, [isInstallationPlatform, location.pathname, loadInstallationContractors]);

   // Load installation report survey list when on reports page and report type is 'survey'
   useEffect(() => {
     if (!isInstallationPlatform || location.pathname !== "/reports") {
       return;
     }
     if (installReportType === "survey") {
       loadInstallationReportSurveyList();
     } else {
       setInstallReportSurveyList([]);
     }
   }, [isInstallationPlatform, location.pathname, installReportType, loadInstallationReportSurveyList]);


  const InfoHint = ({ text }) => (
    <details className="group relative inline-flex">
      <summary
        title={text}
        className="list-none cursor-pointer rounded-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CircleHelp className="h-4 w-4" />
      </summary>
      <div className="pointer-events-none absolute left-0 top-6 z-30 w-72 rounded-md border bg-popover p-2 text-xs text-popover-foreground opacity-0 shadow-md transition-opacity duration-100 group-hover:opacity-100 group-open:opacity-100">
        {text}
      </div>
    </details>
  );

  const selectedAnalyticsEntityIds = useMemo(() => {
    if (isB2BPlatform) {
      return selectedAnalyticsBusinessIds;
    }
    if (isMysteryShopperPlatform) {
      return selectedAnalyticsLocationIds;
    }
    return [];
  }, [isB2BPlatform, isMysteryShopperPlatform, selectedAnalyticsBusinessIds, selectedAnalyticsLocationIds]);

  useEffect(() => {
    platformRequestVersion.current += 1;
    setError("");
    setMessage("");
    setAnalytics(null);
    setQuestionAverages([]);
    setTrendData([]);
    setYesNoQuestionAnalytics([]);
    setAccountExecutiveYesNoTrendData([]);
    setPendingVisits([]);
    setSurveyResults([]);
    setSelectedSurveyVisit(null);
    setReviewResponseDrafts({});
  }, [activePlatform]);

   // Reset selected question when platform changes
   useEffect(() => {
     setSelectedQuestionId("");
   }, [activePlatform]);


   // Load core metrics (NPS, Category Breakdown, CSAT + B2B analytics)
    useEffect(() => {
     if (!activePlatform || isInstallationPlatform) return;
     const load = async () => {
       const requestVersion = platformRequestVersion.current;
       setError("");
        const params = new URLSearchParams();
        params.set("survey_type", activePlatform);
        if (selectedAnalyticsEntityIds.length > 0) {
          params.set(
            isMysteryShopperPlatform ? "mystery_location_ids" : "business_ids",
            selectedAnalyticsEntityIds.join(",")
          );
        }
        params.set("_cb", Date.now().toString());
        const queryString = `?${params.toString()}`;

        try {
         const analyticsRes = await fetchJsonSafe(`${API_BASE}/analytics${queryString}`, { headers }, 45000);
         const analyticsData = analyticsRes.data || {};
         if (!analyticsRes.res.ok) {
           setError(analyticsData.detail || "Failed to load metrics");
           return;
         }

         let npsData = analyticsData.nps || {};
         let catData = Array.isArray(analyticsData.category_breakdown) ? analyticsData.category_breakdown : [];

         if (!isMysteryShopperPlatform) {
           const [npsRes, catRes] = await Promise.all([
             fetchJsonSafe(`${API_BASE}/dashboard/nps${queryString}`, { headers }, 45000),
             fetchJsonSafe(`${API_BASE}/dashboard/category-breakdown${queryString}`, { headers }, 45000),
           ]);

           if (npsRes.res.ok && npsRes.data) {
             npsData = npsRes.data;
           }
           if (catRes.res.ok && Array.isArray(catRes.data)) {
             catData = catRes.data;
           }
         }

          if (requestVersion !== platformRequestVersion.current) return;
          setAnalytics({
            ...analyticsData,
           nps: npsData,
           category_breakdown: Array.isArray(catData) ? catData : [],
           customer_satisfaction: analyticsData.customer_satisfaction || analyticsData,
           relationship_score: analyticsData.relationship_score || null,
           competitive_exposure: analyticsData.competitive_exposure || null,
           mystery_shopper: analyticsData.mystery_shopper || null,
           visits: analyticsData.visits || null,
         });
       } catch (err) {
         setError("Failed to load metrics");
       }
     };
     load();
    }, [activePlatform, isInstallationPlatform, isMysteryShopperPlatform, selectedAnalyticsEntityIds, fetchJsonSafe]);

   // Load yes/no question analytics
    useEffect(() => {
      if (!activePlatform || !isB2BPlatform) {
        setYesNoQuestionAnalytics([]);
        return;
     }

     const load = async () => {
        const requestVersion = platformRequestVersion.current;
        const params = new URLSearchParams({ survey_type: activePlatform });
       if (selectedAnalyticsEntityIds.length > 0) {
         params.set("business_ids", selectedAnalyticsEntityIds.join(","));
       }
       const { res, data } = await fetchJsonSafe(`${API_BASE}/analytics/questions/yes-no?${params.toString()}`, { headers });
       if (!res.ok) {
         setYesNoQuestionAnalytics([]);
         return;
       }
        if (requestVersion !== platformRequestVersion.current) return;
        setYesNoQuestionAnalytics(Array.isArray(data?.items) ? data.items : []);
      };

      load();
    }, [activePlatform, isB2BPlatform, selectedAnalyticsEntityIds, fetchJsonSafe]);

    useEffect(() => {
      if (!activePlatform || !isB2BPlatform) {
        setAccountExecutiveYesNoTrendData([]);
        return;
      }

      const load = async () => {
        const requestVersion = platformRequestVersion.current;
        const params = new URLSearchParams({ survey_type: activePlatform });
        if (selectedAnalyticsEntityIds.length > 0) {
          params.set("business_ids", selectedAnalyticsEntityIds.join(","));
        }
        const { res, data } = await fetchJsonSafe(`${API_BASE}/analytics/account-executives/yes-no-trends?${params.toString()}`, { headers });
        if (!res.ok) {
          setAccountExecutiveYesNoTrendData([]);
          return;
        }
        if (requestVersion !== platformRequestVersion.current) return;
        setAccountExecutiveYesNoTrendData(Array.isArray(data?.items) ? data.items : []);
      };

      load();
    }, [activePlatform, isB2BPlatform, selectedAnalyticsEntityIds, headers, fetchJsonSafe]);

   // Load question averages for drilldown table
   useEffect(() => {
     if (!activePlatform || isInstallationPlatform) return;
      const load = async () => {
        const requestVersion = platformRequestVersion.current;
        const params = new URLSearchParams({ survey_type: activePlatform });
        if (selectedAnalyticsEntityIds.length > 0) {
          params.set(
            isMysteryShopperPlatform ? "mystery_location_ids" : "business_ids",
            selectedAnalyticsEntityIds.join(",")
          );
        }
        const { res, data } = await fetchJsonSafe(`${API_BASE}/analytics/questions?${params.toString()}`, { headers });
       if (!res.ok) return;
       const values = Array.isArray(data?.items) ? data.items : [];
        if (requestVersion !== platformRequestVersion.current) return;
        setQuestionAverages(values);
       if (values.length === 0) {
         setSelectedQuestionId("");
         return;
       }
       const hasSelected = values.some((item) => String(item.question_id) === String(selectedQuestionId));
       if (!hasSelected && values[0]?.question_id) {
         setSelectedQuestionId(String(values[0].question_id));
       }
     };
     load();
    }, [activePlatform, isInstallationPlatform, isMysteryShopperPlatform, selectedAnalyticsEntityIds, fetchJsonSafe]);

   // Load question trend data
   useEffect(() => {
     if (!selectedQuestionId || !activePlatform) return;
      const load = async () => {
        const requestVersion = platformRequestVersion.current;
        const params = new URLSearchParams({ survey_type: activePlatform, interval: "week" });
        if (selectedAnalyticsEntityIds.length > 0) {
          params.set(
            isMysteryShopperPlatform ? "mystery_location_ids" : "business_ids",
            selectedAnalyticsEntityIds.join(",")
          );
        }
        const { res, data } = await fetchJsonSafe(`${API_BASE}/analytics/questions/${selectedQuestionId}/trend?${params.toString()}`, { headers });
       if (!res.ok) return;
       const rows = Array.isArray(data?.points) ? data.points : [];
        if (requestVersion !== platformRequestVersion.current) return;
        setTrendData(rows.map((row) => ({ period: row.period_label || row.period, average: Number(row.average_score || 0) })));
      };
     load();
    }, [activePlatform, isMysteryShopperPlatform, selectedQuestionId, selectedAnalyticsEntityIds, fetchJsonSafe]);

  const loadPendingVisits = useCallback(async () => {
    const requestVersion = platformRequestVersion.current;
    const params = new URLSearchParams();
    params.set("status", "Pending");
    if (!isMysteryShopperPlatform && activePlatform) params.set("survey_type", activePlatform);
    const endpoint = isMysteryShopperPlatform
      ? `${API_BASE}/mystery-shopper/admin/visits?${params.toString()}`
      : `${API_BASE}/dashboard-visits/all?${params.toString()}`;
    const { res, data } = await fetchJsonSafe(endpoint, { headers });
    if (!res.ok) {
      setError(data?.detail || "Failed to load pending visits");
      return;
    }
    const normalized = (Array.isArray(data) ? data : []).map((visit) => ({
      ...visit,
      visit_id: visit.visit_id ?? visit.id,
    }));
    if (requestVersion !== platformRequestVersion.current) return;
    setPendingVisits(normalized);
  }, [activePlatform, headers, fetchJsonSafe, isMysteryShopperPlatform]);



  // Load pending visits for review queue
  useEffect(() => {
    loadPendingVisits();
  }, [loadPendingVisits]);

  const loadMysteryLocations = async () => {
    if (!isMysteryShopperPlatform) {
      setMysteryLocations([]);
      return;
    }
    setMysteryLocationsLoading(true);
    try {
      const requestVersion = platformRequestVersion.current;
      const { res, data } = await fetchJsonSafe(`${API_BASE}/mystery-shopper/locations`, { headers });
      if (!res.ok) {
        setError(data?.detail || "Failed to load locations");
        return;
      }
      if (requestVersion !== platformRequestVersion.current) return;
      setMysteryLocations(Array.isArray(data) ? data : []);
    } catch {
      setError("Failed to load locations");
    } finally {
      setMysteryLocationsLoading(false);
    }
  };

  const loadMysteryPurposes = async () => {
    if (!isMysteryShopperPlatform) {
      setMysteryPurposes([]);
      return;
    }
    setMysteryPurposesLoading(true);
    try {
      const requestVersion = platformRequestVersion.current;
      const { res, data } = await fetchJsonSafe(`${API_BASE}/mystery-shopper/purposes`, { headers });
      if (!res.ok) {
        setError(data?.detail || "Failed to load purposes");
        return;
      }
      if (requestVersion !== platformRequestVersion.current) return;
      setMysteryPurposes(Array.isArray(data) ? data : []);
    } catch {
      setError("Failed to load purposes");
    } finally {
      setMysteryPurposesLoading(false);
    }
  };

  useEffect(() => {
    if (!isMysteryShopperPlatform) {
      setMysteryLocations([]);
      setMysteryPurposes([]);
      setSelectedAnalyticsLocationIds([]);
      setSelectedSurveyLocation("");
      return;
    }
    loadMysteryLocations();
    loadMysteryPurposes();
  }, [isMysteryShopperPlatform, headers]);

  useEffect(() => {
    if (!message) return;
    pushToast("success", message);
  }, [message, pushToast]);

  useEffect(() => {
    if (!error) return;
    pushToast("error", error, 3400);
  }, [error, pushToast]);

  const loadSurveyResults = async () => {
    if (!activePlatform || isInstallationPlatform) return;

    const params = new URLSearchParams();
    if (surveyStatusFilter !== "all") params.set("status", surveyStatusFilter);
    if (isB2BPlatform && selectedSurveyBusiness) params.set("business_name", selectedSurveyBusiness);
    if (isMysteryShopperPlatform && selectedSurveyLocation) params.set("business_name", selectedSurveyLocation);
    if (!isMysteryShopperPlatform && activePlatform) params.set("survey_type", activePlatform);

    setSurveyLoading(true);
    setError("");
    try {
      const endpoint = isMysteryShopperPlatform
        ? `${API_BASE}/mystery-shopper/admin/visits?${params.toString()}`
        : `${API_BASE}/dashboard-visits/all?${params.toString()}`;
      const { res, data } = await fetchJsonSafe(endpoint, { headers });
      if (!res.ok) {
        setError(data?.detail || "Failed to load survey results");
        return;
      }
      const rows = Array.isArray(data) ? data : [];
      rows.sort((a, b) => String(b.visit_date || "").localeCompare(String(a.visit_date || "")));
      setSurveyResults(rows);
    } finally {
      setSurveyLoading(false);
    }
  };

  const validateReportSelection = useCallback(() => {
    if (reportType === "survey") {
      if (!reportBusinessId) {
        setError(isMysteryShopperPlatform ? "Select a location first for the per-survey report." : "Select a business first for the per-survey report.");
        return false;
      }
      if (!reportVisitId) {
        setError(isMysteryShopperPlatform ? "Select an approved survey for this location before generating the report." : "Select an approved survey for this business before generating the report.");
        return false;
      }
    }
    if (reportType === "date") {
      const hasSingleDate = Boolean(reportSelectedDate);
      const hasDateRange = Boolean(reportDateFrom || reportDateTo);
      if (!hasSingleDate && !hasDateRange) {
        setError("Select a single report date or a date range for the selected-date report.");
        return false;
      }
    }
    return true;
  }, [isMysteryShopperPlatform, reportBusinessId, reportDateFrom, reportDateTo, reportSelectedDate, reportType, reportVisitId]);

  const buildReportParams = useCallback(() => {
    const params = new URLSearchParams();
    params.set("report_type", reportType);
    if (!isMysteryShopperPlatform) params.set("survey_type", activePlatform || "B2B");
    if (reportBusinessId) params.set(isMysteryShopperPlatform ? "location_id" : "business_id", reportBusinessId);
    if (reportVisitId.trim()) params.set("visit_id", reportVisitId.trim());
    if (reportSelectedDate) params.set("report_date", reportSelectedDate);
    if (reportDateFrom) params.set("date_from", reportDateFrom);
    if (reportDateTo) params.set("date_to", reportDateTo);
    return params;
  }, [activePlatform, isMysteryShopperPlatform, reportBusinessId, reportDateFrom, reportDateTo, reportSelectedDate, reportType, reportVisitId]);

  const handlePreviewReport = useCallback(async () => {
    if (!validateReportSelection()) return;
    setReportLoading(true);
    setError("");
    try {
      const params = buildReportParams();
      const endpoint = isMysteryShopperPlatform
        ? `${API_BASE}/mystery-shopper/reports/export?${params.toString()}`
        : `${API_BASE}/dashboard-visits/reports/export?${params.toString()}`;
      const { res, data } = await fetchJsonSafe(endpoint, { headers }, 25000);
      if (!res.ok) {
        setError(data?.detail || "Failed to generate report preview");
        return;
      }
      setReportPreview(data?.report || null);
      setReportPreviewHtml(data?.report_html || "");
      setMessage("Report preview generated.");
    } finally {
      setReportLoading(false);
    }
  }, [buildReportParams, fetchJsonSafe, headers, isMysteryShopperPlatform, validateReportSelection]);

  const handleDownloadReport = useCallback(async () => {
    if (!validateReportSelection()) return;
    pushToast("info", "Preparing report download...", 1500);
    setError("");
    const params = buildReportParams();
    params.set("download", "true");
    try {
      const endpoint = isMysteryShopperPlatform
        ? `${API_BASE}/mystery-shopper/reports/export?${params.toString()}`
        : `${API_BASE}/dashboard-visits/reports/export?${params.toString()}`;
      const res = await fetch(endpoint, { headers });
      if (!res.ok) {
        const text = await res.text();
        setError(text || "Failed to download report");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "cwscx-survey-report.html";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setMessage("Report downloaded.");
    } catch {
      setError("Failed to download report");
    }
  }, [buildReportParams, headers, isMysteryShopperPlatform, pushToast, validateReportSelection]);

  const handleDownloadPdfReport = useCallback(async () => {
    if (!validateReportSelection()) return;
    pushToast("info", "Preparing PDF download...", 1500);
    setError("");
    const params = buildReportParams();
    try {
      const endpoint = isMysteryShopperPlatform
        ? `${API_BASE}/mystery-shopper/reports/pdf?${params.toString()}`
        : null;
      if (!endpoint) {
        setError("PDF download is not available for this platform yet.");
        return;
      }
      const res = await fetch(endpoint, { headers });
      if (!res.ok) {
        const text = await res.text();
        setError(text || "Failed to download PDF report");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "cwscx-mystery-shopper-report.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setMessage("PDF report downloaded.");
    } catch {
      setError("Failed to download PDF report");
    }
  }, [buildReportParams, headers, isMysteryShopperPlatform, pushToast, validateReportSelection]);

  const handleEmailReport = useCallback(async () => {
    if (!validateReportSelection()) return;
    const recipients = reportEmailTo
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (recipients.length === 0) {
      setError("Enter at least one email address.");
      return;
    }
    setReportSending(true);
    setError("");
    try {
      const payload = {
        report_type: reportType,
        to: recipients,
        ...(isMysteryShopperPlatform ? {} : { survey_type: activePlatform || "B2B" }),
        ...(isMysteryShopperPlatform
          ? { location_id: reportBusinessId ? Number(reportBusinessId) : null }
          : { business_id: reportBusinessId ? Number(reportBusinessId) : null }),
        visit_id: reportVisitId.trim() || null,
        report_date: reportSelectedDate || null,
        date_from: reportDateFrom || null,
        date_to: reportDateTo || null,
      };
      const endpoint = isMysteryShopperPlatform
        ? `${API_BASE}/mystery-shopper/reports/email`
        : `${API_BASE}/dashboard-visits/reports/email`;
      const { res, data } = await fetchJsonSafe(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }, 25000);
      if (!res.ok) {
        setError(data?.detail || "Failed to send report email");
        return;
      }
      setMessage(`Report emailed to ${recipients.join(", ")}.`);
    } finally {
      setReportSending(false);
    }
  }, [activePlatform, fetchJsonSafe, headers, isMysteryShopperPlatform, reportBusinessId, reportDateFrom, reportDateTo, reportEmailTo, reportSelectedDate, reportType, reportVisitId, validateReportSelection]);

  useEffect(() => {
    if (location.pathname !== "/reports") return;
    if (reportType !== "survey") {
      setReportEligibleSurveys([]);
      setReportIneligibleSurveys([]);
      return;
    }
    if (!reportBusinessId) {
      setReportEligibleSurveys([]);
      setReportIneligibleSurveys([]);
      setReportVisitId("");
      return;
    }

    const loadEligibleSurveys = async () => {
      setReportSurveyLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        params.set(isMysteryShopperPlatform ? "location_id" : "business_id", reportBusinessId);
        if (!isMysteryShopperPlatform) params.set("survey_type", activePlatform || "B2B");
        const endpoint = isMysteryShopperPlatform
          ? `${API_BASE}/mystery-shopper/reports/surveys?${params.toString()}`
          : `${API_BASE}/dashboard-visits/reports/surveys?${params.toString()}`;
        const { res, data } = await fetchJsonSafe(endpoint, { headers }, 20000);
        if (!res.ok) {
          setError(data?.detail || "Failed to load report-eligible surveys");
          return;
        }
        const eligible = Array.isArray(data?.eligible) ? data.eligible : [];
        setReportEligibleSurveys(eligible);
        setReportIneligibleSurveys(Array.isArray(data?.ineligible) ? data.ineligible : []);
        if (reportVisitId && !eligible.some((item) => String(item.visit_id) === String(reportVisitId))) {
          setReportVisitId("");
        }
      } finally {
        setReportSurveyLoading(false);
      }
    };

    loadEligibleSurveys();
  }, [activePlatform, fetchJsonSafe, headers, isMysteryShopperPlatform, location.pathname, reportBusinessId, reportType, reportVisitId, setError, setReportVisitId]);

  const loadActionsBoard = useCallback(async () => {
    if (!isB2BPlatform) {
      setActionsBoardItems([]);
      setActionsBoardSummary(null);
      return;
    }

    setActionsBoardLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      params.set("survey_type", activePlatform || "B2B");
      if (actionsFilters.lead_owner.trim()) params.set("lead_owner", actionsFilters.lead_owner.trim());
      if (actionsFilters.support.trim()) params.set("support", actionsFilters.support.trim());
      if (actionsFilters.timeline) params.set("timeline", actionsFilters.timeline);
      if (actionsFilters.action_status) params.set("action_status", actionsFilters.action_status);
      if (actionsFilters.business_id) params.set("business_id", actionsFilters.business_id);

      const { res, data } = await fetchJsonSafe(`${API_BASE}/dashboard-visits/actions?${params.toString()}`, { headers });
      if (!res.ok) {
        setError(data?.detail || "Failed to load actions board");
        return;
      }

      setActionsBoardItems(Array.isArray(data?.items) ? data.items : []);
      setActionsBoardSummary(data?.summary || null);
      setActionsTimelineOptions(
        Array.isArray(data?.timeline_options) && data.timeline_options.length > 0
          ? data.timeline_options
          : ACTION_TIMEFRAME_OPTIONS
      );
      setActionsStatusOptions(
        Array.isArray(data?.status_options) && data.status_options.length > 0
          ? data.status_options
          : ["Outstanding", "In Progress", "Completed"]
      );
    } finally {
      setActionsBoardLoading(false);
    }
  }, [activePlatform, actionsFilters, fetchJsonSafe, headers, isB2BPlatform]);

  const handleUpdateActionPointStatus = useCallback(async (item, draft = {}) => {
    const rid = String(item?.response_id || "").trim();
    const aidx = Number(item?.action_index ?? 0);
    if (!rid) {
      setError("Action point cannot be updated: response_id is missing or invalid.");
      return;
    }
    if (!Number.isFinite(aidx) || aidx < 0) {
      setError("Action point cannot be updated: action_index is invalid.");
      return;
    }
    const payload = {
      response_id: rid,
      action_index: aidx,
      status: draft.action_status || item.action_status || "Outstanding",
      comments: draft.action_comments ?? item.action_comments ?? "",
    };
    const { res, data } = await fetchJsonSafe(`${API_BASE}/dashboard-visits/actions/status`, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const rawDetail = data?.detail;
      const msg = Array.isArray(rawDetail)
        ? rawDetail.map((e) => e.msg || JSON.stringify(e)).join("; ")
        : (typeof rawDetail === "string" ? rawDetail : null);
      setError(msg || "Failed to update action point status");
      return;
    }
    setActionsBoardItems((prev) => prev.map((row) => {
      if (row.response_id === item.response_id && Number(row.action_index || 0) === Number(item.action_index || 0)) {
        return {
          ...row,
          action_status: data?.action_status || payload.status,
          action_comments: data?.action_comments ?? payload.comments,
        };
      }
      return row;
    }));
    setMessage("Action point updated.");
  }, [fetchJsonSafe, headers]);

  const loadPlannedVisits = async () => {
    if (!isB2BPlatform) {
      setPlannedVisits([]);
      return;
    }
    setPlannedLoading(true);
    const params = new URLSearchParams({ status: "Draft", survey_type: "B2B", _cb: Date.now().toString() });
    const { res, data } = await fetchJsonSafe(`${API_BASE}/dashboard-visits/all?${params.toString()}`, { headers });
    setPlannedLoading(false);
    if (!res.ok) {
      setError(data?.detail || "Failed to load planned visits");
      return;
    }
    const rows = Array.isArray(data) ? data : [];
    rows.sort((a, b) => String(a.visit_date || "").localeCompare(String(b.visit_date || "")));
    setPlannedVisits(rows);
  };

  const handleCreatePlannedVisit = async () => {
    if (!isB2BPlatform) return;
    if (!plannedForm.business_id || !plannedForm.visit_date) {
      setError("Business and visit date are required.");
      return;
    }
    setError("");
    setMessage("");
    pushToast("info", "Creating planned visit...", 1500);
    const payload = {
      business_id: Number(plannedForm.business_id),
      representative_id: Number(headers["X-User-Id"] || 0),
      visit_date: plannedForm.visit_date,
      visit_type: plannedForm.visit_type,
      survey_type: "B2B",
    };
    const res = await fetch(`${API_BASE}/dashboard-visits?_cb=${Date.now()}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || "Failed to create planned visit");
      return;
    }
    setMessage("Planned visit created.");
    await loadPlannedVisits();
  };

  const handleDeletePlannedVisit = async (visitId) => {
    if (!window.confirm("Delete this draft planned visit?")) return;
    pushToast("info", "Deleting planned visit...", 1500);
    const res = await fetch(`${API_BASE}/dashboard-visits/${visitId}?_cb=${Date.now()}`, { method: "DELETE", headers });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || "Failed to delete planned visit");
      return;
    }
    setMessage("Planned visit deleted.");
    await loadPlannedVisits();
  };

  const startEditPlannedVisit = (visit) => {
    const visitId = String(visit.id || visit.visit_id || "");
    setEditingPlannedVisitId(visitId);
    setPlannedEditForm({ visit_date: visit.visit_date || "", visit_type: visit.visit_type || "Planned" });
  };

  const cancelEditPlannedVisit = () => {
    setEditingPlannedVisitId("");
    setPlannedEditForm({ visit_date: "", visit_type: "Planned" });
  };

  const savePlannedVisitEdit = async (visitId) => {
    if (!plannedEditForm.visit_date) {
      setError("Visit date is required.");
      return;
    }
    pushToast("info", "Saving planned visit changes...", 1500);
    const res = await fetch(`${API_BASE}/dashboard-visits/${visitId}/draft?_cb=${Date.now()}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ visit_date: plannedEditForm.visit_date, visit_type: plannedEditForm.visit_type }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || "Failed to update planned visit");
      return;
    }
    setMessage("Planned visit updated.");
    cancelEditPlannedVisit();
    await loadPlannedVisits();
  };

  const loadSurveyVisitDetails = async (visitId) => {
    const endpoint = isMysteryShopperPlatform
      ? `${API_BASE}/mystery-shopper/visits/${visitId}`
      : `${API_BASE}/dashboard-visits/${visitId}`;
    const res = await fetch(endpoint, { headers });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || "Failed to load survey details");
      return;
    }
    setSelectedSurveyVisit(data);
    const drafts = {};
    (Array.isArray(data?.responses) ? data.responses : []).forEach((response) => {
      drafts[String(response.response_id)] = {
        answer_text: response.answer_text || "",
        verbatim: response.verbatim || "",
        actions: Array.isArray(response.actions) ? response.actions : [],
      };
    });
    setReviewResponseDrafts(drafts);
  };

  const handleReviewDecision = async (visit, decision) => {
    const visitId = String(visit?.id || visit?.visit_id || "");
    if (!visitId) return;

    const isApprove = decision === "approve";
    const decisionLabel = isApprove ? "approve" : "reject";
    const reasonLabel = isApprove ? "approval notes" : "rejection reason";
    const notes = window.prompt(`Add ${reasonLabel} (optional):`, "") || "";

    setReviewActionLoadingVisitId(visitId);
    pushToast("info", `${isApprove ? "Approving" : "Rejecting"} visit...`, 1400);

    const payload = isApprove ? { approval_notes: notes } : { rejection_notes: notes };
    const endpoint = isMysteryShopperPlatform
      ? `${API_BASE}/mystery-shopper/visits/${visitId}/${decision}`
      : `${API_BASE}/dashboard-visits/${visitId}/${decision}`;
    const { res, data } = await fetchJsonSafe(endpoint, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload),
    });

    setReviewActionLoadingVisitId("");

    if (!res.ok) {
      setError(data?.detail || `Failed to ${decisionLabel} visit`);
      return;
    }

    setMessage(`Visit ${visitId} ${isApprove ? "approved" : "rejected"}.`);
    if (selectedSurveyVisit?.id === visitId) {
      setSelectedSurveyVisit(null);
    }

    await Promise.all([loadPendingVisits(), loadSurveyResults()]);
  };

  const formatSurveyResponseValue = (response) => {
    const hasScore = response?.score !== null && response?.score !== undefined;
    if (hasScore) {
      return {
        label: "Score",
        value: String(response.score),
      };
    }

    const answerText = typeof response?.answer_text === "string" ? response.answer_text.trim() : "";
    if (answerText) {
      return {
        label: "Answer",
        value: answerText,
      };
    }

    return {
      label: "Answer",
      value: "--",
    };
  };

  const canEditResponseAnswer = (response) => {
    const type = String(response?.question_type || "").toLowerCase();
    if (!type) {
      return response?.score == null;
    }
    return type !== "score" && type !== "yes_no";
  };

  const canEditResponseActions = (response) => {
    return Boolean(response?.response_id);
  };

  const updateReviewDraft = (responseId, updater) => {
    setReviewResponseDrafts((prev) => {
      const current = prev[responseId] || {};
      return { ...prev, [responseId]: typeof updater === "function" ? updater(current) : updater };
    });
  };

  const updateReviewAction = (responseId, actionIndex, field, value) => {
    updateReviewDraft(responseId, (current) => {
      const actions = Array.isArray(current.actions) ? [...current.actions] : [];
      actions[actionIndex] = { ...(actions[actionIndex] || {}), [field]: value };
      return { ...current, actions };
    });
  };

  const addReviewAction = (responseId) => {
    updateReviewDraft(responseId, (current) => ({
      ...current,
      actions: [
        ...(Array.isArray(current.actions) ? current.actions : []),
        { action_required: "", action_owner: "", action_timeframe: "", action_support_needed: "", action_comments: "" },
      ],
    }));
  };

  const removeReviewAction = (responseId, actionIndex) => {
    updateReviewDraft(responseId, (current) => ({
      ...current,
      actions: (Array.isArray(current.actions) ? current.actions : []).filter((_, index) => index !== actionIndex),
    }));
  };

  const saveReviewResponseEdits = async (response) => {
    const responseId = String(response?.response_id || "");
    const visitId = String(selectedSurveyVisit?.id || selectedSurveyVisit?.visit_id || "");
    if (!responseId || !visitId) return;
    const draft = reviewResponseDrafts[responseId] || {};
    const payload = {
      question_id: response.question_id,
      score: response.score,
      answer_text: canEditResponseAnswer(response) ? (draft.answer_text ?? response.answer_text ?? "") : response.answer_text,
      verbatim: draft.verbatim ?? response.verbatim ?? "",
      actions: draft.actions ?? response.actions ?? [],
    };
    setReviewSavingResponseId(responseId);
    const endpoint = isMysteryShopperPlatform
      ? `${API_BASE}/mystery-shopper/visits/${visitId}/responses/${responseId}`
      : `${API_BASE}/dashboard-visits/${visitId}/responses/${responseId}`;
    const { res, data } = await fetchJsonSafe(endpoint, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload),
    });
    setReviewSavingResponseId("");
    if (!res.ok) {
      setError(data?.detail || "Failed to update response");
      return;
    }
    setMessage("Survey response updated.");
    await loadSurveyVisitDetails(visitId);
  };

  const formatReadableDateTime = (value) => {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  useEffect(() => {
    if (!isB2BPlatform) {
      setSelectedSurveyBusiness("");
    }
    if (!isMysteryShopperPlatform) {
      setSelectedSurveyLocation("");
    }
    if (!isInstallationPlatform) {
      setSelectedInstallationSurvey(null);
    }
  }, [isB2BPlatform, isMysteryShopperPlatform, isInstallationPlatform]);

   useEffect(() => {
     if (location.pathname !== "/surveys") return;
    loadSurveyResults();
   }, [location.pathname, activePlatform, surveyStatusFilter, selectedSurveyBusiness, selectedSurveyLocation]);

   useEffect(() => {
     if (location.pathname !== "/planned") return;
     loadPlannedVisits();
   }, [location.pathname, activePlatform]);

  useEffect(() => {
    if (location.pathname !== "/actions") return;
    loadActionsBoard();
  }, [location.pathname, loadActionsBoard]);

  useEffect(() => {
    setReportPreview(null);
    setReportPreviewHtml("");
  }, [reportType, reportBusinessId, reportVisitId, reportSelectedDate, reportDateFrom, reportDateTo]);

  useEffect(() => {
    setReportBusinessId("");
    setReportVisitId("");
    setReportSelectedDate("");
    setReportDateFrom("");
    setReportDateTo("");
    setReportEligibleSurveys([]);
    setReportIneligibleSurveys([]);
    setReportPreview(null);
    setReportPreviewHtml("");
  }, [reportType]);

  useEffect(() => {
    if (!isMysteryShopperPlatform) return;
    if (reportType === "action_points") setReportType("lifetime");
  }, [isMysteryShopperPlatform, reportType]);

   const analyticsCards = [
     ...(isMysteryShopperPlatform
        ? [
            { title: "Total Responses", value: analytics?.nps?.total_responses ?? 0 },
            { title: "Draft Visits", value: analytics?.visits?.draft ?? 0 },
            { title: "Pending Visits", value: analytics?.visits?.pending ?? 0 },
            { title: "Review Queue", value: pendingVisits.length },
          ]
        : [
            { title: "NPS", value: analytics?.nps?.nps ?? "--", numericValue: analytics?.nps?.nps, metric: "b2b_nps" },
            { title: "CSAT", value: `${analytics?.customer_satisfaction?.csat_score?.toFixed?.(1) ?? "--"}%`, numericValue: analytics?.customer_satisfaction?.csat_score, metric: "b2b_csat" },
          ]),
     ...(isB2BPlatform && !isMysteryShopperPlatform
        ? [
            { title: "Relationship Score", value: analytics?.relationship_score?.score?.toFixed?.(1) ?? "--", numericValue: analytics?.relationship_score?.score, metric: "b2b_relationship" },
            { title: "Competitive Exposure", value: `${analytics?.competitive_exposure?.exposure_rate?.toFixed?.(1) ?? "--"}%`, numericValue: analytics?.competitive_exposure?.exposure_rate, metric: "b2b_competitive_exposure" }
          ]
        : []),
     ];

   const reportTypeOptions = isMysteryShopperPlatform
     ? REPORT_TYPE_OPTIONS.filter((option) => option.key !== "action_points")
     : REPORT_TYPE_OPTIONS;

   const reportMetricCards = [
     { title: "Selected NPS", value: reportPreview?.analytics_comparison?.nps?.selected ?? "--", metric: "b2b_nps" },
     ...(reportType === "lifetime" ? [{ title: "Overall NPS", value: reportPreview?.analytics_comparison?.nps?.overall ?? "--", metric: "b2b_nps" }] : []),
     { title: "Selected CSAT", value: `${reportPreview?.analytics_comparison?.csat?.selected?.toFixed?.(1) ?? "--"}%`, metric: "b2b_csat" },
     ...(reportType === "lifetime" ? [{ title: "Overall CSAT", value: `${reportPreview?.analytics_comparison?.csat?.overall?.toFixed?.(1) ?? "--"}%`, metric: "b2b_csat" }] : []),
     { title: "Selected Relationship", value: reportPreview?.analytics_comparison?.relationship_score?.selected?.toFixed?.(1) ?? "--", metric: "b2b_relationship" },
     ...(reportType === "lifetime" ? [{ title: "Overall Relationship", value: reportPreview?.analytics_comparison?.relationship_score?.overall?.toFixed?.(1) ?? "--", metric: "b2b_relationship" }] : []),
     { title: "Selected Competitive Exposure", value: `${reportPreview?.analytics_comparison?.competitor_exposure?.selected?.toFixed?.(1) ?? "--"}%`, metric: "b2b_competitive_exposure" },
     ...(reportType === "lifetime" ? [{ title: "Overall Competitive Exposure", value: `${reportPreview?.analytics_comparison?.competitor_exposure?.overall?.toFixed?.(1) ?? "--"}%`, metric: "b2b_competitive_exposure" }] : []),
   ];

   const mysteryReportMetricCards = [
     { title: "Selected NPS", value: reportPreview?.mystery_metrics?.selected_nps ?? "--", metric: "b2b_nps" },
     ...(reportType === "lifetime" ? [{ title: "Overall NPS", value: reportPreview?.mystery_metrics?.overall_nps ?? "--", metric: "b2b_nps" }] : []),
     { title: "Selected CSAT Avg", value: reportPreview?.mystery_metrics?.selected_csat?.toFixed?.(2) ?? "--", metric: "b2b_csat" },
     ...(reportType === "lifetime" ? [{ title: "Overall CSAT Avg", value: reportPreview?.mystery_metrics?.overall_csat?.toFixed?.(2) ?? "--", metric: "b2b_csat" }] : []),
     { title: "Overall Experience", value: reportPreview?.mystery_metrics?.selected_overall_experience?.toFixed?.(2) ?? "--", metric: "b2b_relationship" },
     { title: "Service Quality", value: reportPreview?.mystery_metrics?.selected_quality?.toFixed?.(2) ?? "--", metric: "b2b_relationship" },
   ];

   const installPreviewAverage = (items, key, target) => {
     const match = (Array.isArray(items) ? items : []).find((item) => item[key] === target);
     return match?.average_score ?? null;
   };

   const installationReportMetricCards = [
     { title: "Overall Average", value: installReportPreview?.summary?.overall_average_score?.toFixed?.(2) ?? "--", metric: "installation_average" },
     { title: "B2B Average", value: installPreviewAverage(installReportPreview?.customer_type_averages, "customer_type", "B2B")?.toFixed?.(2) ?? "--", metric: "installation_average" },
     { title: "B2C Average", value: installPreviewAverage(installReportPreview?.customer_type_averages, "customer_type", "B2C")?.toFixed?.(2) ?? "--", metric: "installation_average" },
     { title: "Field Team Average", value: installPreviewAverage(installReportPreview?.worker_type_averages, "worker_type", "Field Team")?.toFixed?.(2) ?? "--", metric: "installation_average" },
     { title: "Contractor Average", value: installPreviewAverage(installReportPreview?.worker_type_averages, "worker_type", "Contractor")?.toFixed?.(2) ?? "--", metric: "installation_average" },
   ];

   // Prepare NPS pie data
   const npsPieData = useMemo(() => {
     const nps = analytics?.nps;
     if (!nps) return [];
     return [
       { name: "Promoters", value: nps.promoters || 0, color: COLORS.promoters },
       { name: "Passives", value: nps.passives || 0, color: COLORS.passives },
       { name: "Detractors", value: nps.detractors || 0, color: COLORS.detractors },
     ];
   }, [analytics]);

   // Prepare CSAT pie data
   const csatPieData = useMemo(() => {
     const csat = analytics?.customer_satisfaction?.score_distribution;
     if (!csat) return [];
     return [
       { name: "Very Satisfied", value: csat.very_satisfied || 0, color: COLORS.very_satisfied },
       { name: "Satisfied", value: csat.satisfied || 0, color: COLORS.satisfied },
       { name: "Neutral", value: csat.neutral || 0, color: COLORS.neutral },
       { name: "Dissatisfied", value: csat.dissatisfied || 0, color: COLORS.dissatisfied },
       { name: "Very Dissatisfied", value: csat.very_dissatisfied || 0, color: COLORS.very_dissatisfied },
     ];
    }, [analytics]);

  const representativeMap = useMemo(() => {
    return representatives.reduce((acc, rep) => {
      const label = rep.name || rep.full_name || rep.display_name || rep.email || "Unknown";
      acc[rep.id] = label;
      acc[String(rep.id)] = label;
      return acc;
    }, {});
  }, [representatives]);

  const filteredAnalyticsBusinesses = useMemo(() => {
    const query = analyticsBusinessSearch.trim().toLowerCase();
    if (!query) return businesses;
    return businesses.filter((b) => {
      const name = (b.name || "").toLowerCase();
      const location = (b.location || "").toLowerCase();
      return name.includes(query) || location.includes(query);
    });
  }, [businesses, analyticsBusinessSearch]);

  const filteredAnalyticsLocations = useMemo(() => {
    const query = analyticsLocationSearch.trim().toLowerCase();
    if (!query) return mysteryLocations;
    return mysteryLocations.filter((item) => (item.name || "").toLowerCase().includes(query));
  }, [mysteryLocations, analyticsLocationSearch]);

  const mysteryAnalyticsSummary = useMemo(() => {
    if (!isMysteryShopperPlatform) {
      return { qualityAvg: null, overallExperienceAvg: null };
    }
    const weightedAverage = (items) => {
      const weighted = items.reduce(
        (acc, item) => {
          const score = Number(item.average_score || 0);
          const count = Number(item.response_count || 0);
          if (!count || Number.isNaN(score)) return acc;
          return {
            scoreSum: acc.scoreSum + score * count,
            countSum: acc.countSum + count,
          };
        },
        { scoreSum: 0, countSum: 0 }
      );
      return weighted.countSum > 0 ? weighted.scoreSum / weighted.countSum : null;
    };

    const overallExperience = questionAverages.filter((item) =>
      (item.category || "").toLowerCase().includes("overall experience")
    );
    const qualityQuestions = questionAverages.filter((item) => {
      const category = (item.category || "").toLowerCase();
      if (category.includes("overall experience")) return false;
      return Number(item.average_score || 0) <= 5.2;
    });

    return {
      qualityAvg: weightedAverage(qualityQuestions),
      overallExperienceAvg: weightedAverage(overallExperience),
    };
  }, [isMysteryShopperPlatform, questionAverages]);

  const groupedActionsBoard = useMemo(() => {
    const grouped = {};
    actionsBoardItems.forEach((item) => {
      const surveyName = item.survey_type || "Unknown";
      const businessName = item.business_name || "Unknown";
      if (!grouped[surveyName]) grouped[surveyName] = {};
      if (!grouped[surveyName][businessName]) grouped[surveyName][businessName] = [];
      grouped[surveyName][businessName].push(item);
    });
    return grouped;
  }, [actionsBoardItems]);


   const categoryBreakdownData = useMemo(() => {
    const shouldUseTargetedBreakdown = selectedAnalyticsEntityIds.length > 0;
    if (!questionAverages.length) {
      return analytics?.category_breakdown || [];
    }
    if (!shouldUseTargetedBreakdown && Array.isArray(analytics?.category_breakdown) && analytics.category_breakdown.length > 0) {
      return analytics.category_breakdown;
    }

    const grouped = questionAverages.reduce((acc, item) => {
      const category = item.category || "Uncategorized";
      if (!acc[category]) {
        acc[category] = { category, weightedScore: 0, responseCount: 0 };
      }
      const score = Number(item.average_score || 0);
      const count = Number(item.response_count || 0);
      acc[category].weightedScore += score * count;
      acc[category].responseCount += count;
      return acc;
    }, {});

    return Object.values(grouped)
      .map((item) => ({
        category: item.category,
        average_score: item.responseCount > 0 ? item.weightedScore / item.responseCount : 0,
        response_count: item.responseCount,
      }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [analytics, questionAverages, selectedAnalyticsEntityIds]);

  const categoryQuestions = useMemo(() => {
    const grouped = {};
    questionAverages.forEach((question) => {
      const category = question.category || "Uncategorized";
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push({
        id: question.question_id,
        question_number: question.question_number,
        question_text: question.question_text,
      });
    });
    Object.keys(grouped).forEach((category) => {
      grouped[category].sort((a, b) => Number(a.question_number || 0) - Number(b.question_number || 0));
    });
    return grouped;
  }, [questionAverages]);

  const npsBreakdown = useMemo(() => {
    const nps = analytics?.nps || {};
    const promoters = Number(nps.promoters || 0);
    const passives = Number(nps.passives || 0);
    const detractors = Number(nps.detractors || 0);
    const total = Number(nps.total_responses || 0);
    const toPct = (value) => (total > 0 ? ((value / total) * 100).toFixed(1) : "0.0");
    return {
      promoters,
      passives,
      detractors,
      promotersPct: toPct(promoters),
      passivesPct: toPct(passives),
      detractorsPct: toPct(detractors),
    };
  }, [analytics?.nps]);

  const surveyResponseCategoryGroups = useMemo(() => {
    const responses = Array.isArray(selectedSurveyVisit?.responses) ? selectedSurveyVisit.responses : [];
    const grouped = responses.reduce((acc, response) => {
      const category = String(response.category || "Uncategorized").trim() || "Uncategorized";
      if (!acc[category]) acc[category] = [];
      acc[category].push(response);
      return acc;
    }, {});

    const categorySortValue = (categoryName) => {
      const match = String(categoryName || "").match(/category\s*(\d+)/i);
      return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
    };

    return Object.entries(grouped)
      .map(([category, groupedResponses]) => ({
        category,
        responses: groupedResponses.sort((a, b) => Number(a.question_number || a.question_id || 0) - Number(b.question_number || b.question_id || 0)),
      }))
      .sort((a, b) => {
        const aOrder = categorySortValue(a.category);
        const bOrder = categorySortValue(b.category);
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.category.localeCompare(b.category);
      });
  }, [selectedSurveyVisit]);

  const relationshipGraphData = useMemo(() => {
    const score = Number(analytics?.relationship_score?.score || 0);
    return [{ label: "Relationship", score: Number.isFinite(score) ? score : 0 }];
  }, [analytics]);

  const competitorGraphData = useMemo(() => {
    const totalAccounts = Number(analytics?.competitive_exposure?.total_accounts || 0);
    const usingCompetitors = Number(analytics?.competitive_exposure?.accounts_using_competitors || 0);
    return [
      { label: "Using Competitors", value: usingCompetitors },
      { label: "Total Accounts", value: totalAccounts },
    ];
  }, [analytics]);

  const yesNoBarChartData = useMemo(() => {
    return yesNoQuestionAnalytics.map((item) => ({
      label: `Q${item.question_number || item.question_id}`,
      question_text: item.question_text,
      question_key: item.question_key,
      question_number: Number(item.question_number || item.question_id || 0),
      yes_percent: Number(item.yes_percent || 0),
      no_percent: Number(item.no_percent || 0),
      yes_count: Number(item.yes_count || 0),
      no_count: Number(item.no_count || 0),
      total_count: Number(item.total_count || 0),
    }));
  }, [yesNoQuestionAnalytics]);

  const accountExecutiveYesNoChartData = useMemo(() => {
    const grouped = accountExecutiveYesNoTrendData.reduce((acc, item) => {
      const name = item.account_executive_name || "Unassigned";
      if (!acc[name]) {
        acc[name] = {
          accountExecutive: name,
          q4YesPercent: 0,
          q6YesPercent: 0,
        };
      }
      if (Number(item.question_number) === 4) {
        acc[name].q4YesPercent = Number(item.yes_percent || 0);
      }
      if (Number(item.question_number) === 6) {
        acc[name].q6YesPercent = Number(item.yes_percent || 0);
      }
      return acc;
    }, {});

    return Object.values(grouped).sort((a, b) => a.accountExecutive.localeCompare(b.accountExecutive));
  }, [accountExecutiveYesNoTrendData]);

  const yesNoQuestionCards = useMemo(() => {
    const requiredQuestions = [
      {
        key: "q04_ae_business_understanding",
        number: 4,
        text: "Does the C&W Account Executive understand your business?.",
      },
      {
        key: "q06_regular_updates",
        number: 6,
        text: "Are you receiving regular updates on your account? (Y or N).",
      },
      {
        key: "q09_issues_resolved_on_time",
        number: 9,
        text: "Are your issues resolved on time? (Y/N)",
      },
      {
        key: "q16_other_provider_products",
        number: 16,
        text: "Do you have other products and services from other service providers? (Yes or No)",
      },
      {
        key: "q18_competitor_service_with_cws",
        number: 18,
        text: "Would you consider taking this service with CWS?",
      },
    ];

    return requiredQuestions.map((required) => {
      const matched = yesNoBarChartData.find(
        (item) => item.question_key === required.key || item.question_number === required.number
      );

      const yesCount = Number(matched?.yes_count || 0);
      const noCount = Number(matched?.no_count || 0);
      const totalCount = Number(matched?.total_count || 0);
      const yesPercent = totalCount > 0 ? (yesCount / totalCount) * 100 : 0;
      const noPercent = totalCount > 0 ? (noCount / totalCount) * 100 : 0;

      return {
        key: required.key,
        label: `Question ${required.number}`,
        question_text: matched?.question_text || required.text,
        yes_count: yesCount,
        no_count: noCount,
        total_count: totalCount,
        yes_percent: yesPercent,
        no_percent: noPercent,
        chart_data: [
          { name: "Yes", value: yesCount, color: "#16a34a" },
          { name: "No", value: noCount, color: "#dc2626" },
        ],
      };
    });
  }, [yesNoBarChartData]);

  const loadRepresentatives = useCallback(async () => {
    if (!isB2BPlatform) {
      setRepresentatives([]);
      return;
    }
    try {
      const { res, data } = await fetchJsonSafe(`${B2B_API_BASE}/public/account-executives`, { headers }, 30000);
      if (!res.ok) return;
      setRepresentatives(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err?.name === "AbortError") return;
      console.error("Failed to load representatives", err);
    }
  }, [isB2BPlatform, headers, fetchJsonSafe]);

  useEffect(() => {
    loadRepresentatives();
  }, [loadRepresentatives]);

  // Business CRUD handlers
  const handleEditBusiness = (business) => {
    setSelectedBusiness(business);
    setBusinessForm({
      name: business.name,
      location: business.location || "",
      priority_level: normalizeBusinessPriorityLevel(business.priority_level),
      active: business.active,
      account_executive_id: business.account_executive_id ? String(business.account_executive_id) : ""
    });
    setAccountExecutiveQuery(
      business.account_executive_id ? representativeMap[business.account_executive_id] || "" : ""
    );
  };

  const handleCreateBusiness = async () => {
    setError("");
    setMessage("");
    pushToast("info", "Creating business...", 1500);
    if (!businessForm.name.trim()) {
      setError("Business name is required.");
      return;
    }
    const payload = {
      name: businessForm.name.trim(),
      location: businessForm.location.trim() || null,
      priority_level: normalizeBusinessPriorityLevel(businessForm.priority_level),
      active: businessForm.active,
      account_executive_id: businessForm.account_executive_id ? Number(businessForm.account_executive_id) : null
    };
    const res = await fetch(`${API_BASE}/businesses`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || "Failed to create business");
      return;
    }
    setBusinessForm({ name: "", location: "", priority_level: "sme", active: true, account_executive_id: "" });
    setAccountExecutiveQuery("");
    setMessage(`Business created: ${data.name}`);
    await loadBusinesses();
  };

  const handleUpdateBusiness = async () => {
    if (!selectedBusiness) return;
    setError("");
    setMessage("");
    pushToast("info", "Updating business...", 1500);
    const payload = {
      name: businessForm.name.trim(),
      location: businessForm.location.trim() || null,
      priority_level: normalizeBusinessPriorityLevel(businessForm.priority_level),
      active: businessForm.active,
      account_executive_id: businessForm.account_executive_id ? Number(businessForm.account_executive_id) : null
    };
    const res = await fetch(`${API_BASE}/businesses/${selectedBusiness.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || "Failed to update business");
      return;
    }
    setMessage(`Business updated: ${data.name}`);
    setSelectedBusiness(null);
    setBusinessForm({ name: "", location: "", priority_level: "sme", active: true, account_executive_id: "" });
    setAccountExecutiveQuery("");
    await loadBusinesses();
  };

  const handleRetireBusiness = async (business) => {
    setError("");
    setMessage("");
    pushToast("info", "Archiving business...", 1500);
    const res = await fetch(`${B2B_API_BASE}/businesses/${business.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ active: false })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || "Failed to retire business");
      return;
    }
    setMessage(`Business retired: ${data.name}`);
    await loadBusinesses();
  };

  const handleDeleteBusiness = async (business) => {
    setError("");
    setMessage("");
    pushToast("info", "Deleting business...", 1500);
    const confirmMessage = business.active
      ? `Are you sure you want to delete "${business.name}"? This action cannot be undone.`
      : `Are you sure you want to permanently delete "${business.name}"? This action cannot be undone.`;
    if (!window.confirm(confirmMessage)) return;
    const { res, data } = await fetchJsonSafe(`${B2B_API_BASE}/businesses/${business.id}`, {
      method: "DELETE",
      headers,
    });
    if (!res.ok) {
      setError(data?.detail || "Failed to delete business");
      return;
    }
    setBusinesses((prev) => prev.filter((item) => item.id !== business.id));
    setMessage(`Business deleted: ${business.name}`);
    pushToast("success", `Business removed: ${business.name}`);
  };

  const loadBusinesses = async () => {
    if (!isB2BPlatform) {
      setBusinesses([]);
      return;
    }
    try {
      const { res, data } = await fetchJsonSafe(`${B2B_API_BASE}/public/businesses`, { headers });
      if (!res.ok) {
        setError(data?.detail || "Failed to load businesses");
        return;
      }
      setBusinesses(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load businesses");
    }
  };

  useEffect(() => {
     loadBusinesses();
   }, [isB2BPlatform, fetchJsonSafe]);

  const resetExecutiveForm = () => {
    setSelectedExecutive(null);
    setExecutiveForm({ name: "", email: "" });
  };

  const saveExecutive = async () => {
    if (!isB2BPlatform) return;
    if (!executiveForm.name.trim() || !executiveForm.email.trim()) {
      setError("Account executive name and email are required.");
      return;
    }
    const isEdit = Boolean(selectedExecutive?.id && selectedExecutive.id !== "new");
    const url = isEdit ? `${API_BASE}/account-executives/${selectedExecutive.id}` : `${API_BASE}/account-executives`;
    const method = isEdit ? "PUT" : "POST";
    const { res, data } = await fetchJsonSafe(url, {
      method,
      headers,
      body: JSON.stringify({ name: executiveForm.name.trim(), email: executiveForm.email.trim() }),
    });
    if (!res.ok) {
      setError(formatApiError(data?.detail, `Failed to ${isEdit ? "update" : "create"} account executive`));
      return;
    }
    setMessage(`Account executive ${isEdit ? "updated" : "created"}.`);
    resetExecutiveForm();
    await loadRepresentatives();
  };

  const editExecutive = (executive) => {
    setSelectedExecutive(executive);
    setExecutiveForm({ name: executive.name || "", email: executive.email || "" });
  };

  const deleteExecutive = async (executive) => {
    if (!window.confirm(`Delete account executive "${executive.name}"?`)) return;
    const { res, data } = await fetchJsonSafe(`${API_BASE}/account-executives/${executive.id}`, { method: "DELETE", headers });
    if (!res.ok) {
      setError(formatApiError(data?.detail, "Failed to delete account executive"));
      return;
    }
    setMessage(`Account executive deleted: ${executive.name}`);
    setRepresentatives((prev) => prev.filter((item) => item.id !== executive.id));
    if (selectedExecutive?.id === executive.id) resetExecutiveForm();
  };

  useEffect(() => {
    if (!isB2BPlatform) return;
    if (!businesses.length) return;
    setPlannedForm((prev) => ({ ...prev, business_id: prev.business_id || String(businesses[0].id) }));
  }, [businesses, isB2BPlatform]);

  const createMysteryLocation = async () => {
    const name = newMysteryLocation.trim();
    if (!name) {
      setError("Location name is required");
      return;
    }
    pushToast("info", "Adding location...", 1500);
    const { res, data } = await fetchJsonSafe(`${API_BASE}/mystery-shopper/locations`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name }),
    }, 30000);
    if (!res.ok) {
      setError(data?.detail || "Failed to create location");
      return;
    }
    setNewMysteryLocation("");
    setMessage(`Location added: ${data?.name}`);
    await loadMysteryLocations();
  };

  const deactivateMysteryLocation = async (locationId) => {
    pushToast("info", "Archiving location...", 1500);
    const { res, data } = await fetchJsonSafe(`${API_BASE}/mystery-shopper/locations/${locationId}`, { method: "DELETE", headers }, 30000);
    if (!res.ok) {
      setError(data?.detail || "Failed to deactivate location");
      return;
    }
    setMessage(`Location archived: ${data?.name}`);
    await loadMysteryLocations();
  };

  const reactivateMysteryLocation = async (locationId) => {
    pushToast("info", "Reactivating location...", 1500);
    const { res, data } = await fetchJsonSafe(`${API_BASE}/mystery-shopper/locations/${locationId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ active: true }),
    }, 30000);
    if (!res.ok) {
      setError(data?.detail || "Failed to reactivate location");
      return;
    }
    setMessage(`Location reactivated: ${data?.name}`);
    await loadMysteryLocations();
  };

  const deleteMysteryLocation = async (locationItem) => {
    if (!window.confirm(`Delete location "${locationItem.name}" permanently?`)) return;
    pushToast("info", "Deleting location...", 1500);
    const { res, data } = await fetchJsonSafe(`${API_BASE}/mystery-shopper/locations/${locationItem.id}/purge`, { method: "DELETE", headers }, 30000);
    if (!res.ok) {
      setError(data?.detail || "Failed to delete location");
      return;
    }
    setMessage(`Location deleted: ${data?.name}`);
    await loadMysteryLocations();
  };

  const createMysteryPurpose = async () => {
    const name = newMysteryPurpose.trim();
    if (!name) {
      setError("Purpose name is required");
      return;
    }
    pushToast("info", "Adding purpose...", 1500);
    const { res, data } = await fetchJsonSafe(`${API_BASE}/mystery-shopper/purposes`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name }),
    }, 30000);
    if (!res.ok) {
      setError(data?.detail || "Failed to create purpose");
      return;
    }
    setNewMysteryPurpose("");
    setMessage(`Purpose added: ${data?.name}`);
    await loadMysteryPurposes();
  };

  const deactivateMysteryPurpose = async (purposeId) => {
    pushToast("info", "Archiving purpose...", 1500);
    const { res, data } = await fetchJsonSafe(`${API_BASE}/mystery-shopper/purposes/${purposeId}`, { method: "DELETE", headers }, 30000);
    if (!res.ok) {
      setError(data?.detail || "Failed to deactivate purpose");
      return;
    }
    setMessage(`Purpose archived: ${data?.name}`);
    await loadMysteryPurposes();
  };

  const reactivateMysteryPurpose = async (purposeId) => {
    pushToast("info", "Reactivating purpose...", 1500);
    const { res, data } = await fetchJsonSafe(`${API_BASE}/mystery-shopper/purposes/${purposeId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ active: true }),
    }, 30000);
    if (!res.ok) {
      setError(data?.detail || "Failed to reactivate purpose");
      return;
    }
    setMessage(`Purpose reactivated: ${data?.name}`);
    await loadMysteryPurposes();
  };

  const deleteMysteryPurpose = async (purposeItem) => {
    if (!window.confirm(`Delete purpose "${purposeItem.name}" permanently?`)) return;
    pushToast("info", "Deleting purpose...", 1500);
    const { res, data } = await fetchJsonSafe(`${API_BASE}/mystery-shopper/purposes/${purposeItem.id}/purge`, { method: "DELETE", headers }, 30000);
    if (!res.ok) {
      setError(data?.detail || "Failed to delete purpose");
      return;
    }
    setMessage(`Purpose deleted: ${data?.name}`);
    await loadMysteryPurposes();
  };

  const seedMysteryLegacyData = async () => {
    setMysteryLegacySeeding(true);
    pushToast("info", "Seeding legacy location data...", 1700);
    const res = await fetch(`${API_BASE}/mystery-shopper/seed-legacy`, { method: "POST", headers });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || "Failed to seed old data");
      setMysteryLegacySeeding(false);
      return;
    }
    setMessage(`Legacy seed completed. Locations: ${data.seeded_location_count || 0}, purposes: ${data.seeded_purpose_count || 0}`);
    await Promise.all([loadMysteryLocations(), loadMysteryPurposes()]);
    setMysteryLegacySeeding(false);
  };

  const toggleAnalyticsBusiness = (businessId) => {
    setSelectedAnalyticsBusinessIds((prev) => {
      if (prev.includes(businessId)) {
        return prev.filter((id) => id !== businessId);
      }
      return [...prev, businessId];
    });
  };

  const toggleAnalyticsLocation = (locationId) => {
    setSelectedAnalyticsLocationIds((prev) => {
      if (prev.includes(locationId)) {
        return prev.filter((id) => id !== locationId);
      }
      return [...prev, locationId];
    });
  };

  return (
    <PageContainer>
      <div className="fixed right-4 bottom-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`animate-in fade-in slide-in-from-bottom-2 rounded-md border px-3 py-2 text-sm shadow-sm pointer-events-auto ${
              toast.kind === "success"
                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200"
                : toast.kind === "error"
                ? "border-rose-500/50 bg-rose-500/15 text-rose-700 dark:text-rose-100"
                : "border-sky-500/40 bg-sky-500/15 text-sky-700 dark:text-sky-100"
            }`}
            role="status"
            onClick={() => dismissToast(toast.id)}
          >
            {toast.title}
          </div>
        ))}
      </div>
      {/* Error display */}
      {errorText && (
        <div className="mb-4 p-4 border border-destructive/50 bg-destructive/10 text-destructive rounded">
          {errorText}
        </div>
      )}

      {message && (
        <div className="mb-4 rounded border border-emerald-400/40 bg-emerald-500/10 p-4 text-emerald-700 dark:text-emerald-300">
          {message}
        </div>
      )}

      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">CX Governance Dashboard</h2>
          <p className="text-muted-foreground">Platform: {activePlatform}</p>
        </div>
      </div>

      {location.pathname === "/" ? (
        isInstallationPlatform ? (
          <InstallationAnalyticsView
            analytics={installationAnalytics}
            loading={installationAnalyticsLoading}
            onRefresh={loadInstallationAnalytics}
          />
        ) : (
        <>
          {isB2BPlatform ? (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Business Focus Filter</CardTitle>
                <CardDescription>Choose one or more businesses to see results for only those businesses.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="Search businesses by name or location"
                  value={analyticsBusinessSearch}
                  onChange={(event) => setAnalyticsBusinessSearch(event.target.value)}
                />
                <div className="max-h-52 space-y-2 overflow-y-auto rounded-md border p-3">
                  {filteredAnalyticsBusinesses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No businesses match this search.</p>
                  ) : (
                    filteredAnalyticsBusinesses.map((business) => {
                      const checked = selectedAnalyticsBusinessIds.includes(business.id);
                      return (
                        <label key={business.id} className="flex cursor-pointer items-center justify-between gap-3 rounded p-1 hover:bg-muted">
                          <span className="text-sm">{business.name}</span>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAnalyticsBusiness(business.id)}
                          />
                        </label>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {isMysteryShopperPlatform ? (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Location Focus Filter</CardTitle>
                <CardDescription>Choose one or more locations to see results for only those locations.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="Search locations"
                  value={analyticsLocationSearch}
                  onChange={(event) => setAnalyticsLocationSearch(event.target.value)}
                />
                <div className="max-h-52 space-y-2 overflow-y-auto rounded-md border p-3">
                  {filteredAnalyticsLocations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No locations match this search.</p>
                  ) : (
                    filteredAnalyticsLocations.map((locationItem) => {
                      const checked = selectedAnalyticsLocationIds.includes(locationItem.id);
                      return (
                        <label key={locationItem.id} className="flex cursor-pointer items-center justify-between gap-3 rounded p-1 hover:bg-muted">
                          <span className="text-sm">{locationItem.name}</span>
                          <input type="checkbox" checked={checked} onChange={() => toggleAnalyticsLocation(locationItem.id)} />
                        </label>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}

          <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {analyticsCards.map((card) => {
              const grade = getTrafficLightMetric(card.metric, card.numericValue ?? card.value);
              return (
              <Card key={card.title} className={cn("transition-all duration-200 hover:-translate-y-1 hover:shadow-lg", card.metric ? grade.card : "")}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <CardDescription>{card.title}</CardDescription>
                    {card.metric ? <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", grade.badge)}>{grade.label}</span> : null}
                  </div>
                  <CardTitle className={cn("text-3xl", card.metric ? grade.value : "")}>{card.value}</CardTitle>
                </CardHeader>
              </Card>
            );})}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <Card className="min-w-0 lg:col-span-8">
                <CardHeader>
                  <CardTitle>Question Trend</CardTitle>
                <Select value={selectedQuestionId} onChange={(event) => setSelectedQuestionId(event.target.value)}>
                  {questionAverages.length === 0 ? <option value="">No questions available</option> : null}
                  {questionAverages.map((question) => (
                    <option key={question.question_id} value={String(question.question_id)}>
                      {question.question_text}
                    </option>
                  ))}
                </Select>
              </CardHeader>
              <CardContent className="min-w-0 h-[360px]">
                {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis domain={[0, 10]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="average" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Loading trend data...</div>
                )}
              </CardContent>
            </Card>

            <Card className="min-w-0 lg:col-span-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Category Breakdown
                  <InfoHint text="Click a category to open the list of questions behind that score. This helps you understand why the number is high or low." />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {categoryBreakdownData.map((item) => (
                  <div key={item.category} className="rounded-md bg-muted/60 p-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto w-full justify-between gap-2 px-2 py-1 text-left"
                      onClick={() => setExpandedCategory((prev) => (prev === item.category ? "" : item.category))}
                    >
                      <span className="text-sm font-medium">{item.category}</span>
                      <span className="inline-flex items-center gap-2">
                        <Badge>{Number(item.average_score || 0).toFixed(2)}</Badge>
                        {expandedCategory === item.category ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </span>
                    </Button>
                    {expandedCategory === item.category ? (
                      <div className="mt-2 rounded-md border bg-background p-2 text-sm">
                        {(categoryQuestions[item.category] || []).length === 0 ? (
                          <p className="text-muted-foreground">No score questions found for this category.</p>
                        ) : (
                          <ul className="space-y-1">
                            {(categoryQuestions[item.category] || []).map((question) => (
                              <li key={`${item.category}-${question.id}`} className="text-muted-foreground">
                                Q{question.question_number || question.id}: {question.question_text}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Detailed NPS and CSAT Section */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 mt-6">
            {/* NPS Card */}
            <Card className="min-w-0 lg:col-span-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  NPS Survey
                  <InfoHint text="NPS tells you how likely customers are to recommend us. We group answers into Promoters (9-10), Passives (7-8), and Detractors (0-6). The final NPS number is Promoters% minus Detractors%. Higher is better." />
                </CardTitle>
                <CardDescription>
                  Based on {analytics?.nps?.total_responses ?? 0} completed responses.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center">
                  <div className={cn("mb-4 text-6xl font-bold", getTrafficLightMetric("b2b_nps", analytics?.nps?.nps).value)}>
                    {analytics?.nps?.nps ?? "--"}
                  </div>
                  
                  <div className="min-w-0 w-full h-64">
                    {npsPieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
                      <PieChart>
                        <Pie
                          data={npsPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {npsPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [value, "Count"]} />
                      </PieChart>
                    </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No NPS data</div>
                    )}
                  </div>

                  <div className="mt-4 grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.promoters }}></div>
                      <span className="text-sm">Promoters: {npsBreakdown.promoters} ({npsBreakdown.promotersPct}%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.passives }}></div>
                      <span className="text-sm">Passives: {npsBreakdown.passives} ({npsBreakdown.passivesPct}%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.detractors }}></div>
                      <span className="text-sm">Detractors: {npsBreakdown.detractors} ({npsBreakdown.detractorsPct}%)</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CSAT Card */}
            <Card className="min-w-0 lg:col-span-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Customer Satisfaction
                  <InfoHint text="CSAT shows the percentage of customers who gave a positive rating. We count Satisfied (7-8) and Very Satisfied (9-10), then divide by all answers. Higher means customers are happier." />
                </CardTitle>
                <CardDescription>
                  Based on {analytics?.customer_satisfaction?.response_count ?? 0} answers to the satisfaction question.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center">
                  <div className={cn("mb-4 text-6xl font-bold", getTrafficLightMetric("b2b_csat", analytics?.customer_satisfaction?.csat_score).value)}>
                    {analytics?.customer_satisfaction?.csat_score?.toFixed?.(1) ?? "--"}%
                  </div>
                  
                  <div className="min-w-0 w-full h-64">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
                      <PieChart>
                        <Pie
                          data={csatPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {csatPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [value, "Count"]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="mt-4 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.very_satisfied }}></div>
                      <span className="text-xs">Very Satisfied (9-10): {analytics?.customer_satisfaction?.score_distribution?.very_satisfied ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.satisfied }}></div>
                      <span className="text-xs">Satisfied (7-8): {analytics?.customer_satisfaction?.score_distribution?.satisfied ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.neutral }}></div>
                      <span className="text-xs">Neutral (5-6): {analytics?.customer_satisfaction?.score_distribution?.neutral ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.dissatisfied }}></div>
                      <span className="text-xs">Dissatisfied (3-4): {analytics?.customer_satisfaction?.score_distribution?.dissatisfied ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-2 col-span-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.very_dissatisfied }}></div>
                      <span className="text-xs">Very Dissatisfied (0-2): {analytics?.customer_satisfaction?.score_distribution?.very_dissatisfied ?? 0}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {isB2BPlatform ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mt-6">
              <Card className={cn("min-w-0", getTrafficLightMetric("b2b_relationship", analytics?.relationship_score?.score).card)}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Overall Relationship Score
                    <InfoHint text="This score combines key relationship questions into one number from 0 to 100. A higher score means customers feel the relationship is strong and healthy." />
                  </CardTitle>
                  <CardDescription>A simple 0-100 score that summarizes relationship quality from key relationship questions. Higher means a stronger relationship.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className={cn("text-4xl font-semibold", getTrafficLightMetric("b2b_relationship", analytics?.relationship_score?.score).value)}>{analytics?.relationship_score?.score?.toFixed?.(1) ?? "--"}</div>
                  <div className="min-w-0 h-48">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
                      <BarChart data={relationshipGraphData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip formatter={(value) => [`${Number(value).toFixed(1)} / 100`, "Score"]} />
                        <Bar dataKey="score" radius={[6, 6, 0, 0]} fill="#0ea5e9" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded bg-muted p-3">
                      <p className="text-muted-foreground">Average Score</p>
                      <p className="font-medium">{analytics?.relationship_score?.avg_score?.toFixed?.(2) ?? "0.00"}</p>
                    </div>
                    <div className="rounded bg-muted p-3">
                      <p className="text-muted-foreground">Questions Answered</p>
                      <p className="font-medium">{analytics?.relationship_score?.questions_answered ?? 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className={cn("min-w-0", getTrafficLightMetric("b2b_competitive_exposure", analytics?.competitive_exposure?.exposure_rate).card)}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Competitive Exposure
                    <InfoHint text="This shows how many customers also buy similar services from other providers. If this is high, there is more risk of losing business and we should follow up." />
                  </CardTitle>
                  <CardDescription>Shows how many customers also use competitor services. Lower is better for retention.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className={cn("text-4xl font-semibold", getTrafficLightMetric("b2b_competitive_exposure", analytics?.competitive_exposure?.exposure_rate).value)}>{analytics?.competitive_exposure?.exposure_rate?.toFixed?.(1) ?? "0.0"}%</div>
                  <div className="min-w-0 h-48">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
                      <BarChart data={competitorGraphData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" />
                        <YAxis allowDecimals={false} domain={[0, "dataMax"]} />
                        <Tooltip formatter={(value) => [Number(value), "Accounts"]} />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                          <Cell fill="#f97316" />
                          <Cell fill="#6366f1" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded bg-muted p-3">
                      <p className="text-muted-foreground">Using Competitors</p>
                      <p className="font-medium">{analytics?.competitive_exposure?.accounts_using_competitors ?? 0}</p>
                    </div>
                    <div className="rounded bg-muted p-3">
                      <p className="text-muted-foreground">Total Accounts</p>
                      <p className="font-medium">{analytics?.competitive_exposure?.total_accounts ?? 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {isB2BPlatform ? (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Yes/No Question Results</CardTitle>
                <CardDescription>Shows how people answered Yes or No for Questions 4, 6, 9, and 16.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {yesNoQuestionCards.map((item) => (
                      <div key={item.key} className="min-w-0 rounded-lg border bg-muted/30 p-4">
                      <p className="text-sm font-semibold">{item.label}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{item.question_text}</p>
                       <div className="min-w-0 mt-3 h-56">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
                          <PieChart>
                            <Pie
                              data={item.chart_data}
                              cx="50%"
                              cy="50%"
                              innerRadius={48}
                              outerRadius={74}
                              paddingAngle={2}
                              dataKey="value"
                            >
                              {item.chart_data.map((entry) => (
                                <Cell key={`${item.key}-${entry.name}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => [value, "Count"]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                      <div className="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
                        <p className="text-muted-foreground">Yes: {item.yes_count} ({item.yes_percent.toFixed(1)}%)</p>
                        <p className="text-muted-foreground">No: {item.no_count} ({item.no_percent.toFixed(1)}%)</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {isMysteryShopperPlatform ? (
            <MysteryAnalyticsSummarySection mysteryAnalyticsSummary={mysteryAnalyticsSummary} analytics={analytics} />
          ) : null}
        </>
        )
      ) : null}

      {location.pathname === "/trends" ? (
        isInstallationPlatform ? (
          <div className="space-y-6">
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Installation Trends</CardTitle>
                <CardDescription>Track installation performance over time by month, customer type, worker type, and question.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Input type="month" value={installationTrendMonth} onChange={(event) => setInstallationTrendMonth(event.target.value)} />
                  <Select value={installationTrendCustomerType} onChange={(event) => setInstallationTrendCustomerType(event.target.value)}>
                    <option value="">All customer types</option>
                    <option value="B2B">B2B (Business/Corporate)</option>
                    <option value="B2C">B2C (Residential)</option>
                  </Select>
                  <Select value={installationTrendWorkerType} onChange={(event) => setInstallationTrendWorkerType(event.target.value)}>
                    <option value="">All worker types</option>
                    <option value="Field Team">Field Team</option>
                    <option value="Contractor">Contractor</option>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={loadInstallationTrends}>{installationTrendsLoading ? "Refreshing..." : "Refresh Trends"}</Button>
                  <Button type="button" variant="ghost" onClick={() => { setInstallationTrendMonth(""); setInstallationTrendCustomerType(""); setInstallationTrendWorkerType(""); }}>Clear Filters</Button>
                </div>
              </CardContent>
            </Card>
            <InstallationTrendsView trends={installationTrends} loading={installationTrendsLoading} />
          </div>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Trend Explorer</CardTitle>
                <CardDescription>Shows how the selected score changes over time so you can spot improvements or declines.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select value={selectedQuestionId} onChange={(event) => setSelectedQuestionId(event.target.value)}>
                  {questionAverages.length === 0 ? <option value="">No questions available</option> : null}
                  {questionAverages.map((question) => (
                    <option key={question.question_id} value={String(question.question_id)}>{question.question_text}</option>
                  ))}
                </Select>
                <div className="min-w-0 h-[420px]">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis domain={[0, 10]} />
                      <Tooltip />
                      <Line type="monotone" dataKey="average" stroke="hsl(var(--primary))" strokeWidth={2.5} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {isB2BPlatform ? (
              <Card className="min-w-0">
                <CardHeader>
                  <CardTitle>Account Executive Yes/No Performance</CardTitle>
                  <CardDescription>Shows the percentage of "Yes" answers for Questions 4 and 6 grouped by the account executive captured on each approved survey.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="min-w-0 h-[420px]">
                    {accountExecutiveYesNoChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
                        <BarChart data={accountExecutiveYesNoChartData} margin={{ top: 8, right: 8, left: 8, bottom: 24 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="accountExecutive" interval={0} angle={-20} textAnchor="end" height={80} />
                          <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                          <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "Yes Rate"]} />
                          <Bar dataKey="q4YesPercent" fill="#0ea5e9" name="Q4 Yes %" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="q6YesPercent" fill="#8b5cf6" name="Q6 Yes %" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No account executive yes/no data available.</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        )
      ) : null}

      {location.pathname === "/review" ? (
        isMysteryShopperPlatform ? (
          <MysteryReviewQueueSection
            pendingVisits={pendingVisits}
            loadingVisitId={reviewActionLoadingVisitId}
            onView={loadSurveyVisitDetails}
            onApprove={(visit) => handleReviewDecision(visit, "approve")}
            onReject={(visit) => handleReviewDecision(visit, "reject")}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-semibold tracking-tight">Review Queue</CardTitle>
              <CardDescription className="text-sm">These submitted visits are waiting for manager review. You can approve or reject each one.</CardDescription>
            </CardHeader>
            <CardContent>
              <ReviewQueueDataTable
                data={pendingVisits}
                isMysteryShopperPlatform={isMysteryShopperPlatform}
                loadingVisitId={reviewActionLoadingVisitId}
                onView={loadSurveyVisitDetails}
                onApprove={(visit) => handleReviewDecision(visit, "approve")}
                onReject={(visit) => handleReviewDecision(visit, "reject")}
              />
            </CardContent>
          </Card>
        )
      ) : null}

          {location.pathname === "/review" && selectedSurveyVisit ? (
            isMysteryShopperPlatform ? (
              <MysteryVisitDetailCard
                visit={selectedSurveyVisit}
                responseGroups={surveyResponseCategoryGroups}
                formatSurveyResponseValue={formatSurveyResponseValue}
                formatReadableDateTime={formatReadableDateTime}
                onClose={() => setSelectedSurveyVisit(null)}
                editable
                canEditResponseAnswer={canEditResponseAnswer}
                canEditResponseActions={canEditResponseActions}
                reviewResponseDrafts={reviewResponseDrafts}
                reviewSavingResponseId={reviewSavingResponseId}
                updateReviewDraft={updateReviewDraft}
                addReviewAction={addReviewAction}
                updateReviewAction={updateReviewAction}
                removeReviewAction={removeReviewAction}
                onSaveResponse={saveReviewResponseEdits}
                actionTimeframeOptions={ACTION_TIMEFRAME_OPTIONS}
              />
            ) : (
              <Card>
                <CardHeader>
              <CardTitle className="text-xl font-semibold tracking-tight">Survey Detail - {selectedSurveyVisit.business_name || "Visit"}</CardTitle>
              <CardDescription>
                {selectedSurveyVisit.visit_date || "--"} | {selectedSurveyVisit.status || "--"} | Representative: {selectedSurveyVisit.representative_name || selectedSurveyVisit.representative_id || "--"}
              </CardDescription>
              <CardDescription>
                  Account Executive: {selectedSurveyVisit.account_executive_name || "--"} | Team Members: {(selectedSurveyVisit.team_member_names || []).join(", ") || "--"}
              </CardDescription>
              <CardDescription>
                  Last Edited Before Review: {selectedSurveyVisit.edited_by_name || "--"} {selectedSurveyVisit.edited_at ? `at ${formatReadableDateTime(selectedSurveyVisit.edited_at)}` : ""}
              </CardDescription>
                <CardDescription>
                  Audit Signature: {selectedSurveyVisit.submitted_by_name || "--"} ({selectedSurveyVisit.submitted_by_email || "--"}) {selectedSurveyVisit.submitted_at ? `at ${formatReadableDateTime(selectedSurveyVisit.submitted_at)}` : ""}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {surveyResponseCategoryGroups.length > 0 ? (
                surveyResponseCategoryGroups.map(({ category, responses }) => (
                  <div key={category} className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-base font-semibold tracking-tight">{category}</p>
                      <Badge variant="secondary">{responses.length} questions</Badge>
                    </div>
                    {responses.map((response) => {
                      const display = formatSurveyResponseValue(response);
                      const responseId = String(response.response_id || "");
                      const draft = reviewResponseDrafts[responseId] || { answer_text: response.answer_text || "", verbatim: response.verbatim || "", actions: response.actions || [] };
                      const isSaving = reviewSavingResponseId === responseId;
                      return (
                        <div key={response.response_id || `${response.question_id}-${response.created_at || ""}`} className="rounded-md border bg-background p-3">
                          <div className="mb-1 flex items-center justify-between">
                            <p className="text-base font-medium">Question {response.question_number || response.question_id}</p>
                          </div>
                          <p className="text-sm">{response.question_text || "--"}</p>
                          {canEditResponseAnswer(response) ? (
                            <div className="mt-2">
                              <label className="mb-1 block text-sm font-medium">Answer</label>
                              <Textarea value={draft.answer_text} onChange={(event) => updateReviewDraft(responseId, { ...draft, answer_text: event.target.value })} />
                            </div>
                          ) : (
                            <p className="mt-1 text-sm text-muted-foreground">{display.label}: {display.value}</p>
                          )}
                          <div className="mt-2">
                            <label className="mb-1 block text-sm font-medium">Verbatim</label>
                            <Textarea value={draft.verbatim} onChange={(event) => updateReviewDraft(responseId, { ...draft, verbatim: event.target.value })} />
                          </div>
                          {canEditResponseActions(response) ? (
                            <div className="mt-3 space-y-2 rounded-md border bg-muted/40 p-3">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium">Action Points</p>
                                <Button type="button" size="sm" variant="outline" onClick={() => addReviewAction(responseId)}>Add Action</Button>
                              </div>
                              {(draft.actions || []).map((action, actionIndex) => (
                                <div key={`${responseId}-action-${actionIndex}`} className="grid grid-cols-1 gap-2 rounded-md border bg-background p-3 md:grid-cols-2">
                                  <Textarea className="min-h-24 resize-y md:col-span-2" placeholder="Action required" value={action.action_required || ""} onChange={(event) => updateReviewAction(responseId, actionIndex, "action_required", event.target.value)} />
                                  <Input placeholder="Lead owner" value={action.action_owner || ""} onChange={(event) => updateReviewAction(responseId, actionIndex, "action_owner", event.target.value)} />
                                  <Select value={action.action_timeframe || ""} onChange={(event) => updateReviewAction(responseId, actionIndex, "action_timeframe", event.target.value)}>
                                    <option value="">Action timeframe</option>
                                    {ACTION_TIMEFRAME_OPTIONS.map((option) => (
                                      <option key={`${responseId}-${actionIndex}-${option}`} value={option}>{option}</option>
                                    ))}
                                  </Select>
                                    <Textarea className="min-h-24 resize-y" placeholder="Support needed" value={action.action_support_needed || ""} onChange={(event) => updateReviewAction(responseId, actionIndex, "action_support_needed", event.target.value)} />
                                    <Textarea className="min-h-24 resize-y" placeholder="Comments" value={action.action_comments || ""} onChange={(event) => updateReviewAction(responseId, actionIndex, "action_comments", event.target.value)} />
                                  <div className="md:col-span-2">
                                    <Button type="button" size="sm" variant="destructive" onClick={() => removeReviewAction(responseId, actionIndex)}>Remove Action</Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                          <div className="mt-3">
                            <Button type="button" size="sm" variant="outline" onClick={() => saveReviewResponseEdits(response)} disabled={isSaving}>
                              {isSaving ? "Saving..." : "Save Response Edit"}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No responses found for this visit.</p>
              )}
              <div>
                <Button type="button" variant="outline" onClick={() => setSelectedSurveyVisit(null)}>Close Details</Button>
              </div>
            </CardContent>
          </Card>
            )
      ) : null}

      {location.pathname === "/planned" ? (
        isB2BPlatform ? (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Create Planned Visit</CardTitle>
                <CardDescription>Create B2B draft planned visits directly from dashboard.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <Select value={plannedForm.business_id} onChange={(event) => setPlannedForm((prev) => ({ ...prev, business_id: event.target.value }))}>
                    <option value="">Select business</option>
                    {businesses.map((business) => (
                      <option key={business.id} value={String(business.id)}>{business.name}</option>
                    ))}
                  </Select>
                  <Input type="date" value={plannedForm.visit_date} onChange={(event) => setPlannedForm((prev) => ({ ...prev, visit_date: event.target.value }))} />
                  <Select value={plannedForm.visit_type} onChange={(event) => setPlannedForm((prev) => ({ ...prev, visit_type: event.target.value }))}>
                    <option value="Planned">Planned</option>
                    <option value="Priority">Priority</option>
                    <option value="Substitution">Substitution</option>
                  </Select>
                  <Button type="button" onClick={handleCreatePlannedVisit}>Create Draft Visit</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Draft Planned Visits</CardTitle>
                <CardDescription>Current B2B draft visits queued for survey completion.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Button type="button" variant="outline" onClick={loadPlannedVisits}>{plannedLoading ? "Refreshing..." : "Refresh"}</Button>
                </div>
                <PlannedVisitsDataTable
                  data={plannedVisits}
                  loading={plannedLoading}
                  editingVisitId={editingPlannedVisitId}
                  editForm={plannedEditForm}
                  onEditFormChange={setPlannedEditForm}
                  onStartEdit={startEditPlannedVisit}
                  onSaveEdit={savePlannedVisitEdit}
                  onCancelEdit={cancelEditPlannedVisit}
                  onDelete={handleDeletePlannedVisit}
                />
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Planned Visits</CardTitle>
              <CardDescription>Planned visit management is currently available only for B2B.</CardDescription>
            </CardHeader>
          </Card>
        )
      ) : null}

      {location.pathname === "/surveys" && isInstallationPlatform ? (
        <InstallationSurveyExplorer
          filters={installationSurveyFilters}
          onFilterChange={handleInstallationFilterChange}
          surveys={installationSurveys}
          loading={installationSurveysLoading}
          onSearch={() => loadInstallationSurveys()}
          onReset={resetInstallationSurveyFilters}
          onView={loadInstallationSurveyDetail}
          selectedSurvey={selectedInstallationSurvey}
          onCloseDetails={() => setSelectedInstallationSurvey(null)}
        />
      ) : null}

      {location.pathname === "/contractors" && isInstallationPlatform ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-semibold tracking-tight">Contractor Directory</CardTitle>
              <CardDescription>Create and search contractor names used by installation surveys.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <Input
                  value={newInstallationContractorName}
                  onChange={(event) => setNewInstallationContractorName(event.target.value)}
                  placeholder="Enter contractor name"
                />
                <Button type="button" onClick={createInstallationContractor} disabled={installationContractorSaving}>
                  {installationContractorSaving ? "Saving..." : "Add Contractor"}
                </Button>
              </div>
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <Input
                  value={installationContractorQuery}
                  onChange={(event) => setInstallationContractorQuery(event.target.value)}
                  placeholder="Search contractors"
                />
                <Button type="button" variant="outline" onClick={() => loadInstallationContractors(installationContractorQuery)}>
                  {installationContractorsLoading ? "Searching..." : "Search"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setInstallationContractorQuery("");
                    loadInstallationContractors("");
                  }}
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Available Contractors</CardTitle>
              <CardDescription>{installationContractorsLoading ? "Loading..." : `${installationContractors.length} contractor${installationContractors.length === 1 ? "" : "s"}`}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {installationContractorsLoading ? (
                      <TableRow>
                        <TableCell colSpan={2}>Loading contractors...</TableCell>
                      </TableRow>
                    ) : installationContractors.length ? (
                      installationContractors.map((contractor) => (
                        <TableRow key={contractor.id}>
                          <TableCell>{contractor.name}</TableCell>
                          <TableCell>{contractor.created_at ? contractor.created_at.slice(0, 10) : "--"}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={2}>No contractors found.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {location.pathname === "/user-guide" ? (
        isB2BPlatform ? (
          <PlatformUserGuidePage platform="b2b" />
        ) : isMysteryShopperPlatform ? (
          <PlatformUserGuidePage platform="mystery" />
        ) : isInstallationPlatform ? (
          <PlatformUserGuidePage platform="installation" />
        ) : (
          <PlatformUserGuidePage platform="unsupported" />
        )
      ) : null}

      {location.pathname === "/reports" && isInstallationPlatform ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-semibold tracking-tight">Installation Reports</CardTitle>
              <CardDescription>Generate clear, comprehensive reports for installation assessments. Choose a report type and customize the scope below.</CardDescription>
            </CardHeader>
          </Card>

          <div className="rounded-lg border bg-muted/20 p-5 space-y-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-base font-semibold tracking-tight">Export and Share Report</p>
                <p className="text-sm text-muted-foreground">Select a report type and define its scope. Then preview, download, or email.</p>
              </div>
            </div>

            <section className="rounded-lg border bg-card p-4">
              <div className="mb-3">
                <p className="text-sm font-semibold tracking-tight">1) Select Report Type</p>
                <p className="text-xs text-muted-foreground">Pick the report format you need.</p>
              </div>
              {/* Mobile: horizontal scroll pills */}
              <div className="flex gap-2 overflow-x-auto pb-1 md:hidden">
                {INSTALL_REPORT_TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => {
                      setInstallReportType(option.key);
                      setInstallReportSurveyId("");
                      setInstallReportPreview(null);
                      setInstallReportPreviewHtml("");
                    }}
                    className={cn(
                      "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                      installReportType === option.key
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {/* Desktop: card grid */}
              <div className="hidden md:grid md:grid-cols-2 xl:grid-cols-4 gap-4">
                {INSTALL_REPORT_TYPE_OPTIONS.map((option) => (
                  <Card key={option.key} className="h-full min-w-0 overflow-visible">
                    <CardHeader>
                      <CardTitle className="text-base">{option.label}</CardTitle>
                      <CardDescription>{option.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex min-h-[8rem] flex-col gap-3">
                      <Button
                        type="button"
                        className="mt-auto w-full"
                        variant={installReportType === option.key ? "default" : "outline"}
                        onClick={() => {
                          setInstallReportType(option.key);
                          setInstallReportSurveyId("");
                          setInstallReportPreview(null);
                          setInstallReportPreviewHtml("");
                        }}
                      >
                        {installReportType === option.key ? "Selected" : `Use ${option.label}`}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            <section className="rounded-lg border bg-background p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold tracking-tight">2) Define Report Scope</p>
                {installReportType === "lifetime" ? (
                  <p className="text-xs text-muted-foreground">Lifetime Summary uses all installation data. Optionally filter by date range.</p>
                ) : installReportType === "survey" ? (
                  <p className="text-xs text-muted-foreground">Select a single installation survey to generate a detailed report.</p>
                ) : null}
              </div>

              {installReportType === "lifetime" ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Month (optional)</label>
                    <Input type="month" value={installReportMonth} onChange={(e) => setInstallReportMonth(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">From Date (optional)</label>
                    <Input type="date" value={installReportDateFrom} onChange={(e) => setInstallReportDateFrom(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">To Date (optional)</label>
                    <Input type="date" value={installReportDateTo} onChange={(e) => setInstallReportDateTo(e.target.value)} />
                  </div>
                </div>
              ) : null}

              {installReportType === "survey" ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" onClick={loadInstallationReportSurveyList} disabled={installReportSurveyListLoading}>
                      {installReportSurveyListLoading ? "Loading..." : "Refresh Survey List"}
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {installReportSurveyListLoading ? "Loading..." : `${installReportSurveyList.length} surveys available`}
                    </span>
                  </div>
                    <Select value={installReportSurveyId} onChange={(e) => setInstallReportSurveyId(e.target.value)}>
                      <option value="">Select a survey</option>
                      {installReportSurveyList.map((survey) => (
                        <option key={survey.survey_id} value={survey.survey_id}>
                        {`${survey.work_order ? `Work Order ${survey.work_order}` : "Work Order not captured"} | ${survey.customer_name || "Unknown customer"} | ${survey.location || "Unknown location"} | ${survey.date_work_done || "No date"} | Avg ${survey.overall_score?.toFixed(1) ?? "--"}`}
                        </option>
                      ))}
                    </Select>
                </div>
              ) : null}
            </section>

            <section className="rounded-lg border bg-background p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold tracking-tight">3) Deliver Report</p>
                <p className="text-xs text-muted-foreground">Preview the report, download as HTML, or send by email.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {(installReportType === "lifetime" || installReportType === "survey") && (
                  <>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Email Recipients (comma separated)</label>
                      <Input
                        placeholder="manager@example.com"
                        value={installReportEmailTo}
                        onChange={(e) => setInstallReportEmailTo(e.target.value)}
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={handleInstallationPreviewReport} disabled={installReportLoading}>
                  {installReportLoading ? "Generating..." : "Preview Report"}
                </Button>
                <Button type="button" variant="outline" onClick={handleInstallationDownloadReport} disabled={!installReportPreviewHtml}>Download HTML</Button>
                <Button type="button" onClick={handleInstallationEmailReport} disabled={installReportSending}>
                  {installReportSending ? "Sending..." : "Email Report"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => {
                  setInstallReportType("lifetime");
                  setInstallReportMonth("");
                  setInstallReportDateFrom("");
                  setInstallReportDateTo("");
                  setInstallReportSurveyId("");
                  setInstallReportEmailTo("");
                  setInstallReportPreview(null);
                  setInstallReportPreviewHtml("");
                  setInstallReportSurveyList([]);
                }}>Clear</Button>
              </div>
              {installReportPreview && (
                <div className="mt-4 space-y-3 rounded-md border bg-background p-3">
                  <p className="text-sm font-semibold">Report Preview Summary</p>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Total Surveys</p><p className="text-lg font-semibold">{installReportPreview.summary?.total_surveys ?? 0}</p></div>
                    <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Categories</p><p className="text-lg font-semibold">{installReportPreview.category_averages?.length ?? 0}</p></div>
                    {installReportPreview.survey_detail && (
                      <div className={cn("rounded-md border p-2", getTrafficLightMetric("installation_average", installReportPreview.survey_detail?.overall_score).card)}><p className="text-xs text-muted-foreground">Survey Score</p><p className={cn("text-lg font-semibold", getTrafficLightMetric("installation_average", installReportPreview.survey_detail?.overall_score).value)}>{installReportPreview.survey_detail?.overall_score?.toFixed(2) ?? "--"}</p></div>
                    )}
                    {installationReportMetricCards.filter((card) => card.value !== "--").map((card) => {
                      const grade = getTrafficLightMetric(card.metric, card.value);
                      return (
                        <div key={card.title} className={cn("rounded-md border p-2", grade.card)}>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs text-muted-foreground">{card.title}</p>
                            <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", grade.badge)}>{grade.label}</span>
                          </div>
                          <p className={cn("text-lg font-semibold", grade.value)}>{card.value}</p>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">Scoring Range: {installReportPreview.scoring_range || "1-5"}</p>
                  {installReportPreviewHtml ? (
                    <div className="rounded-md border">
                      <iframe title="Report Preview" srcDoc={installReportPreviewHtml} className="h-[720px] w-full rounded-md bg-white" />
                    </div>
                  ) : null}
                </div>
              )}
            </section>
          </div>
        </div>
      ) : null}

      {(location.pathname === "/surveys" || location.pathname === "/reports") && !isInstallationPlatform ? (
        isMysteryShopperPlatform ? (
          location.pathname === "/surveys" ? (
            <MysterySurveyResultsSection
              surveyStatusFilter={surveyStatusFilter}
              setSurveyStatusFilter={setSurveyStatusFilter}
              selectedSurveyLocation={selectedSurveyLocation}
              setSelectedSurveyLocation={setSelectedSurveyLocation}
              mysteryLocations={mysteryLocations}
              loadSurveyResults={loadSurveyResults}
              surveyLoading={surveyLoading}
              surveyResults={surveyResults}
              loadSurveyVisitDetails={loadSurveyVisitDetails}
              selectedSurveyVisit={selectedSurveyVisit}
              surveyResponseCategoryGroups={surveyResponseCategoryGroups}
              formatSurveyResponseValue={formatSurveyResponseValue}
              formatReadableDateTime={formatReadableDateTime}
              onCloseDetails={() => setSelectedSurveyVisit(null)}
            />
          ) : (
            <MysteryReportsSection
              reportTypeOptions={reportTypeOptions}
              reportType={reportType}
              setReportType={setReportType}
              reportBusinessId={reportBusinessId}
              setReportBusinessId={setReportBusinessId}
              mysteryLocations={mysteryLocations}
              reportVisitId={reportVisitId}
              setReportVisitId={setReportVisitId}
              reportEligibleSurveys={reportEligibleSurveys}
              reportDateFrom={reportDateFrom}
              setReportDateFrom={setReportDateFrom}
              reportDateTo={reportDateTo}
              setReportDateTo={setReportDateTo}
              reportSurveyLoading={reportSurveyLoading}
              reportIneligibleSurveys={reportIneligibleSurveys}
              reportEmailTo={reportEmailTo}
              setReportEmailTo={setReportEmailTo}
              handlePreviewReport={handlePreviewReport}
              handleDownloadReport={handleDownloadReport}
              handleDownloadPdfReport={handleDownloadPdfReport}
              handleEmailReport={handleEmailReport}
              reportLoading={reportLoading}
              reportSending={reportSending}
              reportPreview={reportPreview}
              reportPreviewHtml={reportPreviewHtml}
              mysteryReportMetricCards={mysteryReportMetricCards}
            />
          )
        ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-semibold tracking-tight">{location.pathname === "/reports" ? "Survey Reports" : "Survey Results"}</CardTitle>
              <CardDescription>
                {location.pathname === "/reports"
                  ? isMysteryShopperPlatform
                    ? "Create Mystery Shopper reports by date or location, then preview, download, or email them."
                    : "Create visual management reports by date/business, then download or email them."
                  : "View full survey submissions, then open each visit to inspect all questions and answers."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {location.pathname === "/surveys" ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-2">
                <Select value={surveyStatusFilter} onChange={(event) => setSurveyStatusFilter(event.target.value)}>
                  <option value="all">All Statuses</option>
                  <option value="Draft">Draft</option>
                      <option value="Pending">Pending</option>
                      <option value="Approved">Approved</option>
                      <option value="Rejected">Rejected</option>
                    </Select>
                {isB2BPlatform ? (
                  <Select value={selectedSurveyBusiness} onChange={(event) => setSelectedSurveyBusiness(event.target.value)}>
                    <option value="">All Businesses</option>
                    {businesses.map((business) => (
                      <option key={business.id} value={business.name}>{business.name}</option>
                    ))}
                  </Select>
                ) : isMysteryShopperPlatform ? (
                  <Select value={selectedSurveyLocation} onChange={(event) => setSelectedSurveyLocation(event.target.value)}>
                    <option value="">All Locations</option>
                    {mysteryLocations.map((locationItem) => (
                      <option key={locationItem.id} value={locationItem.name}>{locationItem.name}</option>
                    ))}
                  </Select>
                ) : (
                  <div className="hidden lg:block" />
                )}
              </div>
              ) : null}

              {location.pathname === "/reports" ? (
              <div className="rounded-lg border bg-muted/20 p-5 space-y-5">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-base font-semibold tracking-tight">Export and Share Report</p>
                    <p className="text-sm text-muted-foreground">Choose a report type below. Each type has its own set of filters and options.</p>
                  </div>
                </div>
                <section className="rounded-lg border bg-card p-4">
                <div className="mb-3">
                  <p className="text-sm font-semibold tracking-tight">1) Select Report Type</p>
                  <p className="text-xs text-muted-foreground">Pick the report format that matches your reporting objective.</p>
                </div>
                {/* Mobile: horizontal scroll pills */}
                <div className="flex gap-2 overflow-x-auto pb-1 md:hidden">
                  {reportTypeOptions.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setReportType(option.key)}
                      className={cn(
                        "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                        reportType === option.key
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {/* Desktop: card grid */}
                <div className="hidden md:grid md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {reportTypeOptions.map((option) => (
                    <Card key={option.key} className="h-full min-w-0 overflow-visible">
                      <CardHeader>
                        <CardTitle className="text-base">{option.label}</CardTitle>
                        <CardDescription>{option.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex min-h-[8rem] flex-col gap-3">
                        <Button
                          type="button"
                          className="mt-auto w-full"
                          variant={reportType === option.key ? "default" : "outline"}
                          onClick={() => setReportType(option.key)}
                        >
                          {reportType === option.key ? "Selected" : `Use ${option.label}`}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                </section>

                <section className="rounded-lg border bg-background p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold tracking-tight">2) Define Report Scope</p>
                  {reportType === "lifetime" ? (
                    <p className="text-xs text-muted-foreground">{isMysteryShopperPlatform ? "Lifetime overview uses all Mystery Shopper data across the selected scope." : "Lifetime Overview uses all data across the platform. No filters needed."}</p>
                  ) : reportType === "survey" ? (
                    <p className="text-xs text-muted-foreground">{isMysteryShopperPlatform ? "Select a location, then pick an approved survey to view its full details." : "Select a business, then pick an approved survey to view its full details."}</p>
                  ) : reportType === "date" ? (
                    <p className="text-xs text-muted-foreground">Pick a single date to see all surveys completed that day, or a date range to cover multiple days.</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Filter action points by business, date range, or status. Leave blank to see all.</p>
                  )}
                </div>

                {reportType === "lifetime" ? (
                  <div className="rounded-md border bg-blue-50 p-3">
                    <p className="text-sm text-blue-900">{isMysteryShopperPlatform ? "This report aggregates Mystery Shopper visits across the selected date scope and available locations." : "This report aggregates all completed and approved surveys across all businesses and all dates. No additional filters are required."}</p>
                  </div>
                ) : null}

                {reportType === "survey" ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">{isMysteryShopperPlatform ? "Location" : "Business"}</label>
                      <Input
                        type="text"
                        list="report-business-list"
                        placeholder={isMysteryShopperPlatform ? "Type to search location..." : "Type to search business..."}
                        value={isMysteryShopperPlatform ? (mysteryLocations.find((item) => String(item.id) === reportBusinessId)?.name || "") : (businesses.find((b) => String(b.id) === reportBusinessId)?.name || "")}
                        onChange={(event) => {
                          const match = isMysteryShopperPlatform
                            ? mysteryLocations.find((item) => item.name === event.target.value)
                            : businesses.find((b) => b.name === event.target.value);
                          setReportBusinessId(match ? String(match.id) : "");
                        }}
                      />
                      <datalist id="report-business-list">
                        {(isMysteryShopperPlatform ? mysteryLocations : businesses).map((item) => (
                          <option key={item.id} value={item.name} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Survey</label>
                      <Select value={reportVisitId} onChange={(event) => setReportVisitId(event.target.value)}>
                        <option value="">Select approved survey</option>
                        {reportEligibleSurveys.map((visit) => (
                          <option key={visit.visit_id} value={visit.visit_id}>Survey on {visit.visit_date || "--"} ({visit.status})</option>
                        ))}
                      </Select>
                    </div>
                  </div>
                ) : null}

                {reportType === "date" ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-md border bg-blue-50 p-3 md:col-span-2">
                      <p className="text-sm font-medium text-blue-900">Single Date vs Date Range</p>
                      <p className="text-xs text-blue-800 mt-1"><strong>Single date:</strong> Shows all surveys completed on exactly that date. Use the date picker below.</p>
                      <p className="text-xs text-blue-800 mt-1"><strong>Date range:</strong> Shows all surveys completed between two dates. Fill in both "From" and "To" fields below.</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">From Date</label>
                      <Input type="date" value={reportDateFrom} onChange={(event) => setReportDateFrom(event.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">To Date</label>
                      <Input type="date" value={reportDateTo} onChange={(event) => setReportDateTo(event.target.value)} />
                    </div>
                  </div>
                ) : null}

                {reportType === "action_points" ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Business (optional)</label>
                      <Input
                        type="text"
                        list="report-business-list-ap"
                        placeholder="All businesses"
                        value={businesses.find((b) => String(b.id) === reportBusinessId)?.name || ""}
                        onChange={(event) => {
                          const match = businesses.find((b) => b.name === event.target.value);
                          setReportBusinessId(match ? String(match.id) : "");
                        }}
                      />
                      <datalist id="report-business-list-ap">
                        {businesses.map((business) => (
                          <option key={business.id} value={business.name} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">From Date (optional)</label>
                      <Input type="date" value={reportDateFrom} onChange={(event) => setReportDateFrom(event.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">To Date (optional)</label>
                      <Input type="date" value={reportDateTo} onChange={(event) => setReportDateTo(event.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
                      <Select value={reportVisitId} onChange={(event) => setReportVisitId(event.target.value)}>
                        <option value="">All action points</option>
                          <option value="Outstanding">Outstanding only</option>
                          <option value="In Progress">In Progress only</option>
                          <option value="Completed">Completed only</option>
                      </Select>
                    </div>
                  </div>
                ) : null}

                {reportType === "survey" ? (
                  <div className="space-y-2">
                    {reportSurveyLoading ? <p className="text-sm text-muted-foreground">Loading available surveys...</p> : null}
                    {!reportSurveyLoading && reportBusinessId && reportEligibleSurveys.length === 0 ? (
                      <p className="text-sm text-amber-700">No completed/approved surveys are available for this business yet.</p>
                    ) : null}
                    {reportIneligibleSurveys.length > 0 ? (
                      <div className="rounded-md border bg-amber-50 p-3">
                        <p className="text-sm font-medium text-amber-900">Unavailable surveys (cannot generate report)</p>
                        <div className="mt-2 space-y-1 text-xs text-amber-800">
                          {reportIneligibleSurveys.slice(0, 8).map((visit) => (
                            <p key={`ineligible-${visit.visit_id}`}>Survey on {visit.visit_date || "--"} ({visit.status}) - {visit.reason || "Not report-eligible"}</p>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                </section>

                <section className="rounded-lg border bg-background p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold tracking-tight">3) Deliver Report</p>
                  <p className="text-xs text-muted-foreground">Preview in-page, download as HTML, or send by email.</p>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {reportType === "lifetime" || reportType === "survey" ? (
                    <>
                      <Input type="date" value={reportDateFrom} onChange={(event) => setReportDateFrom(event.target.value)} placeholder="From date (optional)" />
                      <Input type="date" value={reportDateTo} onChange={(event) => setReportDateTo(event.target.value)} placeholder="To date (optional)" />
                    </>
                  ) : null}
                  <Input
                    placeholder="Email recipients (comma separated)"
                    value={reportEmailTo}
                    onChange={(event) => setReportEmailTo(event.target.value)}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={handlePreviewReport} disabled={reportLoading}>
                    {reportLoading ? "Generating..." : "Preview Report"}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleDownloadReport}>Download HTML</Button>
                  <Button type="button" onClick={handleEmailReport} disabled={reportSending}>
                    {reportSending ? "Sending..." : "Email Report"}
                  </Button>
                </div>
                    {reportPreview ? (
                  <div className="mt-4 space-y-3 rounded-md border bg-background p-3">
                    <p className="text-sm font-semibold">Report Preview Summary</p>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Visits</p><p className="text-lg font-semibold">{reportPreview.summary?.total_visits ?? 0}</p></div>
                      <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">{isMysteryShopperPlatform ? "Locations" : "Businesses"}</p><p className="text-lg font-semibold">{isMysteryShopperPlatform ? (reportPreview.summary?.total_locations ?? 0) : (reportPreview.summary?.total_businesses ?? 0)}</p></div>
                      {!isMysteryShopperPlatform ? <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Outstanding Action Points</p><p className="text-lg font-semibold">{(reportPreview.action_points || []).filter((item) => item.action_status !== "Completed").length}</p></div> : null}
                      {!isMysteryShopperPlatform ? <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Completed Action Points</p><p className="text-lg font-semibold">{(reportPreview.action_points || []).filter((item) => item.action_status === "Completed").length}</p></div> : null}
                      {(isMysteryShopperPlatform ? mysteryReportMetricCards : reportMetricCards).filter((card) => card.value !== "--" && card.value !== "--%").map((card) => {
                        const grade = getTrafficLightMetric(card.metric, card.value);
                        return (
                          <div key={card.title} className={cn("rounded-md border p-2", grade.card)}>
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs text-muted-foreground">{card.title}</p>
                              <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", grade.badge)}>{grade.label}</span>
                            </div>
                            <p className={cn("text-lg font-semibold", grade.value)}>{card.value}</p>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">{isMysteryShopperPlatform ? "Includes Mystery Shopper KPI summaries, visit scope details, and survey-level answers in a shareable report format." : "Includes executive metrics (NPS, CSAT, Relationship, Competitor Exposure), selected-vs-overall comparison, and yes/no analytics in a visual report format."}</p>
                    {reportPreviewHtml ? (
                      <div className="rounded-md border">
                        <iframe title="Report Preview" srcDoc={reportPreviewHtml} className="h-[720px] w-full rounded-md bg-white" />
                      </div>
                    ) : null}
                  </div>
                ) : null}
                </section>
              </div>
              ) : null}

              {location.pathname === "/surveys" ? (
              <>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={loadSurveyResults}>Refresh</Button>
                <span className="inline-flex items-center text-sm text-muted-foreground">{surveyLoading ? "Loading..." : `${surveyResults.length} results`}</span>
              </div>

              <SurveysDataTable
                data={surveyResults}
                loading={surveyLoading}
                isMysteryShopperPlatform={isMysteryShopperPlatform}
                onViewDetails={loadSurveyVisitDetails}
              />
              </>
              ) : null}
            </CardContent>
          </Card>

          {location.pathname === "/surveys" && selectedSurveyVisit ? (
            isMysteryShopperPlatform ? (
              <MysteryVisitDetailCard
                visit={selectedSurveyVisit}
                responseGroups={surveyResponseCategoryGroups}
                formatSurveyResponseValue={formatSurveyResponseValue}
                formatReadableDateTime={formatReadableDateTime}
                onClose={() => setSelectedSurveyVisit(null)}
              />
            ) : (
              <Card>
                <CardHeader>
                <CardTitle className="text-xl font-semibold tracking-tight">Survey Detail - {selectedSurveyVisit.business_name || "Visit"}</CardTitle>
                <CardDescription>
                  {selectedSurveyVisit.visit_date || "--"} | {selectedSurveyVisit.status || "--"} | Representative: {selectedSurveyVisit.representative_name || selectedSurveyVisit.representative_id || "--"}
                </CardDescription>
                <CardDescription>
                  Account Executive: {selectedSurveyVisit.account_executive_name || "--"} | Team Members: {(selectedSurveyVisit.team_member_names || []).join(", ") || "--"}
                </CardDescription>
                <CardDescription>
                    Audit Signature: {selectedSurveyVisit.submitted_by_name || "--"} ({selectedSurveyVisit.submitted_by_email || "--"}) {selectedSurveyVisit.submitted_at ? `at ${formatReadableDateTime(selectedSurveyVisit.submitted_at)}` : ""}
                </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {surveyResponseCategoryGroups.length > 0 ? (
                    surveyResponseCategoryGroups.map(({ category, responses }) => (
                      <div key={category} className="space-y-2 rounded-lg border p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-base font-semibold tracking-tight">{category}</p>
                          <Badge variant="secondary">{responses.length} questions</Badge>
                        </div>
                        {responses.map((response) => {
                          const display = formatSurveyResponseValue(response);
                          return (
                            <div key={response.response_id || `${response.question_id}-${response.created_at || ""}`} className="rounded-md border bg-background p-3">
                              <div className="mb-1 flex items-center justify-between">
                                <p className="text-base font-medium">Question {response.question_number || response.question_id}</p>
                              </div>
                              <p className="text-sm">{response.question_text || "--"}</p>
                              <p className="mt-1 text-sm text-muted-foreground">{display.label}: {display.value}</p>
                              {response.verbatim ? <p className="mt-1 text-sm text-muted-foreground">Verbatim: {response.verbatim}</p> : null}
                            </div>
                          );
                        })}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No responses found for this visit.</p>
                  )}
                  <div>
                    <Button type="button" variant="outline" onClick={() => setSelectedSurveyVisit(null)}>Close Details</Button>
                  </div>
                </CardContent>
              </Card>
            )
          ) : null}
        </div>
        )
      ) : null}

      {location.pathname === "/actions" ? (
        isB2BPlatform ? (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Action Points Management</CardTitle>
                <CardDescription>Track action points raised during surveys and filter by owner, support, timeline, status, or business.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
                  <Input
                    placeholder="Filter by lead owner"
                    value={actionsFilters.lead_owner}
                    onChange={(event) => setActionsFilters((prev) => ({ ...prev, lead_owner: event.target.value }))}
                  />
                  <Input
                    placeholder="Filter by support needed"
                    value={actionsFilters.support}
                    onChange={(event) => setActionsFilters((prev) => ({ ...prev, support: event.target.value }))}
                  />
                  <Select
                    value={actionsFilters.timeline}
                    onChange={(event) => setActionsFilters((prev) => ({ ...prev, timeline: event.target.value }))}
                  >
                    <option value="">All timelines</option>
                    {actionsTimelineOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </Select>
                  <Select
                    value={actionsFilters.action_status}
                    onChange={(event) => setActionsFilters((prev) => ({ ...prev, action_status: event.target.value }))}
                  >
                    <option value="">All statuses</option>
                    {actionsStatusOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </Select>
                  <div>
                    <Input
                      type="text"
                      list="actions-business-list"
                      placeholder="Type to search business..."
                      value={businesses.find((b) => String(b.id) === actionsFilters.business_id)?.name || ""}
                      onChange={(event) => {
                        const match = businesses.find((b) => b.name === event.target.value);
                        setActionsFilters((prev) => ({ ...prev, business_id: match ? String(match.id) : "" }));
                      }}
                    />
                    <datalist id="actions-business-list">
                      {businesses.map((business) => (
                        <option key={business.id} value={business.name} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" onClick={loadActionsBoard}>
                    {actionsBoardLoading ? "Refreshing..." : "Refresh"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setActionsFilters({ lead_owner: "", support: "", timeline: "", action_status: "", business_id: "" })}
                  >
                    Clear Filters
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {actionsBoardLoading ? "Loading actions..." : `${actionsBoardItems.length} actions`}
                  </span>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Action Points by Survey Type</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(actionsBoardSummary?.by_survey || {}).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No actions found for current filters.</p>
                  ) : (
                    Object.entries(actionsBoardSummary?.by_survey || {}).map(([surveyName, count]) => (
                      <div key={surveyName} className="flex items-center justify-between rounded-md bg-muted/60 px-3 py-2 text-sm">
                        <span>{surveyName}</span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Action Points by Business</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(actionsBoardSummary?.by_business || {}).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No actions found for current filters.</p>
                  ) : (
                    Object.entries(actionsBoardSummary?.by_business || {}).map(([businessName, count]) => (
                      <div key={businessName} className="flex items-center justify-between rounded-md bg-muted/60 px-3 py-2 text-sm">
                        <span>{businessName}</span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              {Object.entries(groupedActionsBoard).length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">No actions available for this filter set.</p>
                  </CardContent>
                </Card>
              ) : (
                Object.entries(groupedActionsBoard).map(([surveyName, businessGroups]) => (
                  <Card key={surveyName}>
                    <CardHeader>
                      <CardTitle>{surveyName}</CardTitle>
                      <CardDescription>Grouped by business, then by survey question.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {Object.entries(businessGroups).map(([businessName, rows]) => (
                        <div key={`${surveyName}-${businessName}`} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold">{businessName}</h4>
                            <Badge>{rows.length}</Badge>
                          </div>
                          <ActionPointsDataTable data={rows} statusOptions={actionsStatusOptions} onSaveActionPoint={handleUpdateActionPointStatus} />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Action Points</CardTitle>
              <CardDescription>Action point management is currently available only for the B2B platform.</CardDescription>
            </CardHeader>
          </Card>
        )
      ) : null}

      {location.pathname === "/locations" ? (
        isMysteryShopperPlatform ? (
          <MysteryLocationsSection
            newMysteryLocation={newMysteryLocation}
            setNewMysteryLocation={setNewMysteryLocation}
            createMysteryLocation={createMysteryLocation}
            loadMysteryLocations={loadMysteryLocations}
            mysteryLocationsLoading={mysteryLocationsLoading}
            seedMysteryLegacyData={seedMysteryLegacyData}
            mysteryLegacySeeding={mysteryLegacySeeding}
            mysteryLocations={mysteryLocations}
            reactivateMysteryLocation={reactivateMysteryLocation}
            deactivateMysteryLocation={deactivateMysteryLocation}
            deleteMysteryLocation={deleteMysteryLocation}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Locations</CardTitle>
              <CardDescription>Location management is available only for the Mystery Shopper platform.</CardDescription>
            </CardHeader>
          </Card>
        )
      ) : null}

      {location.pathname === "/purposes" ? (
        isMysteryShopperPlatform ? (
          <MysteryPurposesSection
            newMysteryPurpose={newMysteryPurpose}
            setNewMysteryPurpose={setNewMysteryPurpose}
            createMysteryPurpose={createMysteryPurpose}
            loadMysteryPurposes={loadMysteryPurposes}
            mysteryPurposesLoading={mysteryPurposesLoading}
            mysteryPurposes={mysteryPurposes}
            reactivateMysteryPurpose={reactivateMysteryPurpose}
            deactivateMysteryPurpose={deactivateMysteryPurpose}
            deleteMysteryPurpose={deleteMysteryPurpose}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Purposes</CardTitle>
              <CardDescription>Purpose management is available only for the Mystery Shopper platform.</CardDescription>
            </CardHeader>
          </Card>
        )
      ) : null}

       {location.pathname === "/businesses" ? (
         isB2BPlatform ? (
         <>
            <Card>
              <CardHeader>
                <CardTitle>Business Directory</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={loadBusinesses}>Refresh</Button>
              </CardHeader>
              <CardContent>
                <BusinessesDataTable
                  data={businesses}
                  representatives={representatives}
                  representativeMap={representativeMap}
                  selectedBusiness={selectedBusiness}
                  businessForm={businessForm}
                  setBusinessForm={setBusinessForm}
                  accountExecutiveQuery={accountExecutiveQuery}
                  setAccountExecutiveQuery={setAccountExecutiveQuery}
                  onStartNew={() => {
                    setSelectedBusiness({ id: "new" });
                      setBusinessForm({ name: "", location: "", priority_level: "sme", active: true, account_executive_id: "" });
                    setAccountExecutiveQuery("");
                  }}
                  onEdit={handleEditBusiness}
                  onSave={selectedBusiness?.id === "new" ? handleCreateBusiness : handleUpdateBusiness}
                  onCancel={() => { setSelectedBusiness(null); setBusinessForm({ name: "", location: "", priority_level: "sme", active: true, account_executive_id: "" }); setAccountExecutiveQuery(""); }}
                  onRetire={handleRetireBusiness}
                  onDelete={handleDeleteBusiness}
                />
              </CardContent>
            </Card>
         </>
         ) : (
          <Card>
            <CardHeader>
              <CardTitle>Businesses</CardTitle>
              <CardDescription>Business management is currently available only for the B2B platform.</CardDescription>
            </CardHeader>
          </Card>
         )
        ) : null}

       {location.pathname === "/executives" ? (
         isB2BPlatform ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Account Executive Directory</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={loadRepresentatives}>Refresh</Button>
              </CardHeader>
              <CardContent>
                <ExecutivesDataTable
                  data={representatives}
                  selectedExecutive={selectedExecutive}
                  executiveForm={executiveForm}
                  setExecutiveForm={setExecutiveForm}
                  onStartNew={() => {
                    setSelectedExecutive({ id: "new" });
                    setExecutiveForm({ name: "", email: "" });
                  }}
                  onEdit={editExecutive}
                  onSave={saveExecutive}
                  onCancel={resetExecutiveForm}
                  onDelete={deleteExecutive}
                />
              </CardContent>
            </Card>
          </>
         ) : (
          <Card>
            <CardHeader>
              <CardTitle>Account Executives</CardTitle>
              <CardDescription>Account executive management is currently available only for the B2B platform.</CardDescription>
            </CardHeader>
          </Card>
         )
       ) : null}
    </PageContainer>
  );
}
