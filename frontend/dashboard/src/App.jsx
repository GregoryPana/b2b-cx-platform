import { useEffect, useMemo, useState } from "react";
import "./review.css";

const API_BASE =
  import.meta.env.VITE_API_URL ||
  `http://${window.location.hostname}:8001`;

export default function App() {
  const [userId, setUserId] = useState("3");
  const [role, setRole] = useState("Manager");
  const [surveyTypes, setSurveyTypes] = useState([]);
  const [activePlatform, setActivePlatform] = useState(null);
  const [nps, setNps] = useState(null);
  const [coverage, setCoverage] = useState(null);
  const [categories, setCategories] = useState([]);
  const [analytics, setAnalytics] = useState(null);
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

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      "X-User-Id": userId,
      "X-User-Role": role
    }),
    [userId, role]
  );

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

  const canViewMetrics = role === "Manager" || role === "Admin";
  const canReview = role === "Reviewer" || role === "Admin";
  const canManageBusinesses = role === "Manager" || role === "Admin";
  const isB2BPlatform = activePlatform === "B2B";

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

  const loadMetrics = async () => {
    setError("");
    if (!canViewMetrics) {
      setNps(null);
      setCoverage(null);
      setCategories([]);
      return;
    }

    const platformQuery = activePlatform ? `?survey_type=${encodeURIComponent(activePlatform)}` : "";
    const cacheBuster = `&_cb=${Date.now()}`;

    try {
      const [npsRes, coverageRes, catRes, analyticsRes] = await Promise.all([
        fetch(`${API_BASE}/dashboard/nps${platformQuery}${cacheBuster}`, { headers }),
        fetch(`${API_BASE}/dashboard/coverage${platformQuery}${cacheBuster}`, { headers }),
        fetch(`${API_BASE}/dashboard/category-breakdown${platformQuery}${cacheBuster}`, { headers }),
        fetch(`${API_BASE}/analytics${platformQuery}${cacheBuster}`, { headers })
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
    const params = new URLSearchParams();
    params.set("survey_type", activePlatform);
    params.set("business_ids", selectedAnalyticsBusinessIds.join(","));
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

  const loadPending = async () => {
    if (!canReview || !isB2BPlatform) {
      setPendingVisits([]);
      setSelectedVisit(null);
      return;
    }

    const res = await fetch(`${API_BASE}/dashboard-visits/pending`, { headers });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || "Failed to load pending visits");
      return;
    }
    setPendingVisits(data);
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
  }, [activeView, surveyFilter, selectedSurveyBusiness, surveyDateFilter, activePlatform]);

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
  }, [activePlatform, activeView, isB2BPlatform, selectedAnalyticsBusinessIds.join(",")]);

  const handleSelectPlatform = (platformName) => {
    setActivePlatform(platformName);
    setActiveView("analytics");
    setError("");
    setMessage("");
  };

  if (!activePlatform) {
    return (
      <main className="page">
        <header className="header">
          <div>
            <p className="eyebrow">Governance Dashboard</p>
            <h1>Select a Platform</h1>
          </div>
        </header>

        <section className="panel">
          <div className="panel-header">
            <h2>Platforms</h2>
            <button type="button" className="ghost" onClick={loadSurveyTypes}>
              Refresh
            </button>
          </div>

          <div className="grid">
            {(surveyTypes.length ? surveyTypes : [{ name: "B2B" }]).map((type) => (
              <button
                key={type.name}
                type="button"
                className="card"
                onClick={() => handleSelectPlatform(type.name)}
              >
                <div className="card-title">{type.name}</div>
                <div className="caption">{type.description || ""}</div>
              </button>
            ))}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="header">
        <div>
          <p className="eyebrow">Governance Dashboard</p>
          <h1>{activePlatform} Dashboard</h1>
        </div>
        <div className="flex gap-3 items-end">
          <button type="button" className="ghost" onClick={() => setActivePlatform(null)}>
            Change Platform
          </button>
          <button className="cta" type="button">Export Snapshot</button>
        </div>
      </header>

      {!isB2BPlatform ? (
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

      {isB2BPlatform ? (
      <>
      <nav className="top-nav" aria-label="Primary">
        <div className="nav-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeView === "analytics"}
            className={activeView === "analytics" ? "active" : ""}
            onClick={() => setActiveView("analytics")}
            disabled={!canViewMetrics}
          >
            Analytics
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === "review"}
            className={activeView === "review" ? "active" : ""}
            onClick={() => setActiveView("review")}
            disabled={!canReview || !isB2BPlatform}
          >
            Review Queue
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === "businesses"}
            className={activeView === "businesses" ? "active" : ""}
            onClick={() => setActiveView("businesses")}
            disabled={!canManageBusinesses || !isB2BPlatform}
          >
            Businesses
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === "visits"}
            className={activeView === "visits" ? "active" : ""}
            onClick={() => setActiveView("visits")}
            disabled={!canManageBusinesses || !isB2BPlatform}
          >
            Visits
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === "survey-results"}
            className={activeView === "survey-results" ? "active" : ""}
            onClick={() => setActiveView("survey-results")}
            disabled={!canViewMetrics}
          >
            Survey Results
          </button>
        </div>
        <div className="nav-account">
          <span className="caption">Local account</span>
          <div className="account-select">
            <label>
              User ID
              <input value={userId} onChange={(event) => setUserId(event.target.value)} />
            </label>
            <label>
              Role
              <select value={role} onChange={(event) => setRole(event.target.value)}>
                <option>Manager</option>
                <option>Reviewer</option>
                <option>Admin</option>
              </select>
            </label>
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

      {error ? <p className="notice">{error}</p> : null}
      {message ? <p className="notice success">{message}</p> : null}

      </>
      ) : null}

      {activeView === "businesses" && canManageBusinesses ? (
        <section className="panel">
          <div className="panel-header">
            <h2>{selectedBusiness ? "Edit Business" : "Create Business"}</h2>
            {selectedBusiness ? (
              <button
                type="button"
                className="ghost"
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
              >
                Cancel Edit
              </button>
            ) : null}
          </div>
          <div className="grid">
            <label>
              Business Name
              <input
                value={businessForm.name}
                onChange={(event) =>
                  setBusinessForm((prev) => ({ ...prev, name: event.target.value }))
                }
              />
            </label>
            <label>
              Location
              <input
                value={businessForm.location}
                onChange={(event) =>
                  setBusinessForm((prev) => ({ ...prev, location: event.target.value }))
                }
              />
            </label>
            <label>
              Priority
              <select
                value={businessForm.priority_level}
                onChange={(event) =>
                  setBusinessForm((prev) => ({ ...prev, priority_level: event.target.value }))
                }
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
            <label>
              Account Executive
              <input
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
              <select
                value={businessForm.active ? "active" : "inactive"}
                onChange={(event) =>
                  setBusinessForm((prev) => ({ ...prev, active: event.target.value === "active" }))
                }
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>
          <div className="actions form-cta">
            <button
              type="button"
              onClick={selectedBusiness ? handleUpdateBusiness : handleCreateBusiness}
            >
              {selectedBusiness ? "Update Business" : "Save Business"}
            </button>
          </div>
          <p className="caption">Managers and Admins can create businesses and set priority.</p>
        </section>
      ) : null}

      {isB2BPlatform && activeView === "visits" && canManageBusinesses ? (
        <>
          <section className="panel">
            <div className="panel-header">
              <h2>Create Planned Visit</h2>
              <button type="button" className="ghost" onClick={loadDraftVisits}>
                Refresh
              </button>
            </div>
            <div className="grid">
              <label>
                Survey Type
                <select
                  value="B2B"
                  disabled
                >
                  <option value="B2B">B2B</option>
                </select>
              </label>
              <label>
                Business
                <input
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
                <input
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
                <input
                  type="date"
                  value={plannedForm.visit_date}
                  onChange={(event) =>
                    setPlannedForm((prev) => ({ ...prev, visit_date: event.target.value }))
                  }
                />
              </label>
            </div>
            <div className="actions form-cta">
              <button type="button" onClick={handleCreatePlannedVisit}>
                Create Draft Visit
              </button>
            </div>
            <p className="caption">Draft visits appear in the survey app for the assigned rep.</p>
          </section>

          <section className="table">
            <div className="panel-header">
              <h2>Planned Visits</h2>
              <button type="button" className="ghost" onClick={loadDraftVisits}>
                Refresh
              </button>
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
                <button
                  type="button"
                  key={visit.visit_id ?? visit.id}
                  className={`table-row selectable ${
                    (selectedDraft?.visit_id ?? selectedDraft?.id) === (visit.visit_id ?? visit.id) ? "active" : ""
                  }`}
                  onClick={() => handleSelectDraft(visit)}
                >
                  <span>
                    {visit.business_name} ({visit.business_priority})
                  </span>
                  <span>{visit.representative_name || representativeMap[visit.representative_id] || visit.representative_id}</span>
                  <span>{visit.visit_date}</span>
                </button>
              ))
            )}
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2>Edit Planned Visit</h2>
              {selectedDraft ? (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    setSelectedDraft(null);
                    setPlannedEditForm({
                      visit_id: "",
                      business_name: "",
                      representative_id: "",
                      visit_date: ""
                    });
                  }}
                >
                  Clear
                </button>
              ) : null}
            </div>
            <div className="grid">
              <label>
                Business
                <input value={plannedEditForm.business_name} disabled />
              </label>
              <label>
                Representative
                <select
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
                </select>
              </label>
              <label>
                Visit Date
                <input
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
              <button type="button" onClick={handleUpdatePlannedVisit}>
                Update Planned Visit
              </button>
              <button type="button" className="danger" onClick={handleDeletePlannedVisit}>
                Delete Planned Visit
              </button>
            </div>
            <p className="caption">Business is locked for planned visits.</p>
          </section>
        </>
      ) : null}

      {activeView === "businesses" && canManageBusinesses ? (
        <section className="table business-directory">
          <div className="panel-header">
            <h2>Business Directory</h2>
            <button type="button" className="ghost" onClick={loadBusinesses}>
              Refresh
            </button>
          </div>
          <div className="table-row header-row business-directory-row">
            <span>Business</span>
            <span>Priority</span>
            <span>Status</span>
          </div>
          {businesses.length === 0 ? (
            <p className="caption">No businesses found.</p>
          ) : (
            businesses.map((business) => (
                <div
                  className={`table-row business-directory-row ${
                    !business.location || !business.account_executive_id ? "needs-attention" : ""
                  }`}
                key={business.id}
              >
                <div>
                  <strong>{business.name}</strong>
                  <p className="caption">{business.location || "No location"}</p>
                  <p className="caption">
                    Account Executive: {accountExecutiveMap[business.account_executive_id] || "Unassigned"}
                  </p>
                  {!business.location || !business.account_executive_id ? (
                    <span className="badge">Needs details</span>
                  ) : null}
                </div>
                <span>{business.priority_level}</span>
                <div className="row-actions">
                  <span>{business.active ? "Active" : "Retired"}</span>
                  <div className="actions">
                    <button type="button" onClick={() => handleEditBusiness(business)}>
                      Edit
                    </button>
                    {business.active ? (
                      <button type="button" className="danger" onClick={() => handleRetireBusiness(business)}>
                        Retire
                      </button>
                    ) : null}
                    {role === "Admin" ? (
                      <button type="button" className="danger" onClick={() => handleDeleteBusiness(business)}>
                        Delete
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </section>
      ) : null}

      {activeView === "analytics" && canViewMetrics ? (
        <>
          <section className="panel">
            <div className="panel-header">
              <h2>Targeted Business Analytics</h2>
              <button type="button" className="ghost" onClick={loadTargetedAnalytics} disabled={selectedAnalyticsBusinessIds.length === 0}>
                Recalculate
              </button>
            </div>
            <p className="caption">Select businesses to calculate focused KPIs for customer targeting.</p>
            <div className="targeted-controls">
              <input
                type="text"
                placeholder="Search businesses by name or location"
                value={analyticsBusinessSearch}
                onChange={(event) => setAnalyticsBusinessSearch(event.target.value)}
              />
              <div className="targeted-toolbar">
                <span className="caption">Selected: {selectedAnalyticsBusinessIds.length}</span>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setSelectedAnalyticsBusinessIds([])}
                  disabled={selectedAnalyticsBusinessIds.length === 0}
                >
                  Clear Selection
                </button>
              </div>
              <div className="targeted-business-list">
                {filteredAnalyticsBusinesses.slice(0, 40).map((business) => (
                  <label key={business.id} className="targeted-business-item">
                    <input
                      type="checkbox"
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
                      <button
                        key={business.id}
                        type="button"
                        className="targeted-chip"
                        onClick={() => toggleAnalyticsBusiness(business.id)}
                      >
                        {business.name}
                      </button>
                    ))}
                </div>
              ) : null}
            </div>
            {targetedAnalytics ? (
              <div className="targeted-kpis">
                <div><strong>CSAT</strong><span>{targetedAnalytics.customer_satisfaction?.csat_score?.toFixed?.(1) ?? "0.0"}%</span></div>
                <div><strong>NPS</strong><span>{targetedAnalytics.nps?.nps ?? "--"}</span></div>
                <div><strong>Relationship</strong><span>{targetedAnalytics.relationship_score?.score?.toFixed?.(1) ?? "0.0"}</span></div>
                <div><strong>Competitor Exposure</strong><span>{targetedAnalytics.competitive_exposure?.exposure_rate?.toFixed?.(1) ?? "0.0"}%</span></div>
              </div>
            ) : (
              <p className="caption">Select one or more businesses to see targeted analytics.</p>
            )}
          </section>
          <section className="grid">
            <article>
              <h2>Net Promoter Score</h2>
              <p className="metric">{analytics?.nps?.nps ?? "--"}</p>
              <p className="caption">
                {analytics?.nps?.total_responses ?? 0} approved responses
              </p>
              <div className="pie-row">
                <div
                  className="pie-chart"
                  style={buildPieStyle([
                    { value: analytics?.nps?.promoters ?? 0, color: "#16a34a" },
                    { value: analytics?.nps?.passives ?? 0, color: "#f59e0b" },
                    { value: analytics?.nps?.detractors ?? 0, color: "#dc2626" }
                  ])}
                />
              </div>
              <div className="pie-legend">
                <span><i style={{ background: "#16a34a" }} />Promoters</span>
                <span><i style={{ background: "#f59e0b" }} />Passives</span>
                <span><i style={{ background: "#dc2626" }} />Detractors</span>
              </div>
              <div className="nps-breakdown">
                <div className="nps-category">
                  <div className="label">Promoters (9-10)</div>
                  <div className="value">{analytics?.nps?.promoters ?? 0}</div>
                  <div className="percentage">{analytics?.nps?.promoter_percentage ?? 0}%</div>
                </div>
                <div className="nps-category">
                  <div className="label">Passives (7-8)</div>
                  <div className="value">{analytics?.nps?.passives ?? 0}</div>
                  <div className="percentage">{analytics?.nps?.passive_percentage ?? 0}%</div>
                </div>
                <div className="nps-category">
                  <div className="label">Detractors (0-6)</div>
                  <div className="value">{analytics?.nps?.detractors ?? 0}</div>
                  <div className="percentage">{analytics?.nps?.detractor_percentage ?? 0}%</div>
                </div>
              </div>
            </article>
            <article>
              <h2>Customer Satisfaction</h2>
              <p className="metric">{analytics?.customer_satisfaction?.avg_score?.toFixed(1) ?? "--"}</p>
              <p className="caption">
                {analytics?.customer_satisfaction?.response_count ?? 0} responses to question 12
              </p>
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
                <p className="caption">
                  ({analytics?.customer_satisfaction?.score_distribution?.satisfied ?? 0} Satisfied + {analytics?.customer_satisfaction?.score_distribution?.very_satisfied ?? 0} Very Satisfied) / {analytics?.customer_satisfaction?.response_count ?? 0} responses
                </p>
              </div>
              <div className="satisfaction-breakdown">
                  <div className="satisfaction-category">
                    <span className="label">Very Dissatisfied (0-2)</span>
                    <span className="value">{analytics?.customer_satisfaction?.score_distribution?.very_dissatisfied ?? 0}</span>
                  </div>
                  <div className="satisfaction-category">
                    <span className="label">Dissatisfied (3-4)</span>
                    <span className="value">{analytics?.customer_satisfaction?.score_distribution?.dissatisfied ?? 0}</span>
                  </div>
                  <div className="satisfaction-category">
                    <span className="label">Neutral (5-6)</span>
                    <span className="value">{analytics?.customer_satisfaction?.score_distribution?.neutral ?? 0}</span>
                  </div>
                  <div className="satisfaction-category">
                    <span className="label">Satisfied (7-8)</span>
                    <span className="value">{analytics?.customer_satisfaction?.score_distribution?.satisfied ?? 0}</span>
                  </div>
                  <div className="satisfaction-category">
                    <span className="label">Very Satisfied (9-10)</span>
                    <span className="value">{analytics?.customer_satisfaction?.score_distribution?.very_satisfied ?? 0}</span>
                  </div>
                </div>
              <div className="pie-row">
                <div
                  className="pie-chart"
                  style={buildPieStyle([
                    { value: analytics?.customer_satisfaction?.score_distribution?.very_satisfied ?? 0, color: "#15803d" },
                    { value: analytics?.customer_satisfaction?.score_distribution?.satisfied ?? 0, color: "#22c55e" },
                    { value: analytics?.customer_satisfaction?.score_distribution?.neutral ?? 0, color: "#f59e0b" },
                    { value: analytics?.customer_satisfaction?.score_distribution?.dissatisfied ?? 0, color: "#fb7185" },
                    { value: analytics?.customer_satisfaction?.score_distribution?.very_dissatisfied ?? 0, color: "#b91c1c" }
                  ])}
                />
              </div>
              <div className="pie-legend">
                <span><i style={{ background: "#15803d" }} />Very Satisfied</span>
                <span><i style={{ background: "#22c55e" }} />Satisfied</span>
                <span><i style={{ background: "#f59e0b" }} />Neutral</span>
                <span><i style={{ background: "#fb7185" }} />Dissatisfied</span>
                <span><i style={{ background: "#b91c1c" }} />Very Dissatisfied</span>
              </div>
              </article>
            <article>
              <h2>Response Overview</h2>
              <div className="grid">
                <div>
                  <h3>Total Visits</h3>
                  <p className="metric">{analytics?.visits?.total ?? "--"}</p>
                </div>
                <div>
                  <h3>Completed Visits</h3>
                  <p className="metric">{analytics?.visits?.completed ?? "--"}</p>
                </div>
                <div>
                  <h3>Pending Visits</h3>
                  <p className="metric">{analytics?.visits?.pending ?? "--"}</p>
                </div>
                <div>
                  <h3>Draft Visits</h3>
                  <p className="metric">{analytics?.visits?.draft ?? "--"}</p>
                </div>
              </div>
            </article>
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
          </section>
        </>
      ) : null}

      {activeView === "review" && canReview ? (
        <section className="panel">
          <div className="panel-header">
            <h2>Review Queue</h2>
            <button type="button" className="ghost" onClick={loadPending}>
              Refresh
            </button>
          </div>
          <div className="queue">
            <div className="queue-list">
              {pendingVisits.length === 0 ? (
                <p className="caption">No pending visits.</p>
              ) : (
                pendingVisits.map((visit) => (
                  <button
                    key={visit.visit_id}
                    type="button"
                    className={`queue-item ${
                      (selectedVisit?.id === visit.visit_id || selectedVisit?.visit_id === visit.visit_id) ? "active" : ""
                    }`}
                    onClick={() => loadVisitDetail(visit.visit_id)}
                  >
                    <span>
                      {visit.business_name || "Visit"}
                      {visit.business_priority ? ` · ${visit.business_priority} priority` : ""}
                    </span>
                    <span>{visit.visit_date}</span>
                  </button>
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
                    <textarea
                      value={reviewNote}
                      onChange={(event) => setReviewNote(event.target.value)}
                      placeholder="Add notes, change requests, or approval context."
                    />
                  </label>
                  <div className="actions">
                    <button
                      type="button"
                      onClick={() => submitReviewAction("needs-changes")}
                      disabled={reviewActionState.loading}
                      className="transition duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Needs Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => submitReviewAction("approve")}
                      disabled={reviewActionState.loading}
                      className="transition duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="danger transition duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => submitReviewAction("reject")}
                      disabled={reviewActionState.loading}
                    >
                      Reject
                    </button>
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

      {isB2BPlatform && activeView === "survey-results" && canViewMetrics ? (
        <section className="survey-results">
          <div className="panel-header">
            <h2>Survey Results</h2>
            <button type="button" className="ghost" onClick={loadSurveyResults}>
              Refresh
            </button>
          </div>
          
          {/* Clean Filter Section */}
          <div className="filters-section">
            <div className="filters-grid">
              {/* Status Filter */}
              <div className="filter-item">
                <label className="filter-label">Status</label>
                <select 
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
                </select>
              </div>

              {/* Business Filter with Searchable Dropdown */}
              <div className="filter-item business-filter">
                <label className="filter-label">Business</label>
                <div className="business-dropdown">
                  <div className="dropdown-input-wrapper">
                    <input
                      type="text"
                      placeholder="Search and select business..."
                      value={businessSearchQuery}
                      onChange={(e) => handleBusinessSearchChange(e.target.value)}
                      onFocus={() => setShowBusinessDropdown(true)}
                      className="filter-input"
                    />
                    {selectedSurveyBusiness && (
                      <button 
                        type="button" 
                        onClick={clearBusinessFilter}
                        className="clear-button"
                        title="Clear business filter"
                      >
                        ✕
                      </button>
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
                            className={`dropdown-item ${!business.active ? 'inactive' : ''}`}
                            onClick={() => handleBusinessSelect(business)}
                          >
                            <div className="business-info">
                              <span className="business-name">{business.name}</span>
                              <span className={`business-status ${business.active ? 'active' : 'inactive'}`}>
                                {business.active ? 'Active' : 'Retired'}
                              </span>
                            </div>
                            {business.location && (
                              <span className="business-location">{business.location}</span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Date Filter */}
              <div className="filter-item">
                <label className="filter-label">Visit Date</label>
                <input
                  type="date"
                  value={surveyDateFilter}
                  onChange={(e) => setSurveyDateFilter(e.target.value)}
                  className="filter-input"
                />
              </div>
            </div>

            {/* Active Filters Display */}
            {(surveyFilter !== "all" || selectedSurveyBusiness || surveyDateFilter) && (
              <div className="active-filters">
                <span className="active-filters-label">Active filters:</span>
                {surveyFilter !== "all" && (
                  <span className="active-filter-tag">
                    Status: {surveyFilter}
                    <button onClick={() => setSurveyFilter("all")}>✕</button>
                  </span>
                )}
                {selectedSurveyBusiness && (
                  <span className="active-filter-tag">
                    Business: {selectedSurveyBusiness}
                    <button onClick={clearBusinessFilter}>✕</button>
                  </span>
                )}
                {surveyDateFilter && (
                  <span className="active-filter-tag">
                    Date: {surveyDateFilter}
                    <button onClick={() => setSurveyDateFilter("")}>✕</button>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Survey Results List */}
          <div className="survey-results-list">
            <div className="table-row header-row">
              <span>Business</span>
              <span>Date</span>
              <span>Status</span>
              <span>Progress</span>
              <span>Actions</span>
            </div>
            {surveyResults.length === 0 ? (
              <p className="caption">No survey results found.</p>
            ) : (
              surveyResults.map((visit) => (
                <div key={visit.id} className="table-row">
                  <div>
                    <strong>{visit.business_name}</strong>
                    <p className="caption">Visit ID: {visit.id}</p>
                  </div>
                  <span>{visit.visit_date}</span>
                  <span className={`status-badge ${visit.status.toLowerCase()}`}>
                    {visit.status}
                  </span>
                  <span>
                    {visit.mandatory_answered_count || 0}/{visit.mandatory_total_count || 24}
                    {visit.response_count > 0 && visit.mandatory_answered_count === 0 ? (
                      <span className="progress-hint">(responses exist but progress not calculated)</span>
                    ) : ""}
                  </span>
                  <div className="actions">
                    <button
                      type="button"
                      onClick={() => loadSurveyVisitDetails(visit.id)}
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Survey Visit Details */}
          {selectedSurveyVisit && (
            <div className="survey-details">
              <div className="panel-header">
                <h3>Survey Details - {selectedSurveyVisit.business_name}</h3>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setSelectedSurveyVisit(null)}
                >
                  Close
                </button>
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
    </main>
  );
}
