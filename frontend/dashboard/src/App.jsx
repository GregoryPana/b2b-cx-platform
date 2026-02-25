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
  const [activeView, setActiveView] = useState("metrics");
  const [reviewNote, setReviewNote] = useState("");
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

  const canViewMetrics = role === "Manager" || role === "Admin";
  const canReview = role === "Reviewer" || role === "Admin";

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

  useEffect(() => {
    if (activeView === "metrics") {
      loadMetrics();
    }
    if (activeView === "review") {
      loadPending();
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

      <section className="panel">
        <h2>Identity</h2>
        <div className="grid">
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
      </section>

      <section className="panel">
        <h2>Workspace</h2>
        <div className="toggle">
          <button
            type="button"
            className={activeView === "metrics" ? "active" : ""}
            onClick={() => setActiveView("metrics")}
            disabled={!canViewMetrics}
          >
            Metrics Dashboard
          </button>
          <button
            type="button"
            className={activeView === "review" ? "active" : ""}
            onClick={() => setActiveView("review")}
            disabled={!canReview}
          >
            Review Queue
          </button>
        </div>
        <p className="caption">
          {activeView === "metrics"
            ? "Viewing aggregated metrics for approved visits."
            : "Reviewing submissions awaiting approval, rejection, or changes."}
        </p>
      </section>

      {error ? <p className="notice">{error}</p> : null}
      {message ? <p className="notice success">{message}</p> : null}

      {activeView === "metrics" && canViewMetrics ? (
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
                    <span>Visit {visit.visit_id.slice(0, 8)}</span>
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
                    Business ID: {selectedVisit.business_id} · Representative ID: {selectedVisit.representative_id}
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
