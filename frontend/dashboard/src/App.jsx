import { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function App() {
  const [userId, setUserId] = useState("3");
  const [role, setRole] = useState("Manager");
  const [nps, setNps] = useState(null);
  const [coverage, setCoverage] = useState(null);
  const [categories, setCategories] = useState([]);
  const [pendingVisits, setPendingVisits] = useState([]);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [activeView, setActiveView] = useState("analytics");
  const [reviewNote, setReviewNote] = useState("");
  const [businesses, setBusinesses] = useState([]);
  const [accountExecutives, setAccountExecutives] = useState([]);
  const [representatives, setRepresentatives] = useState([]);
  const [draftVisits, setDraftVisits] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [plannedForm, setPlannedForm] = useState({
    business_id: "",
    representative_id: "",
    visit_date: "",
    visit_type: "Planned"
  });
  const [businessForm, setBusinessForm] = useState({
    name: "",
    location: "",
    priority_level: "medium",
    active: true,
    account_executive_id: ""
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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

  const canViewMetrics = role === "Manager" || role === "Admin";
  const canReview = role === "Reviewer" || role === "Admin";
  const canManageBusinesses = role === "Manager" || role === "Admin";

  const loadMetrics = async () => {
    setError("");
    if (!canViewMetrics) {
      setNps(null);
      setCoverage(null);
      setCategories([]);
      return;
    }

    try {
      const [npsRes, coverageRes, catRes] = await Promise.all([
        fetch(`${API_BASE}/dashboard/nps`, { headers }),
        fetch(`${API_BASE}/dashboard/coverage`, { headers }),
        fetch(`${API_BASE}/dashboard/category-breakdown`, { headers })
      ]);

      const npsData = await npsRes.json();
      const coverageData = await coverageRes.json();
      const catData = await catRes.json();

      if (!npsRes.ok || !coverageRes.ok || !catRes.ok) {
        setError(npsData.detail || coverageData.detail || catData.detail || "Failed to load");
        return;
      }

      setNps(npsData);
      setCoverage(coverageData);
      setCategories(catData);
    } catch {
      setError("Failed to load dashboard data");
    }
  };

  const loadPending = async () => {
    if (!canReview) {
      setPendingVisits([]);
      setSelectedVisit(null);
      return;
    }

    const res = await fetch(`${API_BASE}/visits/pending`, { headers });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || "Failed to load pending visits");
      return;
    }
    setPendingVisits(data);
  };

  const loadVisitDetail = async (visitId) => {
    const res = await fetch(`${API_BASE}/visits/${visitId}`, { headers });
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
      return;
    }

    setMessage("");
    const endpoint = `${API_BASE}/visits/${selectedVisit.visit_id}/${action}`;
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
      return;
    }

    setMessage(`Visit ${data.status}.`);
    setReviewNote("");
    await loadPending();
    setSelectedVisit(null);
  };

  const loadBusinesses = async () => {
    if (!canManageBusinesses) {
      setBusinesses([]);
      return;
    }

    const res = await fetch(`${API_BASE}/businesses`, { headers });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || "Failed to load businesses");
      return;
    }
    setBusinesses(data);
  };

  const loadAccountExecutives = async () => {
    if (!canManageBusinesses) {
      setAccountExecutives([]);
      return;
    }

    const res = await fetch(`${API_BASE}/account-executives`, { headers });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || "Failed to load account executives");
      return;
    }
    setAccountExecutives(data);
  };

  const loadRepresentatives = async () => {
    if (!canManageBusinesses) {
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
    if (!canManageBusinesses) {
      setDraftVisits([]);
      return;
    }

    const res = await fetch(`${API_BASE}/visits/drafts`, { headers });
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
      visit_type: plannedForm.visit_type,
      meeting_attendees: []
    };

    const res = await fetch(`${API_BASE}/visits`, {
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
      visit_date: "",
      visit_type: "Planned"
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
    await loadBusinesses();
  };

  const handleRetireBusiness = async (business) => {
    setError("");
    setMessage("");

    const res = await fetch(`${API_BASE}/businesses/${business.id}`, {
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

  useEffect(() => {
    if (activeView === "analytics") {
      loadMetrics();
    }
    if (activeView === "review") {
      loadPending();
    }
    if (activeView === "businesses") {
      loadBusinesses();
      loadAccountExecutives();
    }
    if (activeView === "visits") {
      loadBusinesses();
      loadRepresentatives();
      loadDraftVisits();
    }
  }, [role, userId, activeView]);

  return (
    <main className="page">
      <header className="header">
        <div>
          <p className="eyebrow">Governance Dashboard</p>
          <h1>B2B CX Performance Overview</h1>
        </div>
        <button className="cta" type="button">Export Snapshot</button>
      </header>

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
            disabled={!canReview}
          >
            Review Queue
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === "businesses"}
            className={activeView === "businesses" ? "active" : ""}
            onClick={() => setActiveView("businesses")}
            disabled={!canManageBusinesses}
          >
            Businesses
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === "visits"}
            className={activeView === "visits" ? "active" : ""}
            onClick={() => setActiveView("visits")}
            disabled={!canManageBusinesses}
          >
            Visits
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
              <select
                value={businessForm.account_executive_id}
                onChange={(event) =>
                  setBusinessForm((prev) => ({
                    ...prev,
                    account_executive_id: event.target.value
                  }))
                }
              >
                <option value="">Unassigned</option>
                {accountExecutives.map((executive) => (
                  <option key={executive.id} value={executive.id}>
                    {executive.name}
                  </option>
                ))}
              </select>
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

      {activeView === "visits" && canManageBusinesses ? (
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
                Business
                <select
                  value={plannedForm.business_id}
                  onChange={(event) =>
                    setPlannedForm((prev) => ({ ...prev, business_id: event.target.value }))
                  }
                >
                  <option value="">Select business</option>
                  {businesses.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name} ({business.priority_level})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Representative
                <select
                  value={plannedForm.representative_id}
                  onChange={(event) =>
                    setPlannedForm((prev) => ({ ...prev, representative_id: event.target.value }))
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
                  value={plannedForm.visit_date}
                  onChange={(event) =>
                    setPlannedForm((prev) => ({ ...prev, visit_date: event.target.value }))
                  }
                />
              </label>
              <label>
                Visit Type
                <select
                  value={plannedForm.visit_type}
                  onChange={(event) =>
                    setPlannedForm((prev) => ({ ...prev, visit_type: event.target.value }))
                  }
                >
                  <option>Planned</option>
                  <option>Priority</option>
                  <option>Substitution</option>
                </select>
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
                <div className="table-row" key={visit.visit_id}>
                  <span>
                    {visit.business_name} ({visit.business_priority})
                  </span>
                  <span>{representativeMap[visit.representative_id] || visit.representative_id}</span>
                  <span>{visit.visit_date}</span>
                </div>
              ))
            )}
          </section>
        </>
      ) : null}

      {activeView === "businesses" && canManageBusinesses ? (
        <section className="table">
          <div className="panel-header">
            <h2>Business Directory</h2>
            <button type="button" className="ghost" onClick={loadBusinesses}>
              Refresh
            </button>
          </div>
          <div className="table-row header-row">
            <span>Business</span>
            <span>Priority</span>
            <span>Status</span>
          </div>
          {businesses.length === 0 ? (
            <p className="caption">No businesses found.</p>
          ) : (
            businesses.map((business) => (
              <div className="table-row" key={business.id}>
                <div>
                  <strong>{business.name}</strong>
                  <p className="caption">{business.location || "No location"}</p>
                  <p className="caption">
                    Account Executive: {business.account_executive_id || "Unassigned"}
                  </p>
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
                  </div>
                </div>
              </div>
            ))
          )}
        </section>
      ) : null}

      {activeView === "analytics" && canViewMetrics ? (
        <>
          <section className="grid">
            <article>
              <h2>Net Promoter Score</h2>
              <p className="metric">{nps?.nps ?? "--"}</p>
              <p className="caption">Approved NPS responses</p>
            </article>
            <article>
              <h2>Coverage</h2>
              <p className="metric">{coverage?.coverage_percent ?? "--"}%</p>
              <p className="caption">Businesses visited YTD</p>
            </article>
            <article>
              <h2>Repeat Visits</h2>
              <p className="metric">{coverage?.repeat_visits ?? "--"}</p>
              <p className="caption">Multi-visit accounts</p>
            </article>
          </section>

          <section className="table">
            <h2>Category Breakdown</h2>
            <div className="table-row header-row">
              <span>Category</span>
              <span>Average Score</span>
              <span>Responses</span>
            </div>
            {categories.length === 0 ? (
              <p className="caption">No category data yet.</p>
            ) : (
              categories.map((item) => (
                <div className="table-row" key={item.category}>
                  <span>{item.category}</span>
                  <span>{item.average_score}</span>
                  <span>{item.response_count}</span>
                </div>
              ))
            )}
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
                      selectedVisit?.visit_id === visit.visit_id ? "active" : ""
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
                  <h3>Visit Details</h3>
                  <p className="caption">
                    {selectedVisit.business_name}
                    {selectedVisit.business_priority
                      ? ` (${selectedVisit.business_priority} priority)`
                      : ""}
                    {" · "}
                    Representative ID: {selectedVisit.representative_id}
                  </p>
                  <div className="responses">
                    {selectedVisit.responses.map((response) => (
                      <div key={response.response_id} className="response-card">
                        <strong>Q{response.question_id}</strong>
                        <span>Score: {response.score}</span>
                        <p>{response.verbatim}</p>
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
                    <button type="button" onClick={() => submitReviewAction("needs-changes")}>
                      Needs Changes
                    </button>
                    <button type="button" onClick={() => submitReviewAction("approve")}>
                      Approve
                    </button>
                    <button type="button" className="danger" onClick={() => submitReviewAction("reject")}>
                      Reject
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
