import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function App() {
  const [userId, setUserId] = useState("4");
  const [role, setRole] = useState("Representative");
  const [activeTab, setActiveTab] = useState("planned");
  const [visitId, setVisitId] = useState("");
  const [status, setStatus] = useState("Draft");
  const [message, setMessage] = useState("");
  const [businesses, setBusinesses] = useState([]);
  const [businessError, setBusinessError] = useState("");
  const [businessMode, setBusinessMode] = useState("existing");
  const [newBusinessName, setNewBusinessName] = useState("");
  const [visitSource, setVisitSource] = useState("new");
  const [draftVisits, setDraftVisits] = useState([]);
  const [selectedDraftId, setSelectedDraftId] = useState("");
  const [selectedDraftName, setSelectedDraftName] = useState("");

  const [visitForm, setVisitForm] = useState({
    business_id: "1",
    representative_id: "4",
    visit_date: "",
    visit_type: "Planned"
  });

  const [responseForm, setResponseForm] = useState({
    question_id: "1",
    score: "9",
    verbatim: "Great partnership so far.",
    action_required: "",
    action_target: "",
    priority_level: "",
    due_date: ""
  });

  const headers = {
    "Content-Type": "application/json",
    "X-User-Id": userId,
    "X-User-Role": role
  };

  const todayString = (() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  })();

  useEffect(() => {
    const loadBusinesses = async () => {
      setBusinessError("");
      try {
        const res = await fetch(`${API_BASE}/businesses`, { headers });
        const data = await res.json();
        if (!res.ok) {
          setBusinessError(data.detail || "Failed to load businesses");
          return;
        }
        const priorityRank = { high: 0, medium: 1, low: 2 };
        const sorted = [...data].sort((a, b) => {
          const priorityDiff = (priorityRank[a.priority_level] ?? 3) - (priorityRank[b.priority_level] ?? 3);
          if (priorityDiff !== 0) return priorityDiff;
          return (a.name || "").localeCompare(b.name || "");
        });
        setBusinesses(sorted);
        if (sorted.length > 0) {
          setVisitForm((prev) => ({
            ...prev,
            business_id: String(sorted[0].id)
          }));
        }
      } catch {
        setBusinessError("Failed to load businesses");
      }
    };

    loadBusinesses();
  }, [userId, role]);

  useEffect(() => {
    const loadDrafts = async () => {
      try {
        const res = await fetch(`${API_BASE}/visits/drafts`, { headers });
        const data = await res.json();
        if (!res.ok) {
          setBusinessError(data.detail || "Failed to load draft visits");
          return;
        }
        setDraftVisits(data);
      } catch {
        setBusinessError("Failed to load draft visits");
      }
    };

    loadDrafts();
  }, [userId, role]);

  useEffect(() => {
    if (visitSource === "new") {
      setSelectedDraftId("");
      setSelectedDraftName("");
    }
  }, [visitSource]);

  const plannedVisits = draftVisits
    .filter((visit) => (visit.visit_date || "") >= todayString)
    .sort((a, b) => (a.visit_date || "").localeCompare(b.visit_date || ""));

  const handleSelectPlannedVisit = (draft) => {
    setSelectedDraftId(draft.visit_id);
    setSelectedDraftName(draft.business_name || "");
    setVisitSource("planned");
    setVisitForm((prev) => ({
      ...prev,
      business_id: String(draft.business_id || ""),
      visit_date: draft.visit_date || "",
      visit_type: draft.visit_type || "Planned"
    }));
    setVisitId(draft.visit_id);
    setStatus(draft.status || "Draft");
    setActiveTab("survey");
  };

  const createBusinessIfNeeded = async () => {
    if (businessMode !== "new") return null;

    const name = newBusinessName.trim();
    if (!name) {
      setMessage("Enter a business name or choose from the list.");
      return null;
    }

    const res = await fetch(`${API_BASE}/businesses`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name, priority_level: "medium", active: true })
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.detail || "Failed to create business");
      return null;
    }

    setBusinesses((prev) => [data, ...prev]);
    setVisitForm((prev) => ({
      ...prev,
      business_id: String(data.id)
    }));
    setNewBusinessName("");
    return data.id;
  };

  const handleCreateVisit = async () => {
    setMessage("");
    if (visitSource === "planned") {
      if (!selectedDraftId) {
        setMessage("Select a planned visit first.");
        return;
      }

      const res = await fetch(`${API_BASE}/visits/${selectedDraftId}/draft`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          representative_id: Number(userId),
          visit_date: visitForm.visit_date,
          visit_type: visitForm.visit_type
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.detail || "Failed to update planned visit");
        return;
      }

      setVisitId(data.visit_id);
      setStatus(data.status || "Draft");
      setMessage("Planned visit updated.");
      return;
    }

    const createdBusinessId = await createBusinessIfNeeded();
    if (businessMode === "new" && !createdBusinessId) return;
    const payload = {
      business_id: Number(createdBusinessId || visitForm.business_id),
      representative_id: Number(visitForm.representative_id),
      visit_date: visitForm.visit_date,
      visit_type: visitForm.visit_type,
      meeting_attendees: []
    };

    const res = await fetch(`${API_BASE}/visits`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      setMessage(data.detail || "Failed to create visit");
      return;
    }

    setVisitId(data.visit_id);
    setStatus(data.status || "Draft");
    setMessage("Visit created.");
  };

  const handleAddResponse = async () => {
    if (!visitId) {
      setMessage("Create a visit first.");
      return;
    }

    setMessage("");
    const payload = {
      question_id: Number(responseForm.question_id),
      score: Number(responseForm.score),
      verbatim: responseForm.verbatim,
      action_required: responseForm.action_required || null,
      action_target: responseForm.action_target || null,
      priority_level: responseForm.priority_level || null,
      due_date: responseForm.due_date || null
    };

    const res = await fetch(`${API_BASE}/visits/${visitId}/responses`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.detail || "Failed to add response");
      return;
    }
    setMessage(`Response saved (#${data.response_id}).`);
  };

  const handleSubmitVisit = async () => {
    if (!visitId) {
      setMessage("Create a visit first.");
      return;
    }

    const res = await fetch(`${API_BASE}/visits/${visitId}/submit`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ submit_notes: null })
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.detail || "Failed to submit visit");
      return;
    }
    setStatus(data.status || "Pending");
    setMessage("Visit submitted for review.");
  };

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Survey Console</p>
        <h1>B2B Customer Experience Visit</h1>
        <p className="lead">
          Structured visit assessments with governance, action tracking, and clear status transitions.
        </p>
      </section>

      <section className="panel">
        <h2>Identity</h2>
        <div className="grid">
          <label>
            User ID
            <input value={userId} onChange={(e) => setUserId(e.target.value)} />
          </label>
          <label>
            Role
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option>Representative</option>
              <option>Reviewer</option>
              <option>Manager</option>
              <option>Admin</option>
            </select>
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="tabs">
          <button
            type="button"
            className={activeTab === "planned" ? "active" : ""}
            onClick={() => setActiveTab("planned")}
          >
            Planned Visits
          </button>
          <button
            type="button"
            className={activeTab === "survey" ? "active" : ""}
            onClick={() => setActiveTab("survey")}
          >
            Survey
          </button>
        </div>
      </section>

      {activeTab === "planned" ? (
        <section className="panel">
          <div className="panel-header">
            <h2>Upcoming & Today</h2>
            <button type="button" className="ghost" onClick={() => setActiveTab("survey")}>
              Start Survey
            </button>
          </div>
          {plannedVisits.length === 0 ? (
            <p className="message">No planned visits for today or later.</p>
          ) : (
            <div className="planned-list">
              {plannedVisits.map((draft) => (
                <button
                  type="button"
                  key={draft.visit_id}
                  className="planned-card"
                  onClick={() => handleSelectPlannedVisit(draft)}
                >
                  <div>
                    <strong>{draft.business_name}</strong>
                    <p>
                      {draft.business_priority ? `${draft.business_priority} priority` : "standard priority"}
                    </p>
                  </div>
                  <div>
                    <span>{draft.visit_date}</span>
                    <span>Representative #{draft.representative_id}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "survey" ? (
        <section className="panel">
          <h2>Survey Visit</h2>
          <div className="grid">
            <label>
              Visit Source
              <select
                value={visitSource}
                onChange={(e) => setVisitSource(e.target.value)}
              >
                <option value="new">New visit</option>
                <option value="planned">Planned visit</option>
              </select>
            </label>
            {visitSource === "planned" ? (
              <label>
                Planned Visits
                <select
                  value={selectedDraftId}
                  onChange={(e) => {
                    const draft = draftVisits.find((item) => item.visit_id === e.target.value);
                    setSelectedDraftId(e.target.value);
                    if (draft) {
                      setVisitForm((prev) => ({
                        ...prev,
                        business_id: String(draft.business_id || ""),
                        visit_date: draft.visit_date || "",
                        visit_type: draft.visit_type || "Planned"
                      }));
                      setSelectedDraftName(draft.business_name || "");
                      setVisitId(draft.visit_id);
                      setStatus(draft.status || "Draft");
                    }
                  }}
                >
                  <option value="">Select a planned visit</option>
                  {draftVisits.map((draft) => (
                    <option key={draft.visit_id} value={draft.visit_id}>
                      {draft.business_name} ({draft.business_priority || "medium"}) · {draft.visit_date}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label>
                Business Source
                <select
                  value={businessMode}
                  onChange={(e) => setBusinessMode(e.target.value)}
                >
                  <option value="existing">Choose existing</option>
                  <option value="new">Add new business</option>
                </select>
              </label>
            )}
            {visitSource === "planned" ? (
              <label>
                Business
                <input value={selectedDraftName || "Selected business"} disabled />
              </label>
            ) : businessMode === "existing" ? (
              <label>
                Business
                <select
                  value={visitForm.business_id}
                  onChange={(e) => setVisitForm({ ...visitForm, business_id: e.target.value })}
                >
                  {businesses.length === 0 ? (
                    <option value="">No businesses</option>
                  ) : (
                    businesses.map((business) => (
                      <option key={business.id} value={business.id}>
                        {business.name} ({business.priority_level || "medium"})
                      </option>
                    ))
                  )}
                </select>
              </label>
            ) : (
              <label>
                New Business Name
                <input
                  value={newBusinessName}
                  onChange={(e) => setNewBusinessName(e.target.value)}
                  placeholder="Enter business name"
                />
              </label>
            )}
            <label>
              Representative ID
              <input
                value={visitForm.representative_id}
                onChange={(e) =>
                  setVisitForm({ ...visitForm, representative_id: e.target.value })
                }
              />
            </label>
            <label>
              Visit Date
              <input
                type="date"
                value={visitForm.visit_date}
                onChange={(e) => setVisitForm({ ...visitForm, visit_date: e.target.value })}
              />
            </label>
            <label>
              Visit Type
              <select
                value={visitForm.visit_type}
                onChange={(e) => setVisitForm({ ...visitForm, visit_type: e.target.value })}
              >
                <option>Planned</option>
                <option>Priority</option>
                <option>Substitution</option>
              </select>
            </label>
          </div>
          <button type="button" onClick={handleCreateVisit}>
            {visitSource === "planned" ? "Update Planned Visit" : "Create Draft Visit"}
          </button>
          {businessError ? <p className="message">{businessError}</p> : null}
        </section>
      ) : null}

      <section className="panel">
        <h2>Add Response</h2>
        <div className="grid">
          <label>
            Question ID
            <input
              value={responseForm.question_id}
              onChange={(e) => setResponseForm({ ...responseForm, question_id: e.target.value })}
            />
          </label>
          <label>
            Score (0-10)
            <input
              value={responseForm.score}
              onChange={(e) => setResponseForm({ ...responseForm, score: e.target.value })}
            />
          </label>
          <label className="full">
            Verbatim
            <textarea
              value={responseForm.verbatim}
              onChange={(e) => setResponseForm({ ...responseForm, verbatim: e.target.value })}
            />
          </label>
          <label>
            Action Required
            <input
              value={responseForm.action_required}
              onChange={(e) =>
                setResponseForm({ ...responseForm, action_required: e.target.value })
              }
            />
          </label>
          <label>
            Action Target
            <input
              value={responseForm.action_target}
              onChange={(e) => setResponseForm({ ...responseForm, action_target: e.target.value })}
            />
          </label>
          <label>
            Priority Level
            <input
              value={responseForm.priority_level}
              onChange={(e) =>
                setResponseForm({ ...responseForm, priority_level: e.target.value })
              }
            />
          </label>
          <label>
            Due Date
            <input
              type="date"
              value={responseForm.due_date}
              onChange={(e) => setResponseForm({ ...responseForm, due_date: e.target.value })}
            />
          </label>
        </div>
        <button type="button" onClick={handleAddResponse}>
          Save Response
        </button>
      </section>

      <section className="panel status">
        <div>
          <span className="label">Visit ID</span>
          <strong>{visitId || "Not created"}</strong>
        </div>
        <div>
          <span className="label">Current Status</span>
          <strong>{status}</strong>
        </div>
        <div>
          <span className="label">Action</span>
          <button type="button" onClick={handleSubmitVisit}>
            Submit for Review
          </button>
        </div>
      </section>

      {message ? <p className="message">{message}</p> : null}
    </main>
  );
}
