import { useEffect, useMemo, useState } from "react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Toaster, toast } from "sonner";
import "sonner/dist/styles.css";
import { AnimatePresence, motion } from "framer-motion";
import { gsap } from "gsap";
import {
  BarChart3,
  Building2,
  CalendarDays,
  ClipboardCheck,
  FileText,
  LogOut,
  MapPin,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./components/ui/table";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Select } from "./components/ui/select";
import { Badge } from "./components/ui/badge";
import { Checkbox } from "./components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Textarea } from "./components/ui/textarea";
import { ensureMsalInitialized, loginRequest } from "./auth";
import { isTokenExpired } from "./utils/tokenExpiry";
import "./review.css";

const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

export default function App() {
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  // Enforce token expiry (force re-login when token near expiry)
  useEffect(() => {
    if (isAuthenticated && accounts.length > 0) {
      const account = accounts[0];
      if (isTokenExpired(account)) {
        instance.logout();
      }
    }
   }, [isAuthenticated, accounts, instance]);

   const [msalReady, setMsalReady] = useState(false);
  const [userId, setUserId] = useState("3");
  const [role, setRole] = useState("Manager");
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [entraRoles, setEntraRoles] = useState([]);
  const [surveyTypes, setSurveyTypes] = useState([]);
  const [activePlatform, setActivePlatform] = useState(null);
  const [previewPlatform, setPreviewPlatform] = useState("B2B");
  const [nps, setNps] = useState(null);
  const [coverage, setCoverage] = useState(null);
  const [categories, setCategories] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [questionAverages, setQuestionAverages] = useState([]);
  const [questionAnalyticsLoading, setQuestionAnalyticsLoading] = useState(false);
  const [questionSearch, setQuestionSearch] = useState("");
  const [questionCategoryFilter, setQuestionCategoryFilter] = useState("all");
  const [selectedQuestionTrend, setSelectedQuestionTrend] = useState(null);
  const [questionTrendLoading, setQuestionTrendLoading] = useState(false);
  const [questionTrendInterval, setQuestionTrendInterval] = useState("week");
  const [analyticsDateFrom, setAnalyticsDateFrom] = useState("");
  const [analyticsDateTo, setAnalyticsDateTo] = useState("");
  const [targetedAnalytics, setTargetedAnalytics] = useState(null);
  const [selectedAnalyticsBusinessIds, setSelectedAnalyticsBusinessIds] = useState([]);
  const [analyticsBusinessSearch, setAnalyticsBusinessSearch] = useState("");
  const [pendingVisits, setPendingVisits] = useState([]);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [activeView, setActiveView] = useState("analytics");
  const [reviewNote, setReviewNote] = useState("");
  const [businesses, setBusinesses] = useState([]);
  const [accountExecutives, setAccountExecutives] = useState([]);
  const [representatives, setRepresentatives] = useState([]);
  const [draftVisits, setDraftVisits] = useState([]);
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [surveyResults, setSurveyResults] = useState([]);
  const [mysteryLocations, setMysteryLocations] = useState([]);
  const [newMysteryLocation, setNewMysteryLocation] = useState("");
  const [mysteryLocationsLoading, setMysteryLocationsLoading] = useState(false);
  const [mysteryPurposes, setMysteryPurposes] = useState([]);
  const [newMysteryPurpose, setNewMysteryPurpose] = useState("");
  const [mysteryPurposesLoading, setMysteryPurposesLoading] = useState(false);
  const [mysteryLegacySeeding, setMysteryLegacySeeding] = useState(false);
  const [selectedSurveyVisit, setSelectedSurveyVisit] = useState(null);
  const [surveyFilter, setSurveyFilter] = useState("all"); // all, in_progress, completed, rejected, needs_change
  const [selectedSurveyBusiness, setSelectedSurveyBusiness] = useState(""); // For dropdown selection
  const [surveyDateFilter, setSurveyDateFilter] = useState("");
  const [businessSearchQuery, setBusinessSearchQuery] = useState("");
  const [showBusinessDropdown, setShowBusinessDropdown] = useState(false);
  const [plannedForm, setPlannedForm] = useState({
    business_id: "",
    representative_id: "",
    visit_date: ""
  });
  const [plannedBusinessQuery, setPlannedBusinessQuery] = useState("");
  const [plannedRepresentativeQuery, setPlannedRepresentativeQuery] = useState("");
  const [plannedEditForm, setPlannedEditForm] = useState({
    visit_id: "",
    business_name: "",
    representative_id: "",
    visit_date: ""
  });
  const [businessForm, setBusinessForm] = useState({
    name: "",
    location: "",
    priority_level: "medium",
    active: true,
    account_executive_id: ""
  });
  const [accountExecutiveQuery, setAccountExecutiveQuery] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reviewActionState, setReviewActionState] = useState({
    loading: false,
    type: "info",
    text: ""
  });

  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        await ensureMsalInitialized();
        if (active) setMsalReady(true);
      } catch {
        if (active) setError("Authentication initialization failed.");
      }
    };
    init();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!msalReady) return;
    if (!isAuthenticated && inProgress === "none") {
      instance.loginRedirect(loginRequest);
    }
  }, [instance, inProgress, isAuthenticated, msalReady]);

  useEffect(() => {
    if (!msalReady) return;
    const account = accounts[0];
    if (!account) return;

    const claims = account.idTokenClaims || {};
    const roles = Array.isArray(claims.roles) ? claims.roles : [];
    setEntraRoles(roles);
    setRole(roles.some((item) => item.endsWith("_ADMIN") || item === "CX_SUPER_ADMIN") ? "Admin" : "Representative");
    setUserId(String(claims.sub || claims.oid || claims.preferred_username || ""));
    setUserName(claims.name || account.name || "");
    setUserEmail(claims.preferred_username || account.username || "");

    const loadToken = async () => {
      try {
        const result = await instance.acquireTokenSilent({
          ...loginRequest,
          account,
        });
        setAccessToken(result.accessToken || "");
      } catch (error) {
        if (error instanceof InteractionRequiredAuthError) {
          instance.acquireTokenRedirect(loginRequest);
          return;
        }
        setError("Authentication failed. Redirecting to sign in...");
        instance.acquireTokenRedirect(loginRequest);
      }
    };

    loadToken();
  }, [accounts, instance, msalReady]);

  useEffect(() => {
    if (!accessToken) return;

    const run = async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        const data = await res.json();
        if (!res.ok) return;

        const roles = Array.isArray(data.roles) ? data.roles : [];
        setEntraRoles(roles);
        setUserId(String(data.sub || ""));
        setUserName(data.name || "");
        setUserEmail(data.preferred_username || "");
        setRole(roles.some((item) => item.endsWith("_ADMIN") || item === "CX_SUPER_ADMIN") ? "Admin" : "Representative");
      } catch {
        // keep fallback claims
      }
    };

    run();
  }, [accessToken]);

  const headers = useMemo(() => {
    const next = {
      "Content-Type": "application/json",
      "X-User-Id": userId,
      "X-User-Role": role,
    };
    if (accessToken) {
      next.Authorization = `Bearer ${accessToken}`;
    }
    return next;
  }, [accessToken, userId, role]);

  const representativeMap = useMemo(
    () =>
      representatives.reduce((acc, rep) => {
        acc[rep.id] = rep.name;
        return acc;
      }, {}),
    [representatives]
  );

  const accountExecutiveMap = useMemo(
    () =>
      accountExecutives.reduce((acc, exec) => {
        acc[exec.id] = exec.name;
        return acc;
      }, {}),
    [accountExecutives]
  );

  const filteredAnalyticsBusinesses = useMemo(() => {
    const q = analyticsBusinessSearch.trim().toLowerCase();
    if (!q) return businesses;
    return businesses.filter((business) => {
      const name = (business.name || "").toLowerCase();
      const location = (business.location || "").toLowerCase();
      return name.includes(q) || location.includes(q);
    });
  }, [businesses, analyticsBusinessSearch]);

  const isSuperAdmin = entraRoles.includes("CX_SUPER_ADMIN");
  const hasDashboardAccess =
    isSuperAdmin ||
    entraRoles.includes("B2B_ADMIN") ||
    entraRoles.includes("MYSTERY_ADMIN") ||
    entraRoles.includes("INSTALL_ADMIN");
  const canViewMetrics = hasDashboardAccess;
  const canReview = hasDashboardAccess;
  const canManageBusinesses = hasDashboardAccess;
  const normalizedPlatform = (activePlatform || "").toLowerCase();
  const isB2BPlatform = normalizedPlatform.includes("b2b");
  const isMysteryShopperPlatform = normalizedPlatform.includes("mystery");
  const isOperationalPlatform = isB2BPlatform || isMysteryShopperPlatform;

  useEffect(() => {
    const ctx = gsap.context(() => {
      const targets = gsap.utils.toArray(".panel, .table, .hero, .top-nav, .subhead, .data-table-shell");
      if (!targets.length) return;
      gsap.fromTo(
        targets,
        { autoAlpha: 0, y: 10 },
        { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.04, ease: "power2.out" }
      );
    });

    return () => ctx.revert();
  }, [activeView, activePlatform]);

  const questionCategories = useMemo(() => {
    const set = new Set(questionAverages.map((item) => item.category).filter(Boolean));
    return ["all", ...Array.from(set)];
  }, [questionAverages]);

  const mysteryAnalyticsSummary = useMemo(() => {
    if (!isMysteryShopperPlatform) {
      return {
        qualityAvg: null,
        overallExperienceAvg: null,
      };
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

  const filteredQuestionAverages = useMemo(() => {
    const q = questionSearch.trim().toLowerCase();
    return questionAverages.filter((item) => {
      const categoryOk = questionCategoryFilter === "all" || item.category === questionCategoryFilter;
      if (!categoryOk) return false;
      if (!q) return true;
      return (
        String(item.question_number).includes(q) ||
        (item.question_text || "").toLowerCase().includes(q) ||
        (item.category || "").toLowerCase().includes(q)
      );
    });
  }, [questionAverages, questionSearch, questionCategoryFilter]);

  const platformGuide = useMemo(
    () => ({
      B2B: {
        status: "Live",
        summary: "Account-level CX governance with review workflow, response analytics, and action tracking.",
        sections: ["Analytics", "Review Queue", "Businesses", "Planned Visits", "Survey Results"]
      },
      "Installation Assessment": {
        status: "Planned",
        summary: "Field installation quality scoring with category-level scoring, historical evidence, and contractor insights.",
        sections: ["Assessment Results", "Category Scoring", "Team vs Contractor", "Customer Type Analytics"]
      },
      "Mystery Shopper": {
        status: "Live",
        summary: "Retail/service-centre visit audits with location-level quality scoring, CSAT, and NPS.",
        sections: ["Survey Results", "Quality Analytics", "NPS and CSAT", "Location Trends"]
      }
    }),
    []
  );

  const defaultPlatforms = useMemo(
    () => [{ name: "B2B" }, { name: "Mystery Shopper" }, { name: "Installation Assessment" }],
    []
  );

  const canAccessPlatform = (platformName) => {
    const normalized = String(platformName || "").toLowerCase();
    if (entraRoles.includes("CX_SUPER_ADMIN")) return true;
    if (normalized.includes("b2b")) return entraRoles.includes("B2B_ADMIN");
    if (normalized.includes("mystery")) return entraRoles.includes("MYSTERY_ADMIN");
    if (normalized.includes("installation")) return entraRoles.includes("INSTALL_ADMIN");
    return false;
  };

  const availablePlatforms = useMemo(() => {
    const map = new Map(defaultPlatforms.map((platform) => [platform.name, platform]));
    surveyTypes.forEach((type) => {
      if (!map.has(type.name)) {
        map.set(type.name, { name: type.name });
      }
    });
    return Array.from(map.values()).filter((item) => canAccessPlatform(item.name));
  }, [defaultPlatforms, surveyTypes, entraRoles]);
  const previewMeta = platformGuide[previewPlatform] || {
    status: "Planned",
    summary: "Platform dashboard modules and analytics will be configured after the survey model is finalized.",
    sections: ["Survey Results", "Analytics", "Quality Review", "Operational Metrics"]
  };

  useEffect(() => {
    if (!availablePlatforms.length) return;
    const exists = availablePlatforms.some((type) => type.name === previewPlatform);
    if (!exists) {
      setPreviewPlatform(availablePlatforms[0].name);
    }
  }, [availablePlatforms, previewPlatform]);

  useEffect(() => {
    if (!message) return;
    toast.success(message);
  }, [message]);

  useEffect(() => {
    if (!error) return;
    toast.error(error);
  }, [error]);

  useEffect(() => {
    if (!reviewActionState.text) return;
    if (reviewActionState.type === "success") {
      toast.success(reviewActionState.text);
      return;
    }
    if (reviewActionState.type === "error") {
      toast.error(reviewActionState.text);
      return;
    }
    toast(reviewActionState.text);
  }, [reviewActionState]);

  const loadSurveyTypes = async () => {
    try {
      const res = await fetch(`${API_BASE}/survey-types`, { headers });
      const data = await res.json();
      if (!res.ok) return;
      setSurveyTypes(Array.isArray(data) ? data : []);
    } catch {
      // non-blocking
    }
  };

  const loadMysteryLocations = async () => {
    if (!isMysteryShopperPlatform) return;
    setMysteryLocationsLoading(true);
    try {
      await fetch(`${API_BASE}/mystery-shopper/bootstrap`, {
        method: "POST",
        headers,
      });
      const res = await fetch(`${API_BASE}/mystery-shopper/locations`, { headers });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Failed to load mystery shopper locations");
        return;
      }
      setMysteryLocations(Array.isArray(data) ? data : []);
    } catch {
      setError("Failed to load mystery shopper locations");
    } finally {
      setMysteryLocationsLoading(false);
    }
  };

  const createMysteryLocation = async () => {
    const name = newMysteryLocation.trim();
    if (!name) {
      setError("Location name is required");
      return;
    }
    try {
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
    } catch {
      setError("Failed to create location");
    }
  };

  const loadMysteryPurposes = async () => {
    if (!isMysteryShopperPlatform) return;
    setMysteryPurposesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/mystery-shopper/purposes`, { headers });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Failed to load visit purposes");
        return;
      }
      setMysteryPurposes(Array.isArray(data) ? data : []);
    } catch {
      setError("Failed to load visit purposes");
    } finally {
      setMysteryPurposesLoading(false);
    }
  };

  const createMysteryPurpose = async () => {
    const name = newMysteryPurpose.trim();
    if (!name) {
      setError("Purpose name is required");
      return;
    }
    try {
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
    } catch {
      setError("Failed to create purpose");
    }
  };

  const seedMysteryLegacyData = async () => {
    setMysteryLegacySeeding(true);
    try {
      const res = await fetch(`${API_BASE}/mystery-shopper/seed-legacy`, {
        method: "POST",
        headers,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Failed to seed historical mystery data");
        return;
      }
      setMessage(
        `Legacy seed completed. Locations added: ${data.seeded_location_count || 0}, purposes added: ${data.seeded_purpose_count || 0}`
      );
      await Promise.all([loadMysteryLocations(), loadMysteryPurposes()]);
    } catch {
      setError("Failed to seed historical mystery data");
    } finally {
      setMysteryLegacySeeding(false);
    }
  };

  const deactivateMysteryPurpose = async (purposeId) => {
    try {
      const res = await fetch(`${API_BASE}/mystery-shopper/purposes/${purposeId}`, {
        method: "DELETE",
        headers,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Failed to deactivate purpose");
        return;
      }
      setMessage(`Purpose archived: ${data.name}`);
      await loadMysteryPurposes();
    } catch {
      setError("Failed to deactivate purpose");
    }
  };

  const reactivateMysteryPurpose = async (purposeId) => {
    try {
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
    } catch {
      setError("Failed to reactivate purpose");
    }
  };

  const deleteMysteryPurpose = async (purpose) => {
    const confirmed = window.confirm(
      `Delete purpose \"${purpose.name}\" permanently?\n\nIf this purpose has historical assessments, deletion will be blocked and you should deactivate instead.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`${API_BASE}/mystery-shopper/purposes/${purpose.id}/purge`, {
        method: "DELETE",
        headers,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Failed to delete purpose");
        return;
      }
      setMessage(`Purpose deleted: ${data.name}`);
      await loadMysteryPurposes();
    } catch {
      setError("Failed to delete purpose");
    }
  };

  const deactivateMysteryLocation = async (locationId) => {
    try {
      const res = await fetch(`${API_BASE}/mystery-shopper/locations/${locationId}`, {
        method: "DELETE",
        headers,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Failed to deactivate location");
        return;
      }
      setMessage(`Location archived: ${data.name}`);
      await loadMysteryLocations();
    } catch {
      setError("Failed to deactivate location");
    }
  };

  const reactivateMysteryLocation = async (locationId) => {
    try {
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
    } catch {
      setError("Failed to reactivate location");
    }
  };

  const deleteMysteryLocation = async (location) => {
    const confirmed = window.confirm(
      `Delete location \"${location.name}\" permanently?\n\nIf this location has visits/assessments, deletion will be blocked and you should deactivate instead.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`${API_BASE}/mystery-shopper/locations/${location.id}/purge`, {
        method: "DELETE",
        headers,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Failed to delete location");
        return;
      }
      setMessage(`Location deleted: ${data.name}`);
      await loadMysteryLocations();
    } catch {
      setError("Failed to delete location");
    }
  };

  const loadMetrics = async () => {
    setError("");
    if (!canViewMetrics) {
      setNps(null);
      setCoverage(null);
      setCategories([]);
      return;
    }

    if (analyticsDateFrom && analyticsDateTo && analyticsDateFrom > analyticsDateTo) {
      setError("Analytics date range is invalid. 'From Date' must be before or equal to 'To Date'.");
      return;
    }

    const metricsParams = new URLSearchParams();
    if (activePlatform) metricsParams.set("survey_type", activePlatform);
    if (analyticsDateFrom) metricsParams.set("date_from", analyticsDateFrom);
    if (analyticsDateTo) metricsParams.set("date_to", analyticsDateTo);
    metricsParams.set("_cb", Date.now().toString());
    const queryString = `?${metricsParams.toString()}`;

    try {
      const [npsRes, coverageRes, catRes, analyticsRes] = await Promise.all([
        fetch(`${API_BASE}/dashboard/nps${queryString}`, { headers }),
        fetch(`${API_BASE}/dashboard/coverage${queryString}`, { headers }),
        fetch(`${API_BASE}/dashboard/category-breakdown${queryString}`, { headers }),
        fetch(`${API_BASE}/analytics${queryString}`, { headers })
      ]);

      const npsData = await npsRes.json();
      const coverageData = await coverageRes.json();
      const catData = await catRes.json();
      const analyticsData = await analyticsRes.json();

      if (!npsRes.ok || !coverageRes.ok || !catRes.ok || !analyticsRes.ok) {
        setError(npsData.detail || coverageData.detail || catData.detail || analyticsData.detail || "Failed to load");
        return;
      }

      setNps(npsData);
      setCoverage(coverageData);
      setCategories(catData);
      setAnalytics(analyticsData);
    } catch {
      setError("Failed to load dashboard data");
    }
  };

  const buildPieStyle = (segments) => {
    const total = segments.reduce((sum, seg) => sum + seg.value, 0);
    if (!total) {
      return { background: "conic-gradient(#d8e3f1 0deg 360deg)" };
    }
    let current = 0;
    const slices = segments.map((seg) => {
      const start = (current / total) * 360;
      current += seg.value;
      const end = (current / total) * 360;
      return `${seg.color} ${start}deg ${end}deg`;
    });
    return { background: `conic-gradient(${slices.join(",")})` };
  };

  const loadTargetedAnalytics = async () => {
    if (!canViewMetrics || !isB2BPlatform || selectedAnalyticsBusinessIds.length === 0) {
      setTargetedAnalytics(null);
      return;
    }

    setError("");
    if (analyticsDateFrom && analyticsDateTo && analyticsDateFrom > analyticsDateTo) {
      setError("Analytics date range is invalid. 'From Date' must be before or equal to 'To Date'.");
      return;
    }
    const params = new URLSearchParams();
    params.set("survey_type", activePlatform);
    params.set("business_ids", selectedAnalyticsBusinessIds.join(","));
    if (analyticsDateFrom) params.set("date_from", analyticsDateFrom);
    if (analyticsDateTo) params.set("date_to", analyticsDateTo);
    params.set("_cb", Date.now().toString());

    try {
      const res = await fetch(`${API_BASE}/analytics?${params.toString()}`, { headers });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Failed to load targeted analytics");
        return;
      }
      setTargetedAnalytics(data);
    } catch {
      setError("Failed to load targeted analytics");
    }
  };

  const loadQuestionAverages = async () => {
    if (!canViewMetrics || !activePlatform) {
      setQuestionAverages([]);
      return;
    }

    setQuestionAnalyticsLoading(true);
    const params = new URLSearchParams();
    params.set("survey_type", activePlatform);
    if (isB2BPlatform && selectedAnalyticsBusinessIds.length) {
      params.set("business_ids", selectedAnalyticsBusinessIds.join(","));
    }
    if (analyticsDateFrom) params.set("date_from", analyticsDateFrom);
    if (analyticsDateTo) params.set("date_to", analyticsDateTo);
    params.set("_cb", Date.now().toString());

    try {
      const res = await fetch(`${API_BASE}/analytics/questions?${params.toString()}`, { headers });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Failed to load per-question analytics");
        setQuestionAverages([]);
        return;
      }
      setQuestionAverages(Array.isArray(data.items) ? data.items : []);
    } catch {
      setError("Failed to load per-question analytics");
      setQuestionAverages([]);
    } finally {
      setQuestionAnalyticsLoading(false);
    }
  };

  const loadQuestionTrend = async (questionId) => {
    if (!questionId || !canViewMetrics || !activePlatform) return;

    setQuestionTrendLoading(true);
    const params = new URLSearchParams();
    params.set("survey_type", activePlatform);
    params.set("interval", questionTrendInterval);
    if (isB2BPlatform && selectedAnalyticsBusinessIds.length) {
      params.set("business_ids", selectedAnalyticsBusinessIds.join(","));
    }
    if (analyticsDateFrom) params.set("date_from", analyticsDateFrom);
    if (analyticsDateTo) params.set("date_to", analyticsDateTo);
    params.set("_cb", Date.now().toString());

    try {
      const res = await fetch(`${API_BASE}/analytics/questions/${questionId}/trend?${params.toString()}`, { headers });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Failed to load question trend");
        return;
      }
      setSelectedQuestionTrend(data);
    } catch {
      setError("Failed to load question trend");
    } finally {
      setQuestionTrendLoading(false);
    }
  };

  const formatTrendPeriodLabel = (period) => {
    if (!period) return "-";
    const date = new Date(period);
    if (Number.isNaN(date.getTime())) return String(period);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const trendChartData = useMemo(() => {
    if (!selectedQuestionTrend?.points?.length) return [];
    return selectedQuestionTrend.points.map((point) => ({
      ...point,
      periodLabel: formatTrendPeriodLabel(point.period),
      averageScore: Number(point.average_score || 0),
      responses: Number(point.response_count || 0),
    }));
  }, [selectedQuestionTrend]);

  const loadPending = async () => {
    if (!canReview || !isOperationalPlatform) {
      setPendingVisits([]);
      setSelectedVisit(null);
      return;
    }

    const params = new URLSearchParams();
    params.set("status", "Pending");
    if (activePlatform) {
      params.set("survey_type", activePlatform);
    }
    const res = await fetch(`${API_BASE}/dashboard-visits/all?${params.toString()}`, { headers });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || "Failed to load pending visits");
      return;
    }
    setPendingVisits((Array.isArray(data) ? data : []).map((visit) => ({
      ...visit,
      visit_id: visit.visit_id ?? visit.id,
    })));
  };

  const loadVisitDetail = async (visitId) => {
    const res = await fetch(`${API_BASE}/dashboard-visits/${visitId}`, { headers });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || "Failed to load visit");
      return;
    }
    setSelectedVisit(data);
  };

  const submitReviewAction = async (action) => {
    if (!selectedVisit) return;

    if ((action === "needs-changes" || action === "reject") && !reviewNote.trim()) {
      setError("Review notes are required for Needs Changes or Reject.");
      setReviewActionState({
        loading: false,
        type: "error",
        text: "Add review notes before this action."
      });
      return;
    }

    setMessage("");
    setReviewActionState({ loading: true, type: "info", text: "Saving review action..." });
    const endpoint = `${API_BASE}/dashboard-visits/${selectedVisit.id}/${action}`;
    const payload =
      action === "needs-changes"
        ? { change_notes: reviewNote }
        : action === "approve"
        ? { approval_notes: reviewNote || null }
        : { rejection_notes: reviewNote };

    const res = await fetch(endpoint, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || "Failed to update visit");
      setReviewActionState({
        loading: false,
        type: "error",
        text: data.detail || "Failed to update visit"
      });
      return;
    }

    setMessage(`Visit ${data.status}.`);
    setReviewActionState({
      loading: false,
      type: "success",
      text: `Review saved: ${data.status}`
    });
    setReviewNote("");
    await loadPending();
    setSelectedVisit(null);
  };

  const loadBusinesses = async () => {
    if (!canManageBusinesses || !isB2BPlatform) {
      setBusinesses([]);
      return;
    }

    const res = await fetch(`${API_BASE}/api/b2b/public/businesses`, { headers });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || "Failed to load businesses");
      return;
    }
    setBusinesses(data);
  };

  const loadAccountExecutives = async () => {
    if (!canManageBusinesses || !isB2BPlatform) {
      setAccountExecutives([]);
      return;
    }

    const res = await fetch(`${API_BASE}/api/b2b/public/account-executives`, { headers });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || "Failed to load account executives");
      return;
    }
    setAccountExecutives(data);
  };

  const loadRepresentatives = async () => {
    if (!canManageBusinesses || !isB2BPlatform) {
      setRepresentatives([]);
      return;
    }

    const res = await fetch(`${API_BASE}/users`, { headers });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || "Failed to load users");
      return;
    }
    setRepresentatives(data.filter((user) => user.role === "Representative"));
  };

  const loadDraftVisits = async () => {
    if (!canManageBusinesses || !isB2BPlatform) {
      setDraftVisits([]);
      return;
    }

    const res = await fetch(`${API_BASE}/dashboard-visits/drafts`, { headers });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || "Failed to load draft visits");
      return;
    }
    setDraftVisits(data);
  };

  const handleCreatePlannedVisit = async () => {
    setError("");
    setMessage("");

    if (!plannedForm.business_id || !plannedForm.representative_id || !plannedForm.visit_date) {
      setError("Business, representative, and date are required.");
      return;
    }

    const payload = {
      business_id: Number(plannedForm.business_id),
      representative_id: Number(plannedForm.representative_id),
      visit_date: plannedForm.visit_date,
      visit_type: "Planned",
      survey_type: "B2B",
      meeting_attendees: []
    };

    const res = await fetch(`${API_BASE}/dashboard-visits`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || "Failed to create planned visit");
      return;
    }

    setMessage("Planned visit created.");
    setPlannedForm({
      business_id: "",
      representative_id: "",
      visit_date: ""
    });
    setPlannedBusinessQuery("");
    setPlannedRepresentativeQuery("");
    await loadDraftVisits();
  };

  const handleDeletePlannedVisit = async () => {
    if (!plannedEditForm.visit_id) {
      setError("Select a planned visit to delete.");
      return;
    }

    if (!window.confirm("Delete this planned (Draft) visit? This cannot be undone.")) {
      return;
    }

    setError("");
    setMessage("");

    try {
      const res = await fetch(`${API_BASE}/dashboard-visits/${plannedEditForm.visit_id}`, {
        method: "DELETE",
        headers
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || "Failed to delete planned visit");
        return;
      }

      setMessage("Planned visit deleted.");
      setSelectedDraft(null);
      setPlannedEditForm({
        visit_id: "",
        business_name: "",
        representative_id: "",
        visit_date: ""
      });
      await loadDraftVisits();
    } catch {
      setError("Failed to delete planned visit");
    }
  };

  const handleSelectDraft = (visit) => {
    const resolvedVisitId = visit.visit_id ?? visit.id;
    setSelectedDraft(visit);
    setPlannedEditForm({
      visit_id: resolvedVisitId,
      business_name: visit.business_name || "",
      representative_id: visit.representative_id ? String(visit.representative_id) : "",
      visit_date: visit.visit_date || ""
    });
  };

  const handleUpdatePlannedVisit = async () => {
    if (!plannedEditForm.visit_id) {
      setError("Select a planned visit to edit.");
      return;
    }

    setError("");
    setMessage("");

    const payload = {
      representative_id: plannedEditForm.representative_id
        ? Number(plannedEditForm.representative_id)
        : null,
      visit_date: plannedEditForm.visit_date || null
    };

    const res = await fetch(`${API_BASE}/dashboard-visits/${plannedEditForm.visit_id}/draft`, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || "Failed to update planned visit");
      return;
    }

    setMessage("Planned visit updated.");
    setSelectedDraft(null);
    setPlannedEditForm({
      visit_id: "",
      business_name: "",
      representative_id: "",
      visit_date: ""
    });
    await loadDraftVisits();
  };

  const handleCreateBusiness = async () => {
    setError("");
    setMessage("");

    if (!businessForm.name.trim()) {
      setError("Business name is required.");
      return;
    }

    const payload = {
      name: businessForm.name.trim(),
      location: businessForm.location.trim() || null,
      priority_level: businessForm.priority_level,
      active: businessForm.active,
      account_executive_id: businessForm.account_executive_id
        ? Number(businessForm.account_executive_id)
        : null
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

    setBusinessForm({
      name: "",
      location: "",
      priority_level: "medium",
      active: true,
      account_executive_id: ""
    });
    setAccountExecutiveQuery("");
    setMessage(`Business created: ${data.name}`);
    await loadBusinesses();
  };

  const handleEditBusiness = (business) => {
    setSelectedBusiness(business);
    setBusinessForm({
      name: business.name,
      location: business.location || "",
      priority_level: business.priority_level || "medium",
      active: business.active,
      account_executive_id: business.account_executive_id
        ? String(business.account_executive_id)
        : ""
    });
    setAccountExecutiveQuery(
      business.account_executive_id
        ? accountExecutiveMap[business.account_executive_id] || ""
        : ""
    );
  };

  const handleUpdateBusiness = async () => {
    if (!selectedBusiness) return;

    setError("");
    setMessage("");

    const payload = {
      name: businessForm.name.trim(),
      location: businessForm.location.trim() || null,
      priority_level: businessForm.priority_level,
      active: businessForm.active,
      account_executive_id: businessForm.account_executive_id
        ? Number(businessForm.account_executive_id)
        : null
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
    setBusinessForm({
      name: "",
      location: "",
      priority_level: "medium",
      active: true,
      account_executive_id: ""
    });
    setAccountExecutiveQuery("");
    await loadBusinesses();
  };

  const handleRetireBusiness = async (business) => {
    setError("");
    setMessage("");

    const res = await fetch(`${API_BASE}/api/b2b/businesses/${business.id}`, {
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
    try {
      const summaryRes = await fetch(`${API_BASE}/api/b2b/businesses/${business.id}/deletion-summary`, {
        headers
      });

      if (!summaryRes.ok) {
        const errorData = await summaryRes.json().catch(() => ({}));
        setError(errorData.detail || "Failed to get deletion summary");
        return;
      }

      const summary = await summaryRes.json();

      const confirmMessage = summary.related_records.total_visits > 0
        ? `Are you sure you want to delete "${business.name}"? This will permanently delete:\n\n` +
          `• The business record\n` +
          `• ${summary.related_records.total_visits} visit(s) and all their responses\n\n` +
          `This action cannot be undone.`
        : `Are you sure you want to delete "${business.name}"? This action cannot be undone.`;

      if (!window.confirm(confirmMessage)) {
        return;
      }

      const res = await fetch(`${API_BASE}/api/b2b/businesses/${business.id}`, {
        method: "DELETE",
        headers
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        setError(errorData.detail || "Failed to delete business");
        return;
      }

      setMessage(`Business deleted: ${business.name}`);
      await loadBusinesses();
    } catch {
      setError("Unable to connect to backend. Check API server and CORS settings.");
    }
  };

  const loadSurveyResults = async () => {
    setError("");
    setMessage("");

    let url = `${API_BASE}/dashboard-visits/all`;
    const params = new URLSearchParams();
    
    // Apply filters
    if (surveyFilter !== "all") {
      params.append("status", surveyFilter);
    }
    if (selectedSurveyBusiness) {
      params.append("business_name", selectedSurveyBusiness);
    }
    if (surveyDateFilter) {
      params.append("date_from", surveyDateFilter);
      params.append("date_to", surveyDateFilter);
    }

    if (activePlatform) {
      params.append("survey_type", activePlatform);
    }
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    try {
      const res = await fetch(url, { headers });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Failed to load survey results");
        return;
      }
      setSurveyResults(data);
    } catch (e) {
      setError("Failed to load survey results");
    }
  };

  const loadSurveyVisitDetails = async (visitId) => {
    setError("");
    setMessage("");

    try {
      const res = await fetch(`${API_BASE}/dashboard-visits/${visitId}`, { headers });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Failed to load visit details");
        return;
      }
      setSelectedSurveyVisit(data);
    } catch (e) {
      setError("Failed to load visit details");
    }
  };

  // Helper functions for business dropdown
  const filteredBusinesses = useMemo(() => {
    if (!businessSearchQuery) return businesses;
    return businesses.filter(business =>
      business.name.toLowerCase().includes(businessSearchQuery.toLowerCase())
    );
  }, [businesses, businessSearchQuery]);

  const handleBusinessSelect = (business) => {
    setSelectedSurveyBusiness(business.name);
    setBusinessSearchQuery(business.name);
    setShowBusinessDropdown(false);
  };

  const clearBusinessFilter = () => {
    setSelectedSurveyBusiness("");
    setBusinessSearchQuery("");
    setShowBusinessDropdown(false);
  };

  const handleBusinessSearchChange = (value) => {
    setBusinessSearchQuery(value);
    setShowBusinessDropdown(true);
  };

  const toggleAnalyticsBusiness = (businessId) => {
    setSelectedAnalyticsBusinessIds((prev) => {
      if (prev.includes(businessId)) {
        return prev.filter((id) => id !== businessId);
      }
      return [...prev, businessId];
    });
  };

  const getToneClass = (type, value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return "kpi-neutral";
    }
    const numeric = Number(value);
    if (type === "csat" || type === "relationship") {
      if (numeric >= 75) return "kpi-good";
      if (numeric >= 50) return "kpi-warn";
      return "kpi-bad";
    }
    if (type === "nps") {
      if (numeric >= 30) return "kpi-good";
      if (numeric >= 0) return "kpi-warn";
      return "kpi-bad";
    }
    if (type === "exposure") {
      if (numeric <= 30) return "kpi-good";
      if (numeric <= 60) return "kpi-warn";
      return "kpi-bad";
    }
    return "kpi-neutral";
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showBusinessDropdown && !event.target.closest('.business-dropdown')) {
        setShowBusinessDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showBusinessDropdown]);

  useEffect(() => {
    if (!accessToken) return;
    loadSurveyTypes();
    if (activePlatform && activeView === "analytics") {
      loadMetrics();
      loadBusinesses();
    }
    if (activePlatform && activeView === "review") {
      loadPending();
    }
    if (activePlatform && activeView === "businesses") {
      loadBusinesses();
      loadAccountExecutives();
    }
    if (activePlatform && activeView === "survey-results") {
      loadSurveyResults();
    }
    if (activePlatform && activeView === "visits") {
      loadBusinesses();
      loadRepresentatives();
      loadDraftVisits();
    }
    if (activePlatform && activeView === "locations" && isMysteryShopperPlatform) {
      loadMysteryLocations();
      loadMysteryPurposes();
    }
  }, [
    accessToken,
    activeView,
    surveyFilter,
    selectedSurveyBusiness,
    surveyDateFilter,
    activePlatform,
    analyticsDateFrom,
    analyticsDateTo,
    isMysteryShopperPlatform,
  ]);

  useEffect(() => {
    if (!activePlatform || activeView !== "analytics" || !isB2BPlatform) {
      setTargetedAnalytics(null);
      return;
    }
    if (selectedAnalyticsBusinessIds.length === 0) {
      setTargetedAnalytics(null);
      return;
    }
    loadTargetedAnalytics();
  }, [
    activePlatform,
    activeView,
    isB2BPlatform,
    selectedAnalyticsBusinessIds.join(","),
    analyticsDateFrom,
    analyticsDateTo,
  ]);

  useEffect(() => {
    if (activeView !== "analytics" || !canViewMetrics || !activePlatform) {
      setQuestionAverages([]);
      setSelectedQuestionTrend(null);
      return;
    }
    loadQuestionAverages();
  }, [
    activeView,
    canViewMetrics,
    activePlatform,
    analyticsDateFrom,
    analyticsDateTo,
    selectedAnalyticsBusinessIds.join(","),
  ]);

  useEffect(() => {
    if (!selectedQuestionTrend?.question?.id) return;
    loadQuestionTrend(selectedQuestionTrend.question.id);
  }, [questionTrendInterval]);

  const handleSelectPlatform = (platformName) => {
    setActivePlatform(platformName);
    setActiveView("analytics");
    setSelectedAnalyticsBusinessIds([]);
    setSelectedSurveyBusiness("");
    setBusinessSearchQuery("");
    setError("");
    setMessage("");
  };

  const handleLogout = () => {
    instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin });
  };

  if (!msalReady || !isAuthenticated || !accessToken) {
    return (
      <div className="dashboard-shell">
        <div className="empty-state-card" role="status" aria-live="polite" aria-atomic="true">
          <h2>Signing you in...</h2>
          <p>Please wait while Microsoft Entra authentication completes.</p>
        </div>
      </div>
    );
  }

  if (!hasDashboardAccess) {
    return (
      <div className="dashboard-shell">
        <div className="empty-state-card">
          <h2>Access denied</h2>
          <p>Your Entra role does not grant dashboard access.</p>
        </div>
      </div>
    );
  }

  if (!activePlatform) {
    return (
      <motion.main id="main-content" className="page platform-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <Toaster position="top-right" richColors closeButton />
        <header className="header">
          <div>
            <p className="eyebrow">Governance Dashboard</p>
            <h1>Select a Platform</h1>
          </div>
        </header>

        <section className="panel">
          <div className="panel-header">
            <h2>Platforms</h2>
            <Button type="button" variant="outline" size="sm" onClick={loadSurveyTypes}>
              Refresh
            </Button>
          </div>

          <div className="platform-layout">
            <div className="platform-list" role="listbox" aria-label="Platform selection">
              {availablePlatforms.map((type) => {
                const meta = platformGuide[type.name] || {
                  status: "Planned",
                  summary: type.description || "Platform modules and analytics will be configured.",
                  sections: ["Survey Results", "Analytics", "Quality Review", "Operational Metrics"]
                };
                const isPreview = previewPlatform === type.name;
                return (
                  <Button
                    key={type.name}
                    type="button"
                    className={`platform-option !grid !justify-items-start !content-start !text-left ${isPreview ? "active" : ""}`}
                    role="option"
                    aria-selected={isPreview}
                    onMouseEnter={() => setPreviewPlatform(type.name)}
                    onFocus={() => setPreviewPlatform(type.name)}
                    onClick={() => handleSelectPlatform(type.name)}
                    variant="outline"
                    size="auto"
                  >
                    <div className="platform-option-head">
                      <div className="card-title">{type.name}</div>
                      <Badge variant={meta.status === "Live" ? "success" : "warning"}>{meta.status}</Badge>
                    </div>
                    <div className="platform-summary">{meta.summary}</div>
                    <ul className="platform-detail-list" aria-hidden="true">
                      {meta.sections.slice(0, 2).map((section) => (
                        <li key={section} className="platform-detail-item">{section}</li>
                      ))}
                    </ul>
                  </Button>
                );
              })}
            </div>

            <aside className="platform-preview" aria-live="polite">
              <div className="platform-preview-head">
                <h3>{previewPlatform}</h3>
                <Badge variant={previewMeta.status === "Live" ? "success" : "warning"}>{previewMeta.status}</Badge>
              </div>
              <p className="platform-summary">{previewMeta.summary}</p>
              <ul className="platform-detail-list">
                {previewMeta.sections.map((section) => (
                  <li key={section} className="platform-detail-item">{section}</li>
                ))}
              </ul>
              <Button type="button" className="platform-open-btn" onClick={() => handleSelectPlatform(previewPlatform)}>
                Open {previewPlatform}
              </Button>
            </aside>
          </div>
        </section>
      </motion.main>
    );
  }

  return (
    <motion.main id="main-content" className={`page ${isOperationalPlatform ? "operational-layout" : ""}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Toaster position="top-right" richColors closeButton />
      <header className="header">
        <div>
          <p className="eyebrow">Governance Dashboard</p>
          <h1>{activePlatform} Dashboard</h1>
        </div>
        <div className="flex gap-3 items-end">
          <Button type="button" variant="outline" size="sm" onClick={() => setActivePlatform(null)}>
            Change Platform
          </Button>
          <Button type="button">Export Snapshot</Button>
        </div>
      </header>

      {!isOperationalPlatform ? (
        <section className="panel">
          <div className="panel-header">
            <h2>{activePlatform}</h2>
          </div>

          <p className="caption">
            This platform dashboard is intentionally separate from B2B. The UI and data model will
            be implemented when the {activePlatform} survey frontend and schema are finalized.
          </p>

          <div className="grid">
            <div className="card">
              <div className="card-title">Planned Modules</div>
              <div className="caption">The following sections will be built for this platform:</div>
              <ul>
                <li>Field team members / contractors management</li>
                <li>Location/site management</li>
                <li>Platform-specific survey results</li>
                <li>Platform-specific analytics</li>
              </ul>
            </div>
            <div className="card">
              <div className="card-title">Planned Data Capture</div>
              <div className="caption">Example data that will be collected and reported:</div>
              <ul>
                <li>Location / site</li>
                <li>B2B vs B2C installation type</li>
                <li>Customer name</li>
                <li>Assessment date / timestamps</li>
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      {isOperationalPlatform ? (
      <>
      <nav className="top-nav" aria-label="Primary">
        <Tabs value={activeView} onValueChange={setActiveView} className="nav-tabs">
          <TabsList role="tablist" aria-label="Dashboard sections">
            <TabsTrigger value="analytics" role="tab" aria-selected={activeView === "analytics"} disabled={!canViewMetrics}><span className="nav-tab-inner"><BarChart3 className="icon icon--sm" aria-hidden="true" /><span className="nav-label">Analytics</span></span></TabsTrigger>
            <TabsTrigger value="review" role="tab" aria-selected={activeView === "review"} disabled={!canReview}><span className="nav-tab-inner"><ClipboardCheck className="icon icon--sm" aria-hidden="true" /><span className="nav-label">Review Queue</span></span></TabsTrigger>
            {isB2BPlatform ? (
              <>
                <TabsTrigger value="businesses" role="tab" aria-selected={activeView === "businesses"} disabled={!canManageBusinesses}><span className="nav-tab-inner"><Building2 className="icon icon--sm" aria-hidden="true" /><span className="nav-label">Businesses</span></span></TabsTrigger>
                <TabsTrigger value="visits" role="tab" aria-selected={activeView === "visits"} disabled={!canManageBusinesses}><span className="nav-tab-inner"><CalendarDays className="icon icon--sm" aria-hidden="true" /><span className="nav-label">Visits</span></span></TabsTrigger>
              </>
            ) : null}
            {isMysteryShopperPlatform ? (
              <TabsTrigger value="locations" role="tab" aria-selected={activeView === "locations"} disabled={!canManageBusinesses}><span className="nav-tab-inner"><MapPin className="icon icon--sm" aria-hidden="true" /><span className="nav-label">Locations & Purposes</span></span></TabsTrigger>
            ) : null}
            <TabsTrigger value="survey-results" role="tab" aria-selected={activeView === "survey-results"} disabled={!canViewMetrics}><span className="nav-tab-inner"><FileText className="icon icon--sm" aria-hidden="true" /><span className="nav-label">Survey Results</span></span></TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="nav-account">
          <span className="caption">Signed in user</span>
          <div className="account-select">
            <label>
              Name
              <Input value={userName || "-"} disabled />
            </label>
            <label>
              Email
              <Input value={userEmail || "-"} disabled />
            </label>
            <Button type="button" variant="outline" size="sm" onClick={handleLogout} aria-label="Log out"><span className="nav-tab-inner"><LogOut className="icon icon--sm" aria-hidden="true" />Logout</span></Button>
          </div>
        </div>
      </nav>

      <section className="subhead">
        <h3>
          {activeView === "analytics"
            ? "Analytics Overview"
            : activeView === "review"
            ? "Review Queue"
            : activeView === "businesses"
            ? "Business Management"
            : "Planned Visits"}
        </h3>
        <p>
          {activeView === "analytics"
            ? "KPIs from approved visits and category trends."
            : activeView === "review"
            ? "Approve, reject, or request changes for submitted visits."
            : activeView === "businesses"
            ? "Create, update, and retire businesses with priorities."
            : "Assign draft visits for representatives to complete."}
        </p>
      </section>

      <AnimatePresence>
        {error ? (
          <motion.p className="notice" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            {error}
          </motion.p>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {message ? (
          <motion.p className="notice success" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            {message}
          </motion.p>
        ) : null}
      </AnimatePresence>

      </>
      ) : null}

      {activeView === "businesses" && canManageBusinesses && isB2BPlatform ? (
        <section className="panel">
          <div className="panel-header">
            <h2>{selectedBusiness ? "Edit Business" : "Create Business"}</h2>
            {selectedBusiness ? (
              <Button
                type="button"
                onClick={() => {
                  setSelectedBusiness(null);
                  setBusinessForm({
                    name: "",
                    location: "",
                    priority_level: "medium",
                    active: true,
                    account_executive_id: ""
                  });
                }}
                variant="outline"
                size="sm"
              >
                Cancel Edit
              </Button>
            ) : null}
          </div>
          <div className="grid">
            <label>
              Business Name
              <Input
                value={businessForm.name}
                onChange={(event) =>
                  setBusinessForm((prev) => ({ ...prev, name: event.target.value }))
                }
              />
            </label>
            <label>
              Location
              <Input
                value={businessForm.location}
                onChange={(event) =>
                  setBusinessForm((prev) => ({ ...prev, location: event.target.value }))
                }
              />
            </label>
            <label>
              Priority
              <Select
                value={businessForm.priority_level}
                onChange={(event) =>
                  setBusinessForm((prev) => ({ ...prev, priority_level: event.target.value }))
                }
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </Select>
            </label>
            <label>
              Account Executive
              <Input
                list="account-executives"
                value={accountExecutiveQuery}
                onChange={(event) => {
                  const value = event.target.value;
                  setAccountExecutiveQuery(value);
                  const match = accountExecutives.find(
                    (exec) => exec.name.toLowerCase() === value.toLowerCase()
                  );
                  setBusinessForm((prev) => ({
                    ...prev,
                    account_executive_id: match ? String(match.id) : ""
                  }));
                }}
                placeholder="Start typing an executive"
              />
              <datalist id="account-executives">
                {accountExecutives.map((executive) => (
                  <option key={executive.id} value={executive.name} />
                ))}
              </datalist>
              <span className="caption">Select an executive from the list.</span>
            </label>
            <label>
              Status
              <Select
                value={businessForm.active ? "active" : "inactive"}
                onChange={(event) =>
                  setBusinessForm((prev) => ({ ...prev, active: event.target.value === "active" }))
                }
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </label>
          </div>
          <div className="actions form-cta">
            <Button
              type="button"
              onClick={selectedBusiness ? handleUpdateBusiness : handleCreateBusiness}
            >
              {selectedBusiness ? "Update Business" : "Save Business"}
            </Button>
          </div>
          <p className="caption">Platform admins can create businesses and set priority.</p>
        </section>
      ) : null}

      {isB2BPlatform && activeView === "visits" && canManageBusinesses ? (
        <>
          <section className="panel">
            <div className="panel-header">
              <h2>Create Planned Visit</h2>
              <Button type="button" variant="outline" size="sm" onClick={loadDraftVisits}>
                Refresh
              </Button>
            </div>
            <div className="grid">
              <label>
                Survey Type
                <Select
                  value="B2B"
                  disabled
                >
                  <option value="B2B">B2B</option>
                </Select>
              </label>
              <label>
                Business
                <Input
                  list="planned-businesses"
                  value={plannedBusinessQuery}
                  onChange={(event) => {
                    const value = event.target.value;
                    setPlannedBusinessQuery(value);
                    const match = businesses.find(
                      (business) => business.name.toLowerCase() === value.toLowerCase()
                    );
                    setPlannedForm((prev) => ({
                      ...prev,
                      business_id: match ? String(match.id) : ""
                    }));
                  }}
                  placeholder="Start typing a business name"
                />
                <datalist id="planned-businesses">
                  {businesses.map((business) => (
                    <option key={business.id} value={business.name} />
                  ))}
                </datalist>
                <span className="caption">Select a business from the list.</span>
              </label>
              <label>
                Representative
                <Input
                  list="planned-representatives"
                  value={plannedRepresentativeQuery}
                  onChange={(event) => {
                    const value = event.target.value;
                    setPlannedRepresentativeQuery(value);
                    const match = representatives.find(
                      (rep) => rep.name.toLowerCase() === value.toLowerCase()
                    );
                    setPlannedForm((prev) => ({
                      ...prev,
                      representative_id: match ? String(match.id) : ""
                    }));
                  }}
                  placeholder="Start typing a representative"
                />
                <datalist id="planned-representatives">
                  {representatives.map((rep) => (
                    <option key={rep.id} value={rep.name} />
                  ))}
                </datalist>
                <span className="caption">Select a representative from the list.</span>
              </label>
              <label>
                Visit Date
                <Input
                  type="date"
                  value={plannedForm.visit_date}
                  onChange={(event) =>
                    setPlannedForm((prev) => ({ ...prev, visit_date: event.target.value }))
                  }
                />
              </label>
            </div>
            <div className="actions form-cta">
              <Button type="button" onClick={handleCreatePlannedVisit}>
                Create Draft Visit
              </Button>
            </div>
            <p className="caption">Draft visits appear in the survey app for the assigned rep.</p>
          </section>

          <section className="table">
            <div className="panel-header">
              <h2>Planned Visits</h2>
              <Button type="button" variant="outline" size="sm" onClick={loadDraftVisits}>
                Refresh
              </Button>
            </div>
            <div className="table-row header-row">
              <span>Business</span>
              <span>Representative</span>
              <span>Date</span>
            </div>
            {draftVisits.length === 0 ? (
              <p className="caption">No draft visits yet.</p>
            ) : (
              draftVisits.map((visit) => (
                <Button
                  type="button"
                  key={visit.visit_id ?? visit.id}
                  className={`table-row selectable ${
                    (selectedDraft?.visit_id ?? selectedDraft?.id) === (visit.visit_id ?? visit.id) ? "active" : ""
                  }`}
                  onClick={() => handleSelectDraft(visit)}
                  variant="ghost"
                >
                  <span>
                    {visit.business_name} ({visit.business_priority})
                  </span>
                  <span>{visit.representative_name || representativeMap[visit.representative_id] || visit.representative_id}</span>
                  <span>{visit.visit_date}</span>
                </Button>
              ))
            )}
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2>Edit Planned Visit</h2>
              {selectedDraft ? (
                <Button
                  type="button"
                  onClick={() => {
                    setSelectedDraft(null);
                    setPlannedEditForm({
                      visit_id: "",
                      business_name: "",
                      representative_id: "",
                      visit_date: ""
                    });
                  }}
                  variant="outline"
                  size="sm"
                >
                  Clear
                </Button>
              ) : null}
            </div>
            <div className="grid">
              <label>
                Business
                <Input value={plannedEditForm.business_name} disabled />
              </label>
              <label>
                Representative
                <Select
                  value={plannedEditForm.representative_id}
                  onChange={(event) =>
                    setPlannedEditForm((prev) => ({
                      ...prev,
                      representative_id: event.target.value
                    }))
                  }
                >
                  <option value="">Select representative</option>
                  {representatives.map((rep) => (
                    <option key={rep.id} value={rep.id}>
                      {rep.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label>
                Visit Date
                <Input
                  type="date"
                  value={plannedEditForm.visit_date}
                  onChange={(event) =>
                    setPlannedEditForm((prev) => ({
                      ...prev,
                      visit_date: event.target.value
                    }))
                  }
                />
              </label>
            </div>
            <div className="actions form-cta">
              <Button type="button" onClick={handleUpdatePlannedVisit}>
                Update Planned Visit
              </Button>
              <Button type="button" variant="destructive" onClick={handleDeletePlannedVisit}>
                Delete Planned Visit
              </Button>
            </div>
            <p className="caption">Business is locked for planned visits.</p>
          </section>
        </>
      ) : null}

      {activeView === "businesses" && canManageBusinesses && isB2BPlatform ? (
        <section className="table business-directory">
          <div className="panel-header section-toolbar">
            <h2>Business Directory</h2>
            <Button type="button" variant="outline" size="sm" onClick={loadBusinesses}>
              Refresh
            </Button>
          </div>
          {businesses.length === 0 ? (
            <p className="caption">No businesses found.</p>
          ) : (
            <div className="data-table-shell">
              <Table className="data-table" aria-label="Business directory table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Business</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {businesses.map((business) => (
                    <TableRow
                      key={business.id}
                      className={!business.location || !business.account_executive_id ? "needs-attention" : ""}
                    >
                      <TableCell>
                        <div className="cell-stack">
                          <strong>{business.name}</strong>
                          <span className="caption">{business.location || "No location"}</span>
                          <span className="caption">
                            Account Executive: {accountExecutiveMap[business.account_executive_id] || "Unassigned"}
                          </span>
                          {!business.location || !business.account_executive_id ? (
                            <Badge variant="warning">Needs details</Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`priority-tag priority-${business.priority_level || "medium"}`}>
                          {(business.priority_level || "medium").replace(/^\w/, (m) => m.toUpperCase())}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`status-chip ${business.active ? "active" : "retired"}`}>
                          {business.active ? "Active" : "Retired"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="table-actions action-toolbar">
                          <Button type="button" variant="outline" size="sm" className="table-action-btn" onClick={() => handleEditBusiness(business)}>
                            Edit
                          </Button>
                          {business.active ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="table-action-btn retire-action"
                              onClick={() => handleRetireBusiness(business)}
                            >
                              Retire
                            </Button>
                          ) : null}
                          {role === "Admin" ? (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="table-action-btn delete-action"
                              onClick={() => handleDeleteBusiness(business)}
                            >
                              Delete
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      ) : null}

      {activeView === "analytics" && canViewMetrics ? (
        <div className="analytics-view">
          <section className="analytics-top-grid">
            <div className="panel analytics-date-panel">
              <div className="panel-header">
                <h2>Analytics Date Filter</h2>
                <Button
                  type="button"
                  onClick={() => {
                    setAnalyticsDateFrom("");
                    setAnalyticsDateTo("");
                  }}
                  disabled={!analyticsDateFrom && !analyticsDateTo}
                  variant="outline"
                  size="sm"
                >
                  Clear Dates
                </Button>
              </div>
              <div className="analytics-date-grid">
                <label>
                  From Date
                  <Input
                    type="date"
                    value={analyticsDateFrom}
                    onChange={(event) => setAnalyticsDateFrom(event.target.value)}
                  />
                </label>
                <label>
                  To Date
                  <Input
                    type="date"
                    value={analyticsDateTo}
                    onChange={(event) => setAnalyticsDateTo(event.target.value)}
                  />
                </label>
              </div>
              <p className="caption">Set a single day by choosing the same from/to date, or choose a date range.</p>
            </div>

            <article className="panel response-overview-card">
              <h2>Response Overview</h2>
              <div className="response-overview-grid">
                <div className="overview-stat-card total">
                  <h3>Total Visits</h3>
                  <p className="metric">{analytics?.visits?.total ?? "--"}</p>
                </div>
                <div className="overview-stat-card completed">
                  <h3>Completed Visits</h3>
                  <p className="metric">{analytics?.visits?.completed ?? "--"}</p>
                </div>
                <div className="overview-stat-card pending">
                  <h3>Pending Visits</h3>
                  <p className="metric">{analytics?.visits?.pending ?? "--"}</p>
                </div>
                <div className="overview-stat-card draft">
                  <h3>Draft Visits</h3>
                  <p className="metric">{analytics?.visits?.draft ?? "--"}</p>
                </div>
              </div>
            </article>
          </section>

          {isB2BPlatform ? (
          <section className="panel targeted-panel">
            <div className="panel-header">
              <h2>Targeted Business Analytics</h2>
              <Button type="button" variant="outline" size="sm" onClick={loadTargetedAnalytics} disabled={selectedAnalyticsBusinessIds.length === 0}>
                Recalculate
              </Button>
            </div>
            <p className="caption">Select businesses to calculate focused KPIs for customer targeting.</p>
            <div className="targeted-controls">
              <Input
                type="text"
                placeholder="Search businesses by name or location"
                value={analyticsBusinessSearch}
                onChange={(event) => setAnalyticsBusinessSearch(event.target.value)}
              />
              <div className="targeted-toolbar">
                <span className="caption">Selected: {selectedAnalyticsBusinessIds.length}</span>
                <Button
                  type="button"
                  onClick={() => setSelectedAnalyticsBusinessIds([])}
                  disabled={selectedAnalyticsBusinessIds.length === 0}
                  variant="outline"
                  size="sm"
                >
                  Clear Selection
                </Button>
              </div>
              <div className="targeted-business-list">
                {filteredAnalyticsBusinesses.slice(0, 40).map((business) => (
                  <label key={business.id} className="targeted-business-item">
                    <Checkbox
                      checked={selectedAnalyticsBusinessIds.includes(business.id)}
                      onChange={() => toggleAnalyticsBusiness(business.id)}
                    />
                    <span>{business.name}</span>
                    <small>{business.location || "No location"}</small>
                  </label>
                ))}
              </div>
              {selectedAnalyticsBusinessIds.length > 0 ? (
                <div className="targeted-selected-chips">
                  {businesses
                    .filter((business) => selectedAnalyticsBusinessIds.includes(business.id))
                    .map((business) => (
                      <Button
                        key={business.id}
                        type="button"
                        className="targeted-chip"
                        onClick={() => toggleAnalyticsBusiness(business.id)}
                        variant="ghost"
                        size="sm"
                      >
                        {business.name}
                      </Button>
                    ))}
                </div>
              ) : null}
            </div>
            {targetedAnalytics ? (
              <div className="targeted-kpis">
                <div className={getToneClass("csat", targetedAnalytics.customer_satisfaction?.csat_score)}>
                  <strong>CSAT</strong>
                  <span>{targetedAnalytics.customer_satisfaction?.csat_score?.toFixed?.(1) ?? "0.0"}%</span>
                </div>
                <div className={getToneClass("nps", targetedAnalytics.nps?.nps)}>
                  <strong>NPS</strong>
                  <span>{targetedAnalytics.nps?.nps ?? "--"}</span>
                </div>
                <div className={getToneClass("relationship", targetedAnalytics.relationship_score?.score)}>
                  <strong>Relationship</strong>
                  <span>{targetedAnalytics.relationship_score?.score?.toFixed?.(1) ?? "0.0"}</span>
                </div>
                <div className={getToneClass("exposure", targetedAnalytics.competitive_exposure?.exposure_rate)}>
                  <strong>Competitor Exposure</strong>
                  <span>{targetedAnalytics.competitive_exposure?.exposure_rate?.toFixed?.(1) ?? "0.0"}%</span>
                </div>
              </div>
            ) : (
              <p className="caption">Select one or more businesses to see targeted analytics.</p>
            )}
          </section>
          ) : null}
          <section className="panel question-drilldown-panel">
            <div className="panel-header">
              <h2>Per-Question Drilldown</h2>
              <Button type="button" variant="outline" size="sm" onClick={loadQuestionAverages}>
                Refresh
              </Button>
            </div>
            <p className="caption">
              Average score per question based on current filters
              {isB2BPlatform ? " (date range and selected businesses)." : " (date range and survey scope)."}
            </p>
            <div className="question-drilldown-controls">
              <label>
                Search question
                <Input
                  type="text"
                  placeholder="Search by question number, text, or category"
                  value={questionSearch}
                  onChange={(event) => setQuestionSearch(event.target.value)}
                />
              </label>
              <div>
                <div className="caption">Category</div>
                <div className="selection-group" role="tablist" aria-label="Question category filter">
                  {questionCategories.map((category) => {
                    const isActive = questionCategoryFilter === category;
                    return (
                      <Button
                        key={category}
                        type="button"
                        className={`selection-pill ${isActive ? "active" : ""}`}
                        onClick={() => setQuestionCategoryFilter(category)}
                        variant={isActive ? "default" : "outline"}
                        size="sm"
                      >
                        {category === "all" ? "All categories" : category}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="question-drilldown-table-wrap">
              <table className="question-drilldown-table">
                <thead>
                  <tr>
                    <th>Q#</th>
                    <th>Category</th>
                    <th>Question</th>
                    <th>Avg Score</th>
                    <th>Responses</th>
                    <th>Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {questionAnalyticsLoading ? (
                    <tr>
                      <td colSpan={6}>Loading per-question analytics...</td>
                    </tr>
                  ) : filteredQuestionAverages.length === 0 ? (
                    <tr>
                      <td colSpan={6}>No question analytics match current filters.</td>
                    </tr>
                  ) : (
                    filteredQuestionAverages.map((item) => (
                      <tr key={item.question_id} className={selectedQuestionTrend?.question?.id === item.question_id ? "active-row" : ""}>
                        <td>{item.question_number}</td>
                        <td>{item.category}</td>
                        <td>{item.question_text}</td>
                        <td>{item.average_score?.toFixed?.(2) ?? "0.00"}</td>
                        <td>{item.response_count}</td>
                        <td>
                          <Button type="button" variant="outline" size="sm" onClick={() => loadQuestionTrend(item.question_id)}>
                            View Trend
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {selectedQuestionTrend ? (
              <div className="question-trend-panel">
                <div className="panel-header">
                  <h3>
                    Trend: Q{selectedQuestionTrend.question?.id} - {selectedQuestionTrend.question?.question_text}
                  </h3>
                  <div>
                    <div className="caption">Interval</div>
                    <div className="selection-group compact" role="tablist" aria-label="Trend interval">
                      {[
                        { key: "day", label: "Day" },
                        { key: "week", label: "Week" },
                        { key: "month", label: "Month" },
                      ].map((intervalOption) => (
                        <Button
                          key={intervalOption.key}
                          type="button"
                          className={`selection-pill ${questionTrendInterval === intervalOption.key ? "active" : ""}`}
                          onClick={() => setQuestionTrendInterval(intervalOption.key)}
                          variant={questionTrendInterval === intervalOption.key ? "default" : "outline"}
                          size="sm"
                        >
                          {intervalOption.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
                {questionTrendLoading ? (
                  <p className="caption">Loading trend...</p>
                ) : trendChartData.length === 0 ? (
                  <p className="caption">No trend data available for current filters.</p>
                ) : (
                  <div className="trend-line-wrap" role="img" aria-label="Question trend line chart">
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={trendChartData} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 183, 232, 0.24)" />
                        <XAxis dataKey="periodLabel" tick={{ fill: "#bfd0ea", fontSize: 12 }} />
                        <YAxis
                          domain={[0, 10]}
                          tick={{ fill: "#bfd0ea", fontSize: 12 }}
                          tickCount={6}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: 8,
                            border: "1px solid rgba(148, 183, 232, 0.3)",
                            background: "rgba(15, 34, 66, 0.9)",
                            backdropFilter: "blur(6px)",
                            color: "#eaf2ff",
                          }}
                          labelStyle={{ color: "#eaf2ff" }}
                          formatter={(value, name, payload) => {
                            if (name === "averageScore") {
                              return [`${Number(value).toFixed(2)} / 10`, "Average Score"];
                            }
                            return [value, name];
                          }}
                          labelFormatter={(label, payload) => {
                            const rawPeriod = payload?.[0]?.payload?.period;
                            const responses = payload?.[0]?.payload?.responses;
                            return `${rawPeriod || label}${responses !== undefined ? ` • ${responses} responses` : ""}`;
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="averageScore"
                          stroke="#66b0ff"
                          strokeWidth={2.5}
                          dot={{ r: 3, fill: "#99cbff", strokeWidth: 0 }}
                          activeDot={{ r: 5, fill: "#e6f2ff" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            ) : null}
          </section>
          <section className="analytics-main-grid">
            <article>
              <h2 className="heading-with-tip">
                Net Promoter Score
                <span className="info-tip-wrap">
                  <button
                    type="button"
                    className="info-tip"
                    aria-label="NPS info"
                    aria-describedby="tip-nps"
                  >
                    i
                  </button>
                  <span id="tip-nps" role="tooltip" className="info-tip-popover">
                    NPS equals percentage of Promoters (9-10) minus percentage of Detractors (0-6). Passives (7-8) are neutral.
                  </span>
                </span>
              </h2>
              <p className="metric">{analytics?.nps?.nps ?? "--"}</p>
              <p className="caption">
                {analytics?.nps?.total_responses ?? 0} approved responses
              </p>
              <div className="pie-row">
                <div
                  className="pie-chart"
                  style={buildPieStyle([
                    { value: analytics?.nps?.promoters ?? 0, color: "#10b981" },
                    { value: analytics?.nps?.passives ?? 0, color: "#f59e0b" },
                    { value: analytics?.nps?.detractors ?? 0, color: "#ef4444" }
                  ])}
                />
              </div>
              <div className="pie-legend">
                <span><i style={{ background: "#10b981" }} />Promoters</span>
                <span><i style={{ background: "#f59e0b" }} />Passives</span>
                <span><i style={{ background: "#ef4444" }} />Detractors</span>
              </div>
              <div className="nps-breakdown">
                <div className="nps-category promoters">
                  <div className="label">Promoters (9-10)</div>
                  <div className="value">{analytics?.nps?.promoters ?? 0}</div>
                  <div className="percentage">{analytics?.nps?.promoter_percentage ?? 0}%</div>
                </div>
                <div className="nps-category passives">
                  <div className="label">Passives (7-8)</div>
                  <div className="value">{analytics?.nps?.passives ?? 0}</div>
                  <div className="percentage">{analytics?.nps?.passive_percentage ?? 0}%</div>
                </div>
                <div className="nps-category detractors">
                  <div className="label">Detractors (0-6)</div>
                  <div className="value">{analytics?.nps?.detractors ?? 0}</div>
                  <div className="percentage">{analytics?.nps?.detractor_percentage ?? 0}%</div>
                </div>
              </div>
            </article>
            <article>
              <h2 className="heading-with-tip">
                {isMysteryShopperPlatform ? "Overall Experience" : "Customer Satisfaction"}
                <span className="info-tip-wrap">
                  <button
                    type="button"
                    className="info-tip"
                    aria-label="CSAT info"
                    aria-describedby="tip-csat"
                  >
                    i
                  </button>
                  <span id="tip-csat" role="tooltip" className="info-tip-popover">
                    CSAT is the percentage of satisfied responses. The progress bar shows CSAT from 0% to 100% with high-contrast fill.
                  </span>
                </span>
              </h2>
              <p className="metric">
                {isMysteryShopperPlatform
                  ? mysteryAnalyticsSummary.overallExperienceAvg?.toFixed?.(2) ?? "--"
                  : analytics?.customer_satisfaction?.avg_score?.toFixed(1) ?? "--"}
              </p>
              <p className="caption">
                {isMysteryShopperPlatform
                  ? "Weighted average from Mystery Shopper overall experience scoring questions."
                  : `${analytics?.customer_satisfaction?.response_count ?? 0} responses to question 12`}
              </p>
              {isMysteryShopperPlatform ? (
                <div className="satisfaction-breakdown">
                  <div className="satisfaction-category">
                    <span className="label">Service Quality (1-5)</span>
                    <span className="value">{mysteryAnalyticsSummary.qualityAvg?.toFixed?.(2) ?? "--"}</span>
                  </div>
                  <div className="satisfaction-category">
                    <span className="label">NPS Score</span>
                    <span className="value">{analytics?.nps?.nps ?? "--"}</span>
                  </div>
                </div>
              ) : (
              <>
              <div className="csat-score-wrap">
                <div className="csat-score-row">
                  <span className="csat-label">CSAT Score</span>
                  <span className="csat-value">{analytics?.customer_satisfaction?.csat_score?.toFixed(1) ?? "0.0"}%</span>
                </div>
                <div className="csat-meter" aria-label="CSAT score meter">
                <div
                  className="csat-meter-fill"
                  style={{ width: `${Math.max(0, Math.min(100, analytics?.customer_satisfaction?.csat_score ?? 0))}%` }}
                />
              </div>
              </div>
              <div className="satisfaction-breakdown">
                  <div className="satisfaction-category very-dissatisfied">
                    <span className="label">Very Dissatisfied (0-2)</span>
                    <span className="value">{analytics?.customer_satisfaction?.score_distribution?.very_dissatisfied ?? 0}</span>
                  </div>
                  <div className="satisfaction-category dissatisfied">
                    <span className="label">Dissatisfied (3-4)</span>
                    <span className="value">{analytics?.customer_satisfaction?.score_distribution?.dissatisfied ?? 0}</span>
                  </div>
                  <div className="satisfaction-category neutral">
                    <span className="label">Neutral (5-6)</span>
                    <span className="value">{analytics?.customer_satisfaction?.score_distribution?.neutral ?? 0}</span>
                  </div>
                  <div className="satisfaction-category satisfied">
                    <span className="label">Satisfied (7-8)</span>
                    <span className="value">{analytics?.customer_satisfaction?.score_distribution?.satisfied ?? 0}</span>
                  </div>
                  <div className="satisfaction-category very-satisfied">
                    <span className="label">Very Satisfied (9-10)</span>
                    <span className="value">{analytics?.customer_satisfaction?.score_distribution?.very_satisfied ?? 0}</span>
                  </div>
                </div>
              <div className="pie-row">
                <div
                  className="pie-chart"
                  style={buildPieStyle([
                    { value: analytics?.customer_satisfaction?.score_distribution?.very_satisfied ?? 0, color: "#10b981" },
                    { value: analytics?.customer_satisfaction?.score_distribution?.satisfied ?? 0, color: "#34d399" },
                    { value: analytics?.customer_satisfaction?.score_distribution?.neutral ?? 0, color: "#f59e0b" },
                    { value: analytics?.customer_satisfaction?.score_distribution?.dissatisfied ?? 0, color: "#fb7185" },
                    { value: analytics?.customer_satisfaction?.score_distribution?.very_dissatisfied ?? 0, color: "#ef4444" }
                  ])}
                />
              </div>
              <div className="pie-legend">
                <span><i style={{ background: "#10b981" }} />Very Satisfied</span>
                <span><i style={{ background: "#34d399" }} />Satisfied</span>
                <span><i style={{ background: "#f59e0b" }} />Neutral</span>
                  <span><i style={{ background: "#fb7185" }} />Dissatisfied</span>
                  <span><i style={{ background: "#ef4444" }} />Very Dissatisfied</span>
                </div>
              </>
              )}
              </article>
            {isMysteryShopperPlatform ? (
            <article>
              <h2>Operational Efficiency</h2>
              <p className="caption">Distribution from waiting-time and service-completion Mystery Shopper questions.</p>
              <div className="satisfaction-breakdown">
                <div className="satisfaction-category">
                  <span className="label">CSAT Average (Q24+Q25)</span>
                  <span className="value">{analytics?.mystery_shopper?.csat_average?.toFixed?.(2) ?? "--"}</span>
                </div>
                <div className="satisfaction-category">
                  <span className="label">CSAT Responses</span>
                  <span className="value">{analytics?.mystery_shopper?.csat_response_count ?? 0}</span>
                </div>
              </div>
              <div className="satisfaction-breakdown">
                <div className="satisfaction-category">
                  <span className="label">Waiting Time</span>
                  <span className="value">
                    {(analytics?.mystery_shopper?.waiting_time_distribution || [])
                      .map((item) => `${item.label}: ${item.count}`)
                      .join(" | ") || "No data"}
                  </span>
                </div>
                <div className="satisfaction-category">
                  <span className="label">Service Completion</span>
                  <span className="value">
                    {(analytics?.mystery_shopper?.service_completion_distribution || [])
                      .map((item) => `${item.label}: ${item.count}`)
                      .join(" | ") || "No data"}
                  </span>
                </div>
              </div>
              <div className="satisfaction-breakdown">
                <div className="satisfaction-category">
                  <span className="label">Location Breakdown</span>
                  <span className="value">
                    {(analytics?.mystery_shopper?.location_breakdown || [])
                      .slice(0, 4)
                      .map((item) => `${item.location_name}: ${item.visits}`)
                      .join(" | ") || "No data"}
                  </span>
                </div>
                <div className="satisfaction-category">
                  <span className="label">Recent Daily Visits</span>
                  <span className="value">
                    {(analytics?.mystery_shopper?.visit_trend || [])
                      .slice(-4)
                      .map((item) => `${item.visit_date}: ${item.visit_count}`)
                      .join(" | ") || "No data"}
                  </span>
                </div>
              </div>
            </article>
            ) : null}
            {isB2BPlatform ? (
            <>
            <article>
              <h2>Overall Relationship Score</h2>
              <p className="metric">{analytics?.relationship_score?.score?.toFixed?.(1) ?? "--"}</p>
              <p className="caption">Normalized 0-100 from six relationship questions.</p>
              <div className="satisfaction-breakdown">
                <div className="satisfaction-category">
                  <span className="label">Average Score</span>
                  <span className="value">{analytics?.relationship_score?.avg_score?.toFixed?.(2) ?? "0.00"}</span>
                </div>
                <div className="satisfaction-category">
                  <span className="label">Questions Answered</span>
                  <span className="value">{analytics?.relationship_score?.questions_answered ?? 0}</span>
                </div>
              </div>
            </article>
            <article>
              <h2>Competitive Exposure Rate</h2>
              <p className="metric">{analytics?.competitive_exposure?.exposure_rate?.toFixed?.(1) ?? "0.0"}%</p>
              <p className="caption">Accounts using competitor services / total accounts surveyed.</p>
              <div className="satisfaction-breakdown">
                <div className="satisfaction-category">
                  <span className="label">Using Competitors</span>
                  <span className="value">{analytics?.competitive_exposure?.accounts_using_competitors ?? 0}</span>
                </div>
                <div className="satisfaction-category">
                  <span className="label">Total Accounts</span>
                  <span className="value">{analytics?.competitive_exposure?.total_accounts ?? 0}</span>
                </div>
              </div>
            </article>
            </>
            ) : null}
          </section>
        </div>
      ) : null}

      {activeView === "review" && canReview && isOperationalPlatform ? (
        <section className="panel">
          <div className="panel-header">
            <h2>Review Queue</h2>
            <Button type="button" variant="outline" size="sm" onClick={loadPending}>
              Refresh
            </Button>
          </div>
          <div className="queue">
            <div className="queue-list">
              {pendingVisits.length === 0 ? (
                <p className="caption">No pending visits.</p>
              ) : (
                pendingVisits.map((visit) => (
                  <Button
                    key={visit.visit_id}
                    type="button"
                    className={`queue-item ${
                      (selectedVisit?.id === visit.visit_id || selectedVisit?.visit_id === visit.visit_id) ? "active" : ""
                    }`}
                    onClick={() => loadVisitDetail(visit.visit_id)}
                    variant="ghost"
                  >
                    <span>
                      {visit.business_name || "Visit"}
                      {visit.business_priority ? ` · ${visit.business_priority} priority` : ""}
                    </span>
                    <span>{visit.visit_date}</span>
                  </Button>
                ))
              )}
            </div>
            <div className="queue-detail">
              {!selectedVisit ? (
                <p className="caption">Select a visit to review responses.</p>
              ) : (
                <>
                  <div className="visit-summary">
                    <div className="visit-summary-header">
                      <h3>{selectedVisit.business_name}</h3>
                      <div className="visit-meta">
                        {selectedVisit.business_priority && (
                          <span className={`pill priority-${selectedVisit.business_priority}`}>
                            {selectedVisit.business_priority} priority
                          </span>
                        )}
                        <span className="pill outline">{selectedVisit.visit_date}</span>
                      </div>
                    </div>
                    <div className="representative-info">
                      <span className="label">Completed by</span>
                      <span className="representative-name">
                        {selectedVisit.representative_name || `Representative #${selectedVisit.representative_id}`}
                      </span>
                    </div>
                  </div>

                  <div className="responses">
                    {selectedVisit.responses.map((response) => (
                      <div key={response.response_id} className="response-card">
                        <div className="response-header">
                          <div className="question-info">
                            <strong>Q{response.question_number || response.question_id}</strong>
                            <p className="question-text">{response.question_text || "Question text not available"}</p>
                          </div>
                          {response.score !== null && response.score !== undefined ? (
                            <span className="score-badge">Score: {response.score}</span>
                          ) : (
                            <span className="text-badge">Text response</span>
                          )}
                        </div>
                        <p>{response.answer_text || response.verbatim || "No verbatim provided."}</p>
                        {response.actions && response.actions.length > 0 ? (
                          <div className="actions-section">
                            <strong>Actions:</strong>
                            {response.actions.map((action) => (
                              <p key={action.id} className="action-item">
                                {action.action_required} · Owner: {action.action_owner} · Time: {action.action_timeframe}
                                {action.action_support_needed ? ` · Support: ${action.action_support_needed}` : ""}
                              </p>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <label className="full">
                    Review Notes
                    <Textarea
                      value={reviewNote}
                      onChange={(event) => setReviewNote(event.target.value)}
                      placeholder="Add notes, change requests, or approval context."
                    />
                  </label>
                  <div className="actions">
                    <Button
                      type="button"
                      onClick={() => submitReviewAction("needs-changes")}
                      disabled={reviewActionState.loading}
                      variant="outline"
                    >
                      Needs Changes
                    </Button>
                    <Button
                      type="button"
                      onClick={() => submitReviewAction("approve")}
                      disabled={reviewActionState.loading}
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => submitReviewAction("reject")}
                      disabled={reviewActionState.loading}
                    >
                      Reject
                    </Button>
                  </div>
                  {reviewActionState.text ? (
                    <p
                      className={`mt-3 rounded-xl border px-3 py-2 text-sm ${
                        reviewActionState.type === "success"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                          : reviewActionState.type === "error"
                          ? "border-red-300 bg-red-50 text-red-800"
                          : "border-sky-300 bg-sky-50 text-sky-800"
                      }`}
                    >
                      {reviewActionState.text}
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {activeView === "locations" && canManageBusinesses && isMysteryShopperPlatform ? (
        <section className="panel">
          <div className="panel-header section-toolbar">
            <h2>Location and Purpose Management</h2>
            <div className="table-actions action-toolbar">
              <Button type="button" variant="outline" size="sm" className="table-action-btn" onClick={seedMysteryLegacyData} disabled={mysteryLegacySeeding}>
                {mysteryLegacySeeding ? "Seeding..." : "Seed Old Data"}
              </Button>
              <Button type="button" variant="outline" size="sm" className="table-action-btn" onClick={loadMysteryLocations}>
                {mysteryLocationsLoading ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </div>

          <div className="grid">
            <label>
              Add new location
              <Input
                value={newMysteryLocation}
                onChange={(event) => setNewMysteryLocation(event.target.value)}
                placeholder="Enter location name"
              />
            </label>
          </div>
          <div className="actions">
            <Button type="button" onClick={createMysteryLocation}>Add Location</Button>
          </div>

          <div className="data-table-shell" style={{ marginTop: 16 }}>
            <Table className="data-table" aria-label="Mystery shopper locations">
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
                  mysteryLocations.map((location) => (
                    <TableRow key={location.id}>
                      <TableCell>{location.name}</TableCell>
                      <TableCell>
                        <Badge variant={location.active ? "success" : "secondary"}>
                          {location.active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="table-actions action-toolbar">
                          {location.active ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="table-action-btn"
                              onClick={() => deactivateMysteryLocation(location.id)}
                            >
                              Deactivate
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="table-action-btn"
                              onClick={() => reactivateMysteryLocation(location.id)}
                            >
                              Reactivate
                            </Button>
                          )}
                          {role === "Admin" ? (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="table-action-btn delete-action"
                              onClick={() => deleteMysteryLocation(location)}
                            >
                              Delete
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="panel-header section-toolbar" style={{ marginTop: 28 }}>
            <h2>Visit Purpose Options</h2>
            <Button type="button" variant="outline" size="sm" className="table-action-btn" onClick={loadMysteryPurposes}>
              {mysteryPurposesLoading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>

          <div className="grid" style={{ marginTop: 12 }}>
            <label>
              Add new purpose
              <Input
                value={newMysteryPurpose}
                onChange={(event) => setNewMysteryPurpose(event.target.value)}
                placeholder="Enter purpose name"
              />
            </label>
          </div>
          <div className="actions">
            <Button type="button" onClick={createMysteryPurpose}>Add Purpose</Button>
          </div>

          <div className="data-table-shell" style={{ marginTop: 16 }}>
            <Table className="data-table" aria-label="Mystery shopper visit purposes">
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
                  mysteryPurposes.map((purpose) => (
                    <TableRow key={purpose.id}>
                      <TableCell>{purpose.name}</TableCell>
                      <TableCell>
                        <Badge variant={purpose.active ? "success" : "secondary"}>
                          {purpose.active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="table-actions action-toolbar">
                          {purpose.active ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="table-action-btn"
                              onClick={() => deactivateMysteryPurpose(purpose.id)}
                            >
                              Deactivate
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="table-action-btn"
                              onClick={() => reactivateMysteryPurpose(purpose.id)}
                            >
                              Reactivate
                            </Button>
                          )}
                          {role === "Admin" ? (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="table-action-btn delete-action"
                              onClick={() => deleteMysteryPurpose(purpose)}
                            >
                              Delete
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      ) : null}

      {isOperationalPlatform && activeView === "survey-results" && canViewMetrics ? (
        <section className="survey-results">
          <div className="panel-header section-toolbar">
            <h2>Survey Results</h2>
            <Button type="button" variant="outline" size="sm" onClick={loadSurveyResults}>
              Refresh
            </Button>
          </div>
          
          {/* Clean Filter Section */}
          <div className="filters-section">
            <div className="filters-grid">
              {/* Status Filter */}
              <div className="filter-item">
                <label className="filter-label">Status</label>
                <Select
                  value={surveyFilter} 
                  onChange={(e) => setSurveyFilter(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All Status</option>
                  <option value="Draft">In Progress</option>
                  <option value="Pending">Pending Review</option>
                  <option value="Approved">Completed</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Needs Changes">Needs Changes</option>
                </Select>
              </div>

              {isB2BPlatform ? (
                <div className="filter-item business-filter">
                  <label className="filter-label">Business</label>
                  <div className="business-dropdown">
                    <div className="dropdown-input-wrapper">
                      <Input
                        type="text"
                        placeholder="Search and select business..."
                        value={businessSearchQuery}
                        onChange={(e) => handleBusinessSearchChange(e.target.value)}
                        onFocus={() => setShowBusinessDropdown(true)}
                        className="filter-input"
                      />
                      {selectedSurveyBusiness && (
                        <Button
                          type="button"
                          onClick={clearBusinessFilter}
                          className="clear-button"
                          aria-label="Clear business filter"
                          title="Clear business filter"
                          variant="ghost"
                          size="sm"
                        >
                          Clear
                        </Button>
                      )}
                    </div>

                    {showBusinessDropdown && (
                      <div className="dropdown-list">
                        {filteredBusinesses.length === 0 ? (
                          <div className="dropdown-item no-results">
                            No businesses found
                          </div>
                        ) : (
                          filteredBusinesses.map((business) => (
                            <div
                              key={business.id}
                              className={`dropdown-item ${!business.active ? "inactive" : ""}`}
                              onClick={() => handleBusinessSelect(business)}
                            >
                              <div className="business-info">
                                <span className="business-name">{business.name}</span>
                                <span className={`business-status ${business.active ? "active" : "inactive"}`}>
                                  {business.active ? "Active" : "Retired"}
                                </span>
                              </div>
                              {business.location ? (
                                <span className="business-location">{business.location}</span>
                              ) : null}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {/* Date Filter */}
              <div className="filter-item">
                <label className="filter-label">Visit Date</label>
                <Input
                  type="date"
                  value={surveyDateFilter}
                  onChange={(e) => setSurveyDateFilter(e.target.value)}
                  className="filter-input"
                />
              </div>
            </div>

            {/* Active Filters Display */}
            {(surveyFilter !== "all" || (isB2BPlatform && selectedSurveyBusiness) || surveyDateFilter) && (
              <div className="active-filters">
                <span className="active-filters-label">Active filters:</span>
                {surveyFilter !== "all" && (
                  <span className="active-filter-tag">
                    Status: {surveyFilter}
                    <Button type="button" variant="ghost" size="sm" className="filter-chip-clear" onClick={() => setSurveyFilter("all")}>Clear</Button>
                  </span>
                )}
                {isB2BPlatform && selectedSurveyBusiness && (
                  <span className="active-filter-tag">
                    Business: {selectedSurveyBusiness}
                    <Button type="button" variant="ghost" size="sm" className="filter-chip-clear" onClick={clearBusinessFilter}>Clear</Button>
                  </span>
                )}
                {surveyDateFilter && (
                  <span className="active-filter-tag">
                    Date: {surveyDateFilter}
                    <Button type="button" variant="ghost" size="sm" className="filter-chip-clear" onClick={() => setSurveyDateFilter("")}>Clear</Button>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Survey Results List */}
          <div className="survey-results-list">
            {surveyResults.length === 0 ? (
              <p className="caption">No survey results found.</p>
            ) : (
              <div className="data-table-shell">
                <Table className="data-table" aria-label="Survey results table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isMysteryShopperPlatform ? "Location" : "Business"}</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {surveyResults.map((visit) => (
                      <TableRow key={visit.id}>
                        <TableCell>
                          <div className="cell-stack">
                            <strong>{visit.business_name}</strong>
                            <span className="caption">Visit ID: {visit.id}</span>
                          </div>
                        </TableCell>
                        <TableCell>{visit.visit_date}</TableCell>
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
                            {visit.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="cell-stack">
                            <span>{visit.mandatory_answered_count || 0}/{visit.mandatory_total_count || 24}</span>
                            {visit.response_count > 0 && visit.mandatory_answered_count === 0 ? (
                              <span className="progress-hint">Responses exist but progress not calculated</span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="table-actions action-toolbar">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="table-action-btn"
                              onClick={() => loadSurveyVisitDetails(visit.id)}
                            >
                              View Details
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Survey Visit Details */}
          {selectedSurveyVisit && (
            <div className="survey-details">
              <div className="panel-header">
                <h3>Survey Details - {selectedSurveyVisit.business_name}</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedSurveyVisit(null)}
                >
                  Close
                </Button>
              </div>
              
              <div className="visit-info">
                <p><strong>Visit Date:</strong> {selectedSurveyVisit.visit_date}</p>
                <p><strong>Status:</strong> {selectedSurveyVisit.status}</p>
                <p><strong>Representative:</strong> {selectedSurveyVisit.representative_name || selectedSurveyVisit.representative_id}</p>
                <p><strong>Progress:</strong> {selectedSurveyVisit.mandatory_answered_count || 0}/{selectedSurveyVisit.mandatory_total_count || 0} questions answered</p>
              </div>

              <div className="responses">
                <h4>Responses</h4>
                {selectedSurveyVisit.responses && selectedSurveyVisit.responses.length > 0 ? (
                  selectedSurveyVisit.responses.map((response) => (
                    <div key={response.response_id} className="response-card">
                      <div className="response-header">
                        <strong>Question {response.question_number || response.question_id}</strong>
                        {response.score !== null && response.score !== undefined && (
                          <span className="score">Score: {response.score}</span>
                        )}
                      </div>
                      <p className="question-text">{response.question_text}</p>
                      <p className="answer-text">{response.answer_text}</p>
                      {response.verbatim && (
                        <p className="verbatim">Verbatim: {response.verbatim}</p>
                      )}
                      {response.actions && response.actions.length > 0 && (
                        <div className="actions">
                          <strong>Actions:</strong>
                          <ul>
                            {response.actions.map((action, index) => (
                              <li key={index}>{action}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <p className="timestamp">Created: {new Date(response.created_at).toLocaleString()}</p>
                    </div>
                  ))
                ) : (
                  <p className="caption">No responses found for this visit.</p>
                )}
              </div>
            </div>
          )}
        </section>
      ) : null}
    </motion.main>
  );
}
