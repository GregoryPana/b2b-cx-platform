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

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const B2B_API_BASE = API_BASE.endsWith("/api/api") ? `${API_BASE}/b2b` : `${API_BASE}/api/b2b`;

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

export default function DashboardPage({ headers, activePlatform }) {
  const location = useLocation();
  const businessFormRef = useRef(null);
  const normalizedPlatform = String(activePlatform || "").toLowerCase();
  const isB2BPlatform = normalizedPlatform.includes("b2b");
  const isMysteryShopperPlatform = normalizedPlatform.includes("mystery");
  const [analytics, setAnalytics] = useState(null);
  const [questionAverages, setQuestionAverages] = useState([]);
  const [yesNoQuestionAnalytics, setYesNoQuestionAnalytics] = useState([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState("");
  const [trendData, setTrendData] = useState([]);
  const [pendingVisits, setPendingVisits] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [representatives, setRepresentatives] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [businessForm, setBusinessForm] = useState({
    name: "",
    location: "",
    priority_level: "medium",
    active: true,
    account_executive_id: ""
  });
  const [accountExecutiveQuery, setAccountExecutiveQuery] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [selectedAnalyticsBusinessIds, setSelectedAnalyticsBusinessIds] = useState([]);
  const [analyticsBusinessSearch, setAnalyticsBusinessSearch] = useState("");
  const [surveyResults, setSurveyResults] = useState([]);
  const [selectedSurveyVisit, setSelectedSurveyVisit] = useState(null);
  const [plannedVisits, setPlannedVisits] = useState([]);
  const [plannedLoading, setPlannedLoading] = useState(false);
  const [plannedForm, setPlannedForm] = useState({ business_id: "", visit_date: "", visit_type: "Planned" });
  const [editingPlannedVisitId, setEditingPlannedVisitId] = useState("");
  const [plannedEditForm, setPlannedEditForm] = useState({ visit_date: "", visit_type: "Planned" });
  const [surveyStatusFilter, setSurveyStatusFilter] = useState("all");
  const [selectedSurveyBusiness, setSelectedSurveyBusiness] = useState("");
  const [selectedSurveyLocation, setSelectedSurveyLocation] = useState("");
  const [surveyLoading, setSurveyLoading] = useState(false);
  const [reviewActionLoadingVisitId, setReviewActionLoadingVisitId] = useState("");

  const headerSignature = useMemo(
    () => `${headers?.Authorization || ""}|${headers?.["X-User-Id"] || ""}|${headers?.["X-User-Role"] || ""}|${headers?.["X-Dev-Auth-Bypass"] || ""}`,
    [headers]
  );

  const fetchJsonSafe = useCallback(async (url, options, timeoutMs = 15000) => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...(options || {}), signal: controller.signal });
      const raw = await res.text();
      if (!raw) return { res, data: null };
      try {
        return { res, data: JSON.parse(raw) };
      } catch {
        return { res, data: { detail: raw.slice(0, 200) } };
      }
    } catch (error) {
      const message = error?.name === "AbortError" ? "Request timed out" : (error?.message || "Request failed");
      return {
        res: { ok: false, status: 0 },
        data: { detail: message },
      };
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, []);
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

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((kind, title, duration = 2600) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, kind, title }]);
    window.setTimeout(() => dismissToast(id), duration);
  }, [dismissToast]);

  const InfoHint = ({ text }) => (
    <details className="group relative inline-flex">
      <summary className="list-none cursor-pointer rounded-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
        <CircleHelp className="h-4 w-4" />
      </summary>
      <div className="pointer-events-none absolute left-0 top-6 z-30 w-72 rounded-md border bg-popover p-2 text-xs text-popover-foreground opacity-0 shadow-md transition-opacity duration-100 group-hover:opacity-100 group-open:opacity-100">
        {text}
      </div>
    </details>
  );

  const mysteryLocationMap = useMemo(() => {
    return mysteryLocations.reduce((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});
  }, [mysteryLocations]);

  const selectedAnalyticsEntityIds = useMemo(() => {
    if (isB2BPlatform) {
      return selectedAnalyticsBusinessIds;
    }
    if (isMysteryShopperPlatform) {
      return selectedAnalyticsLocationIds
        .map((locationId) => mysteryLocationMap[locationId]?.business_id)
        .filter(Boolean);
    }
    return [];
  }, [isB2BPlatform, isMysteryShopperPlatform, selectedAnalyticsBusinessIds, selectedAnalyticsLocationIds, mysteryLocationMap]);

  // Reset selected question when platform changes
  useEffect(() => {
    setSelectedQuestionId("");
  }, [activePlatform]);

  // Load core metrics (NPS, Category Breakdown, CSAT + B2B analytics)
  useEffect(() => {
    if (!activePlatform) return;
    const load = async () => {
      setError("");
      const params = new URLSearchParams();
      params.set("survey_type", activePlatform);
      if (selectedAnalyticsEntityIds.length > 0) {
        params.set("business_ids", selectedAnalyticsEntityIds.join(","));
      }
      params.set("_cb", Date.now().toString());
      const queryString = `?${params.toString()}`;

      try {
        const [npsRes, catRes, analyticsRes] = await Promise.all([
          fetchJsonSafe(`${API_BASE}/dashboard/nps${queryString}`, { headers }),
          fetchJsonSafe(`${API_BASE}/dashboard/category-breakdown${queryString}`, { headers }),
          fetchJsonSafe(`${API_BASE}/analytics${queryString}`, { headers })
        ]);

        const npsData = npsRes.data || {};
        const catData = catRes.data || [];
        const analyticsData = analyticsRes.data || {};

        if (!npsRes.res.ok || !catRes.res.ok || !analyticsRes.res.ok) {
          setError(
            npsData.detail ||
            catData.detail ||
            analyticsData.detail ||
            "Failed to load metrics"
          );
          return;
        }

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
  }, [activePlatform, headerSignature, selectedAnalyticsEntityIds, fetchJsonSafe]);

  // Load yes/no question analytics
  useEffect(() => {
    if (!activePlatform || !isB2BPlatform) {
      setYesNoQuestionAnalytics([]);
      return;
    }

    const load = async () => {
      const params = new URLSearchParams({ survey_type: activePlatform });
      if (selectedAnalyticsEntityIds.length > 0) {
        params.set("business_ids", selectedAnalyticsEntityIds.join(","));
      }
      const { res, data } = await fetchJsonSafe(`${API_BASE}/analytics/questions/yes-no?${params.toString()}`, { headers });
      if (!res.ok) {
        setYesNoQuestionAnalytics([]);
        return;
      }
      setYesNoQuestionAnalytics(Array.isArray(data?.items) ? data.items : []);
    };

    load();
  }, [activePlatform, isB2BPlatform, headerSignature, selectedAnalyticsEntityIds, fetchJsonSafe]);

  // Load question averages for drilldown table
  useEffect(() => {
    if (!activePlatform) return;
    const load = async () => {
      const params = new URLSearchParams({ survey_type: activePlatform });
      if (selectedAnalyticsEntityIds.length > 0) {
        params.set("business_ids", selectedAnalyticsEntityIds.join(","));
      }
      const { res, data } = await fetchJsonSafe(`${API_BASE}/analytics/questions?${params.toString()}`, { headers });
      if (!res.ok) return;
      const values = Array.isArray(data?.items) ? data.items : [];
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
   }, [activePlatform, headerSignature, selectedAnalyticsEntityIds, fetchJsonSafe]);

  // Load question trend data
  useEffect(() => {
    if (!selectedQuestionId || !activePlatform) return;
    const load = async () => {
      const params = new URLSearchParams({ survey_type: activePlatform, interval: "week" });
      if (selectedAnalyticsEntityIds.length > 0) {
        params.set("business_ids", selectedAnalyticsEntityIds.join(","));
      }
      const { res, data } = await fetchJsonSafe(`${API_BASE}/analytics/questions/${selectedQuestionId}/trend?${params.toString()}`, { headers });
      if (!res.ok) return;
      const rows = Array.isArray(data?.points) ? data.points : [];
      setTrendData(rows.map((row) => ({ period: row.period_label || row.period, average: Number(row.average_score || 0) })));
    };
    load();
  }, [activePlatform, headerSignature, selectedQuestionId, selectedAnalyticsEntityIds, fetchJsonSafe]);

  const loadPendingVisits = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("status", "Pending");
    if (activePlatform) params.set("survey_type", activePlatform);
    const { res, data } = await fetchJsonSafe(`${API_BASE}/dashboard-visits/all?${params.toString()}`, { headers });
    if (!res.ok) {
      setError(data?.detail || "Failed to load pending visits");
      return;
    }
    const normalized = (Array.isArray(data) ? data : []).map((visit) => ({
      ...visit,
      visit_id: visit.visit_id ?? visit.id,
    }));
    setPendingVisits(normalized);
  }, [activePlatform, headers, fetchJsonSafe]);

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
      await fetch(`${API_BASE}/mystery-shopper/bootstrap`, { method: "POST", headers });
      const res = await fetch(`${API_BASE}/mystery-shopper/locations`, { headers });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Failed to load locations");
        return;
      }
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
      const res = await fetch(`${API_BASE}/mystery-shopper/purposes`, { headers });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Failed to load purposes");
        return;
      }
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
    if (!activePlatform) return;

    const params = new URLSearchParams();
    if (surveyStatusFilter !== "all") params.set("status", surveyStatusFilter);
    if (isB2BPlatform && selectedSurveyBusiness) params.set("business_name", selectedSurveyBusiness);
    if (isMysteryShopperPlatform && selectedSurveyLocation) params.set("business_name", selectedSurveyLocation);
    if (activePlatform) params.set("survey_type", activePlatform);

    setSurveyLoading(true);
    setError("");
    try {
      const { res, data } = await fetchJsonSafe(`${API_BASE}/dashboard-visits/all?${params.toString()}`, { headers });
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
    const res = await fetch(`${API_BASE}/dashboard-visits/${visitId}`, { headers });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || "Failed to load survey details");
      return;
    }
    setSelectedSurveyVisit(data);
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
    const { res, data } = await fetchJsonSafe(`${API_BASE}/dashboard-visits/${visitId}/${decision}`, {
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

  useEffect(() => {
    if (!isB2BPlatform) {
      setSelectedSurveyBusiness("");
    }
    if (!isMysteryShopperPlatform) {
      setSelectedSurveyLocation("");
    }
  }, [isB2BPlatform, isMysteryShopperPlatform]);

  useEffect(() => {
    if (location.pathname !== "/surveys") return;
    loadSurveyResults();
  }, [location.pathname, activePlatform, headerSignature, surveyStatusFilter, selectedSurveyBusiness, selectedSurveyLocation]);

  useEffect(() => {
    if (location.pathname !== "/planned") return;
    loadPlannedVisits();
  }, [location.pathname, activePlatform, headerSignature]);

   const analyticsCards = [
     ...(isMysteryShopperPlatform
       ? [
           { title: "Total Responses", value: analytics?.nps?.total_responses ?? 0 },
           { title: "Draft Visits", value: analytics?.visits?.draft ?? 0 },
           { title: "Pending Visits", value: analytics?.visits?.pending ?? 0 },
           { title: "Review Queue", value: pendingVisits.length },
         ]
       : [
           { title: "NPS", value: analytics?.nps?.nps ?? "--" },
           { title: "CSAT", value: `${analytics?.customer_satisfaction?.csat_score?.toFixed?.(1) ?? "--"}%` },
         ]),
     ...(isB2BPlatform && !isMysteryShopperPlatform
       ? [
           { title: "Relationship Score", value: analytics?.relationship_score?.score?.toFixed?.(1) ?? "--" },
           { title: "Competitive Exposure", value: `${analytics?.competitive_exposure?.exposure_rate?.toFixed?.(1) ?? "--"}%` }
         ]
       : []),
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

  const categoryBreakdownData = useMemo(() => {
    const shouldUseTargetedBreakdown = selectedAnalyticsEntityIds.length > 0;
    if (!shouldUseTargetedBreakdown || questionAverages.length === 0) {
      return analytics?.category_breakdown || [];
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

  const surveyResponsesByCategory = useMemo(() => {
    const responses = Array.isArray(selectedSurveyVisit?.responses) ? selectedSurveyVisit.responses : [];
    return responses.reduce((acc, response) => {
      const category = response.category || "Uncategorized";
      if (!acc[category]) acc[category] = [];
      acc[category].push(response);
      return acc;
    }, {});
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

  // Load representatives (account executives)
  useEffect(() => {
    if (!isB2BPlatform) {
      setRepresentatives([]);
      return;
    }
    const load = async () => {
      try {
      const { res, data } = await fetchJsonSafe(`${B2B_API_BASE}/public/account-executives`, { headers });
      if (!res.ok) return;
      setRepresentatives(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load representatives", err);
      }
    };
    load();
  }, [headerSignature, isB2BPlatform, fetchJsonSafe]);

  // Business CRUD handlers
  const handleEditBusiness = (business) => {
    setSelectedBusiness(business);
    setBusinessForm({
      name: business.name,
      location: business.location || "",
      priority_level: business.priority_level || "medium",
      active: business.active,
      account_executive_id: business.account_executive_id ? String(business.account_executive_id) : ""
    });
    setAccountExecutiveQuery(
      business.account_executive_id ? representativeMap[business.account_executive_id] || "" : ""
    );
    businessFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => {
      const firstInput = businessFormRef.current?.querySelector("input");
      firstInput?.focus();
    }, 350);
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
      priority_level: businessForm.priority_level,
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
    setBusinessForm({ name: "", location: "", priority_level: "medium", active: true, account_executive_id: "" });
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
      priority_level: businessForm.priority_level,
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
    setBusinessForm({ name: "", location: "", priority_level: "medium", active: true, account_executive_id: "" });
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
    const res = await fetch(`${B2B_API_BASE}/businesses/${business.id}`, {
      method: "DELETE",
      headers
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || "Failed to delete business");
      return;
    }
    setMessage(`Business deleted: ${business.name}`);
    await loadBusinesses();
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
  }, [headerSignature, isB2BPlatform, fetchJsonSafe]);

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
    const res = await fetch(`${API_BASE}/mystery-shopper/locations`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || "Failed to create location");
      return;
    }
    setNewMysteryLocation("");
    setMessage(`Location added: ${data.name}`);
    await loadMysteryLocations();
  };

  const deactivateMysteryLocation = async (locationId) => {
    pushToast("info", "Archiving location...", 1500);
    const res = await fetch(`${API_BASE}/mystery-shopper/locations/${locationId}`, { method: "DELETE", headers });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || "Failed to deactivate location");
      return;
    }
    setMessage(`Location archived: ${data.name}`);
    await loadMysteryLocations();
  };

  const reactivateMysteryLocation = async (locationId) => {
    pushToast("info", "Reactivating location...", 1500);
    const res = await fetch(`${API_BASE}/mystery-shopper/locations/${locationId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ active: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || "Failed to reactivate location");
      return;
    }
    setMessage(`Location reactivated: ${data.name}`);
    await loadMysteryLocations();
  };

  const deleteMysteryLocation = async (locationItem) => {
    if (!window.confirm(`Delete location "${locationItem.name}" permanently?`)) return;
    pushToast("info", "Deleting location...", 1500);
    const res = await fetch(`${API_BASE}/mystery-shopper/locations/${locationItem.id}/purge`, { method: "DELETE", headers });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || "Failed to delete location");
      return;
    }
    setMessage(`Location deleted: ${data.name}`);
    await loadMysteryLocations();
  };

  const createMysteryPurpose = async () => {
    const name = newMysteryPurpose.trim();
    if (!name) {
      setError("Purpose name is required");
      return;
    }
    pushToast("info", "Adding purpose...", 1500);
    const res = await fetch(`${API_BASE}/mystery-shopper/purposes`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || "Failed to create purpose");
      return;
    }
    setNewMysteryPurpose("");
    setMessage(`Purpose added: ${data.name}`);
    await loadMysteryPurposes();
  };

  const deactivateMysteryPurpose = async (purposeId) => {
    pushToast("info", "Archiving purpose...", 1500);
    const res = await fetch(`${API_BASE}/mystery-shopper/purposes/${purposeId}`, { method: "DELETE", headers });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || "Failed to deactivate purpose");
      return;
    }
    setMessage(`Purpose archived: ${data.name}`);
    await loadMysteryPurposes();
  };

  const reactivateMysteryPurpose = async (purposeId) => {
    pushToast("info", "Reactivating purpose...", 1500);
    const res = await fetch(`${API_BASE}/mystery-shopper/purposes/${purposeId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ active: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || "Failed to reactivate purpose");
      return;
    }
    setMessage(`Purpose reactivated: ${data.name}`);
    await loadMysteryPurposes();
  };

  const deleteMysteryPurpose = async (purposeItem) => {
    if (!window.confirm(`Delete purpose "${purposeItem.name}" permanently?`)) return;
    pushToast("info", "Deleting purpose...", 1500);
    const res = await fetch(`${API_BASE}/mystery-shopper/purposes/${purposeItem.id}/purge`, { method: "DELETE", headers });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || "Failed to delete purpose");
      return;
    }
    setMessage(`Purpose deleted: ${data.name}`);
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
      <div className="fixed right-4 top-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`animate-in fade-in slide-in-from-top-2 rounded-md border px-3 py-2 text-sm shadow-sm ${
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
      {error && (
        <div className="mb-4 p-4 border border-destructive/50 bg-destructive/10 text-destructive rounded">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-4 rounded border border-emerald-400/40 bg-emerald-500/10 p-4 text-emerald-700 dark:text-emerald-300">
          {message}
        </div>
      )}

      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">CX Dashboard Blueprint</h2>
          <p className="text-muted-foreground">Platform: {activePlatform}</p>
        </div>
      </div>

      {location.pathname === "/" ? (
        <>
          {isB2BPlatform ? (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Business Focus Filter</CardTitle>
                <CardDescription>Select one or more businesses to focus relationship, competitor, and question trend analytics.</CardDescription>
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

          {isB2BPlatform ? (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Yes/No Question Results</CardTitle>
                <CardDescription>Distribution of answers for Questions 4, 6, 9, and 16.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {yesNoQuestionCards.map((item) => (
                    <div key={item.key} className="rounded-lg border bg-muted/30 p-4">
                      <p className="text-sm font-semibold">{item.label}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{item.question_text}</p>
                      <div className="mt-3 h-56">
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
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Location Focus Filter</CardTitle>
                <CardDescription>Select one or more service-center locations to focus all analytics and question trends.</CardDescription>
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
            {analyticsCards.map((card) => (
              <Card key={card.title} className="transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
                <CardHeader className="pb-2">
                  <CardDescription>{card.title}</CardDescription>
                  <CardTitle className="text-3xl">{card.value}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-8">
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
              <CardContent className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis domain={[0, 10]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="average" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Category Breakdown
                  <InfoHint text="Click a category to see which score questions are used to calculate its average." />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {categoryBreakdownData.map((item) => (
                  <div key={item.category} className="rounded-md bg-muted/60 p-2">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 text-left"
                      onClick={() => setExpandedCategory((prev) => (prev === item.category ? "" : item.category))}
                    >
                      <span className="text-sm font-medium">{item.category}</span>
                      <span className="inline-flex items-center gap-2">
                        <Badge>{Number(item.average_score || 0).toFixed(2)}</Badge>
                        {expandedCategory === item.category ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </span>
                    </button>
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
            <Card className="lg:col-span-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  NPS Survey
                  <InfoHint text="We count answers in three groups: Promoters (9-10), Passives (7-8), and Detractors (0-6). NPS is then calculated as Promoters percent minus Detractors percent." />
                </CardTitle>
                <CardDescription>
                  {analytics?.nps?.total_responses ?? 0} approved responses
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center">
                  <div className="text-6xl font-bold mb-4" style={{ color: "hsl(var(--primary))" }}>
                    {analytics?.nps?.nps ?? "--"}
                  </div>
                  
                  <div className="w-full h-64">
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
            <Card className="lg:col-span-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Customer Satisfaction
                  <InfoHint text="Customer Satisfaction is the share of positive ratings. We add Satisfied (7-8) and Very Satisfied (9-10), then divide by all responses and convert to a percentage." />
                </CardTitle>
                <CardDescription>
                  {analytics?.customer_satisfaction?.response_count ?? 0} responses to satisfaction question
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center">
                  <div className="text-6xl font-bold mb-4" style={{ color: "hsl(var(--primary))" }}>
                    {analytics?.customer_satisfaction?.csat_score?.toFixed?.(1) ?? "--"}%
                  </div>
                  
                  <div className="w-full h-64">
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
              <Card>
                <CardHeader>
                  <CardTitle>Overall Relationship Score</CardTitle>
                  <CardDescription>Normalized 0-100 from relationship-question scoring.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-4xl font-semibold">{analytics?.relationship_score?.score?.toFixed?.(1) ?? "--"}</div>
                  <div className="h-48">
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
              <Card>
                <CardHeader>
                  <CardTitle>Competitor Analysis</CardTitle>
                  <CardDescription>Accounts using competitor services versus total surveyed accounts.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-4xl font-semibold">{analytics?.competitive_exposure?.exposure_rate?.toFixed?.(1) ?? "0.0"}%</div>
                  <div className="h-48">
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

          {isMysteryShopperPlatform ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Overall Experience</CardTitle>
                  <CardDescription>Weighted average from overall-experience scoring questions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-4xl font-semibold">{mysteryAnalyticsSummary.overallExperienceAvg?.toFixed?.(2) ?? "--"}</div>
                  <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded bg-muted p-3">
                      <p className="text-muted-foreground">Service Quality Avg</p>
                      <p className="font-medium">{mysteryAnalyticsSummary.qualityAvg?.toFixed?.(2) ?? "--"}</p>
                    </div>
                    <div className="rounded bg-muted p-3">
                      <p className="text-muted-foreground">NPS Score</p>
                      <p className="font-medium">{analytics?.nps?.nps ?? "--"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Operational Efficiency</CardTitle>
                  <CardDescription>CSAT, waiting time, and service completion distribution by selected location scope.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded bg-muted p-3">
                      <p className="text-muted-foreground">CSAT Average</p>
                      <p className="font-medium">{analytics?.mystery_shopper?.csat_average?.toFixed?.(2) ?? "--"}</p>
                    </div>
                    <div className="rounded bg-muted p-3">
                      <p className="text-muted-foreground">CSAT Responses</p>
                      <p className="font-medium">{analytics?.mystery_shopper?.csat_response_count ?? 0}</p>
                    </div>
                  </div>
                  <div className="rounded bg-muted p-3">
                    <p className="text-muted-foreground">Waiting Time</p>
                    <p>{(analytics?.mystery_shopper?.waiting_time_distribution || []).map((item) => `${item.label}: ${item.count}`).join(" | ") || "No data"}</p>
                  </div>
                  <div className="rounded bg-muted p-3">
                    <p className="text-muted-foreground">Service Completion</p>
                    <p>{(analytics?.mystery_shopper?.service_completion_distribution || []).map((item) => `${item.label}: ${item.count}`).join(" | ") || "No data"}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </>
      ) : null}

      {location.pathname === "/trends" ? (
        <Card>
          <CardHeader>
            <CardTitle>Trend Explorer</CardTitle>
            <CardDescription>Weekly progression for selected questions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={selectedQuestionId} onChange={(event) => setSelectedQuestionId(event.target.value)}>
              {questionAverages.length === 0 ? <option value="">No questions available</option> : null}
              {questionAverages.map((question) => (
                <option key={question.question_id} value={String(question.question_id)}>{question.question_text}</option>
              ))}
            </Select>
            <div className="h-[420px]">
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
      ) : null}

      {location.pathname === "/review" ? (
        <Card>
          <CardHeader>
            <CardTitle>Review Queue</CardTitle>
            <CardDescription>Pending visits waiting for review.</CardDescription>
          </CardHeader>
          <CardContent>
                <Table className="min-w-[560px]">
                <TableHeader>
                <TableRow>
                  <TableHead>Visit ID</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingVisits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>No pending visits in review queue.</TableCell>
                  </TableRow>
                ) : (
                  pendingVisits.map((visit) => {
                    const visitId = String(visit.id || visit.visit_id || "");
                    const isLoading = reviewActionLoadingVisitId === visitId;
                    return (
                      <TableRow key={visitId}>
                        <TableCell>{visitId}</TableCell>
                        <TableCell>{visit.business_name || "--"}</TableCell>
                        <TableCell>{visit.visit_date || "--"}</TableCell>
                        <TableCell><Badge variant="warning">{visit.status || "Pending"}</Badge></TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => loadSurveyVisitDetails(visitId)} disabled={isLoading}>View</Button>
                            <Button type="button" size="sm" onClick={() => handleReviewDecision(visit, "approve")} disabled={isLoading}>Approve</Button>
                            <Button type="button" size="sm" variant="destructive" onClick={() => handleReviewDecision(visit, "reject")} disabled={isLoading}>Reject</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
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
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Business</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!plannedLoading && plannedVisits.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6}>No draft planned visits found.</TableCell>
                      </TableRow>
                    ) : plannedLoading ? (
                      <TableRow>
                        <TableCell colSpan={6}>Loading draft planned visits...</TableCell>
                      </TableRow>
                    ) : (
                      plannedVisits.map((visit) => (
                        <TableRow key={visit.id || visit.visit_id}>
                          <TableCell>{visit.business_name || "--"}</TableCell>
                          <TableCell>
                            {String(visit.id || visit.visit_id) === editingPlannedVisitId ? (
                              <Input
                                type="date"
                                value={plannedEditForm.visit_date}
                                onChange={(event) => setPlannedEditForm((prev) => ({ ...prev, visit_date: event.target.value }))}
                              />
                            ) : (
                              visit.visit_date || "--"
                            )}
                          </TableCell>
                          <TableCell>
                            {String(visit.id || visit.visit_id) === editingPlannedVisitId ? (
                              <Select
                                value={plannedEditForm.visit_type}
                                onChange={(event) => setPlannedEditForm((prev) => ({ ...prev, visit_type: event.target.value }))}
                              >
                                <option value="Planned">Planned</option>
                                <option value="Priority">Priority</option>
                                <option value="Substitution">Substitution</option>
                              </Select>
                            ) : (
                              visit.visit_type || "--"
                            )}
                          </TableCell>
                          <TableCell><Badge variant="secondary">{visit.status || "Draft"}</Badge></TableCell>
                          <TableCell>{visit.mandatory_answered_count || 0}/{visit.mandatory_total_count || 0}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              {String(visit.id || visit.visit_id) === editingPlannedVisitId ? (
                                <>
                                  <Button type="button" size="sm" onClick={() => savePlannedVisitEdit(visit.id || visit.visit_id)}>Save</Button>
                                  <Button type="button" size="sm" variant="outline" onClick={cancelEditPlannedVisit}>Cancel</Button>
                                </>
                              ) : (
                                <Button type="button" size="sm" variant="outline" onClick={() => startEditPlannedVisit(visit)}>Edit</Button>
                              )}
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeletePlannedVisit(visit.id || visit.visit_id)}
                              >
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
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

      {location.pathname === "/surveys" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Survey Results</CardTitle>
              <CardDescription>View full survey submissions, then open each visit to inspect all questions and answers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-2">
                <Select value={surveyStatusFilter} onChange={(event) => setSurveyStatusFilter(event.target.value)}>
                  <option value="all">All Statuses</option>
                  <option value="Draft">Draft</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Needs Changes">Needs Changes</option>
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

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={loadSurveyResults}>Refresh</Button>
                <span className="inline-flex items-center text-sm text-muted-foreground">{surveyLoading ? "Loading..." : `${surveyResults.length} results`}</span>
              </div>

              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{isMysteryShopperPlatform ? "Location" : "Business"}</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!surveyLoading && surveyResults.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5}>No survey results found.</TableCell>
                    </TableRow>
                  ) : surveyLoading ? (
                    <TableRow>
                      <TableCell colSpan={5}>Loading survey results...</TableCell>
                    </TableRow>
                  ) : (
                    surveyResults.map((visit) => (
                      <TableRow key={visit.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{visit.business_name || "--"}</span>
                            <span className="text-xs text-muted-foreground">Visit ID: {visit.id}</span>
                          </div>
                        </TableCell>
                        <TableCell>{visit.visit_date || "--"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              visit.status === "Approved"
                                ? "success"
                                : visit.status === "Pending" || visit.status === "Needs Changes"
                                ? "warning"
                                : visit.status === "Rejected"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {visit.status || "--"}
                          </Badge>
                        </TableCell>
                        <TableCell>{visit.mandatory_answered_count || 0}/{visit.mandatory_total_count || 0}</TableCell>
                        <TableCell>
                          <Button type="button" variant="outline" size="sm" onClick={() => loadSurveyVisitDetails(visit.id)}>
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {selectedSurveyVisit ? (
            <Card>
              <CardHeader>
                <CardTitle>Survey Detail - {selectedSurveyVisit.business_name || "Visit"}</CardTitle>
                <CardDescription>
                  {selectedSurveyVisit.visit_date || "--"} | {selectedSurveyVisit.status || "--"} | Representative: {selectedSurveyVisit.representative_name || selectedSurveyVisit.representative_id || "--"}
                </CardDescription>
                <CardDescription>
                  Audit Signature: {selectedSurveyVisit.submitted_by_name || "--"} ({selectedSurveyVisit.submitted_by_email || "--"}) {selectedSurveyVisit.submitted_at ? `at ${selectedSurveyVisit.submitted_at}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.keys(surveyResponsesByCategory).length > 0 ? (
                  Object.entries(surveyResponsesByCategory).map(([category, responses]) => (
                    <div key={category} className="space-y-2 rounded-lg border p-3">
                      <p className="text-sm font-semibold">{category}</p>
                      {responses.map((response) => {
                        const display = formatSurveyResponseValue(response);
                        return (
                          <div key={response.response_id || `${response.question_id}-${response.created_at || ""}`} className="rounded-md border bg-background p-3">
                            <div className="mb-1 flex items-center justify-between">
                              <p className="text-sm font-medium">Question {response.question_number || response.question_id}</p>
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
          ) : null}
        </div>
      ) : null}

      {location.pathname === "/locations" ? (
        isMysteryShopperPlatform ? (
          <Card>
            <CardHeader>
              <CardTitle>Locations</CardTitle>
              <CardDescription>Manage customer service center locations used by the Mystery Shopper survey.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Input value={newMysteryLocation} onChange={(event) => setNewMysteryLocation(event.target.value)} placeholder="Add new location" />
                <Button type="button" onClick={createMysteryLocation}>Add Location</Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={loadMysteryLocations}>{mysteryLocationsLoading ? "Refreshing..." : "Refresh"}</Button>
                  <Button type="button" variant="outline" onClick={seedMysteryLegacyData} disabled={mysteryLegacySeeding}>{mysteryLegacySeeding ? "Seeding..." : "Seed Old Data"}</Button>
                </div>
              </div>

              <Table className="min-w-[560px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mysteryLocations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3}>No locations added yet.</TableCell>
                    </TableRow>
                  ) : (
                    mysteryLocations.map((locationItem) => (
                      <TableRow key={locationItem.id}>
                        <TableCell>{locationItem.name}</TableCell>
                        <TableCell>
                          <Badge variant={locationItem.active ? "success" : "secondary"}>{locationItem.active ? "Active" : "Inactive"}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {locationItem.active ? (
                              <Button type="button" variant="outline" size="sm" onClick={() => deactivateMysteryLocation(locationItem.id)}>Deactivate</Button>
                            ) : (
                              <Button type="button" variant="outline" size="sm" onClick={() => reactivateMysteryLocation(locationItem.id)}>Reactivate</Button>
                            )}
                            <Button type="button" variant="destructive" size="sm" onClick={() => deleteMysteryLocation(locationItem)}>Delete</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
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
          <Card>
            <CardHeader>
              <CardTitle>Purposes</CardTitle>
              <CardDescription>Manage visit purpose options used when completing Mystery Shopper surveys.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Input value={newMysteryPurpose} onChange={(event) => setNewMysteryPurpose(event.target.value)} placeholder="Add new purpose" />
                <Button type="button" onClick={createMysteryPurpose}>Add Purpose</Button>
                <Button type="button" variant="outline" onClick={loadMysteryPurposes}>{mysteryPurposesLoading ? "Refreshing..." : "Refresh"}</Button>
              </div>

              <Table className="min-w-[560px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mysteryPurposes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3}>No purposes configured yet.</TableCell>
                    </TableRow>
                  ) : (
                    mysteryPurposes.map((purposeItem) => (
                      <TableRow key={purposeItem.id}>
                        <TableCell>{purposeItem.name}</TableCell>
                        <TableCell>
                          <Badge variant={purposeItem.active ? "success" : "secondary"}>{purposeItem.active ? "Active" : "Inactive"}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {purposeItem.active ? (
                              <Button type="button" variant="outline" size="sm" onClick={() => deactivateMysteryPurpose(purposeItem.id)}>Deactivate</Button>
                            ) : (
                              <Button type="button" variant="outline" size="sm" onClick={() => reactivateMysteryPurpose(purposeItem.id)}>Reactivate</Button>
                            )}
                            <Button type="button" variant="destructive" size="sm" onClick={() => deleteMysteryPurpose(purposeItem)}>Delete</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
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
           {/* Business Form */}
           <Card ref={businessFormRef} className="mb-6">
             <CardHeader>
               <CardTitle>{selectedBusiness ? "Edit Business" : "Create Business"}</CardTitle>
               {selectedBusiness && (
                 <Button type="button" variant="outline" size="sm" onClick={() => { setSelectedBusiness(null); setBusinessForm({ name: "", location: "", priority_level: "medium", active: true, account_executive_id: "" }); setAccountExecutiveQuery(""); }}>
                   Cancel Edit
                 </Button>
               )}
             </CardHeader>
             <CardContent className="space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                   <label className="block text-sm font-medium mb-1">Business Name</label>
                   <Input value={businessForm.name} onChange={(e) => setBusinessForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Business name" />
                 </div>
                 <div>
                   <label className="block text-sm font-medium mb-1">Location</label>
                   <Input value={businessForm.location} onChange={(e) => setBusinessForm((prev) => ({ ...prev, location: e.target.value }))} placeholder="Location" />
                 </div>
                 <div>
                   <label className="block text-sm font-medium mb-1">Priority</label>
                   <Select value={businessForm.priority_level} onChange={(e) => setBusinessForm((prev) => ({ ...prev, priority_level: e.target.value }))}>
                     <option value="high">High</option>
                     <option value="medium">Medium</option>
                     <option value="low">Low</option>
                   </Select>
                 </div>
                 <div>
                   <label className="block text-sm font-medium mb-1">Status</label>
                   <Select value={businessForm.active ? "active" : "inactive"} onChange={(e) => setBusinessForm((prev) => ({ ...prev, active: e.target.value === "active" }))}>
                     <option value="active">Active</option>
                     <option value="inactive">Inactive</option>
                   </Select>
                 </div>
                 <div className="md:col-span-2">
                   <label className="block text-sm font-medium mb-1">Account Executive</label>
                   <Input
                     list="account-executives"
                     value={accountExecutiveQuery}
                      onChange={(e) => {
                        const value = e.target.value;
                        setAccountExecutiveQuery(value);
                        const match = representatives.find((exec) => {
                          const label = exec.name || exec.full_name || exec.display_name || exec.email || "";
                          return label.toLowerCase() === value.toLowerCase();
                        });
                        setBusinessForm((prev) => ({ ...prev, account_executive_id: match ? String(match.id) : "" }));
                      }}
                      placeholder="Start typing an executive"
                    />
                    <datalist id="account-executives">
                      {representatives.map((exec) => (
                        <option key={exec.id} value={exec.name || exec.full_name || exec.display_name || exec.email || "Unknown"} />
                      ))}
                    </datalist>
                   <p className="text-xs text-muted-foreground mt-1">Select an executive from the list.</p>
                 </div>
               </div>
               <div className="flex gap-2">
                 <Button type="button" onClick={selectedBusiness ? handleUpdateBusiness : handleCreateBusiness}>
                   {selectedBusiness ? "Update Business" : "Save Business"}
                 </Button>
                 {selectedBusiness && (
                   <Button type="button" variant="outline" onClick={() => { setSelectedBusiness(null); setBusinessForm({ name: "", location: "", priority_level: "medium", active: true, account_executive_id: "" }); setAccountExecutiveQuery(""); }}>
                     Cancel
                   </Button>
                 )}
               </div>
               <p className="text-xs text-muted-foreground">Platform admins can create businesses and set priority.</p>
             </CardContent>
           </Card>

           {/* Business Directory */}
           <Card>
             <CardHeader>
               <CardTitle>Business Directory</CardTitle>
               <Button type="button" variant="outline" size="sm" onClick={loadBusinesses}>Refresh</Button>
             </CardHeader>
             <CardContent>
               <div className="flex gap-2 mb-4">
                 <Input placeholder="Filter by name or location" value={status} onChange={(e) => setStatus(e.target.value)} />
               </div>
                <Table className="min-w-[860px]">
                 <TableHeader>
                   <TableRow>
                     <TableHead>Name</TableHead>
                     <TableHead>Location</TableHead>
                     <TableHead>Priority</TableHead>
                     <TableHead>Account Executive</TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead>Actions</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {businesses
                     .filter((business) => {
                       if (!status) return true;
                       const query = status.toLowerCase();
                       return (business.name?.toLowerCase().includes(query) || business.location?.toLowerCase().includes(query));
                     })
                     .map((business) => (
                       <TableRow key={business.id} className={!business.location || !business.account_executive_id ? "bg-warning/10" : ""}>
                         <TableCell>{business.name}</TableCell>
                         <TableCell>{business.location || "--"}</TableCell>
                         <TableCell>
                           <Badge variant={business.priority_level === "high" ? "destructive" : business.priority_level === "low" ? "secondary" : "default"}>
                             {business.priority_level || "medium"}
                           </Badge>
                         </TableCell>
                          <TableCell>{representativeMap[business.account_executive_id] || "Unassigned"}</TableCell>
                         <TableCell>
                           <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${business.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                             {business.active ? "Active" : "Retired"}
                           </span>
                         </TableCell>
                         <TableCell>
                           <div className="flex gap-2">
                             <Button type="button" variant="outline" size="sm" onClick={() => handleEditBusiness(business)}>Edit</Button>
                             {business.active && (
                               <Button type="button" variant="outline" size="sm" onClick={() => handleRetireBusiness(business)}>Retire</Button>
                             )}
                             <Button type="button" variant="destructive" size="sm" onClick={() => handleDeleteBusiness(business)}>Delete</Button>
                           </div>
                         </TableCell>
                       </TableRow>
                     ))}
                 </TableBody>
               </Table>
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
    </PageContainer>
  );
}
