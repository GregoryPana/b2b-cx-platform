import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const QUESTION_CATEGORY_ORDER = [
  "Classic NPS",
  "Relationship Management",
  "Service Performance",
  "Communication & Transparency",
  "Overall Value & Partnership"
];
const NOTICE_STYLE = {
  success: "border-emerald-300 bg-emerald-50 text-emerald-800",
  error: "border-red-300 bg-red-50 text-red-800",
  info: "border-sky-300 bg-sky-50 text-sky-800"
};

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
  const [questions, setQuestions] = useState([]);
  const [questionError, setQuestionError] = useState("");
  const [responsesByQuestion, setResponsesByQuestion] = useState({});
  const [responseDrafts, setResponseDrafts] = useState({});
  const [savingQuestionId, setSavingQuestionId] = useState(null);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);
  const [isCreatingVisit, setIsCreatingVisit] = useState(false);
  const [isSubmittingVisit, setIsSubmittingVisit] = useState(false);
  const [noticeBySection, setNoticeBySection] = useState({
    planned: null,
    create: null,
    response: null,
    submit: null
  });
  const [toast, setToast] = useState(null);

  const [visitForm, setVisitForm] = useState({
    business_id: "1",
    representative_id: "4",
    visit_date: "",
    visit_type: "Planned"
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

  const setSectionNotice = (section, type, text) => {
    setNoticeBySection((prev) => ({
      ...prev,
      [section]: {
        type,
        text,
        id: Date.now()
      }
    }));
  };

  const notify = (type, text) => {
    setToast({
      type,
      text,
      id: Date.now()
    });
  };

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

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
    const loadQuestions = async () => {
      setQuestionError("");
      try {
        const res = await fetch(`${API_BASE}/questions`, { headers });
        const data = await res.json();
        if (!res.ok) {
          setQuestionError(data.detail || "Failed to load questions");
          return;
        }
        setQuestions(data);
        setResponseDrafts((prev) => {
          const next = { ...prev };
          data.forEach((question) => {
            if (!next[question.id]) {
              next[question.id] = {
                score: "",
                verbatim: "",
                action_required: "",
                action_target: "",
                priority_level: "",
                due_date: ""
              };
            }
          });
          return next;
        });
      } catch {
        setQuestionError("Failed to load questions");
      }
    };

    loadQuestions();
  }, [userId, role]);

  const loadDrafts = async ({ silent = false } = {}) => {
    setIsLoadingDrafts(true);
    setBusinessError("");
    try {
      const res = await fetch(`${API_BASE}/visits/drafts`, { headers });
      const data = await res.json();
      if (!res.ok) {
        const errorText = data.detail || "Failed to load draft visits";
        setBusinessError(errorText);
        setSectionNotice("planned", "error", errorText);
        if (!silent) {
          notify("error", errorText);
        }
        return;
      }
      setDraftVisits(data);
      if (!silent) {
        const infoText = data.length
          ? `Loaded ${data.length} draft visit${data.length === 1 ? "" : "s"}.`
          : "No draft visits available.";
        setSectionNotice("planned", "info", infoText);
      }
    } catch {
      const errorText = "Failed to load draft visits";
      setBusinessError(errorText);
      setSectionNotice("planned", "error", errorText);
      if (!silent) {
        notify("error", errorText);
      }
    } finally {
      setIsLoadingDrafts(false);
    }
  };

  useEffect(() => {
    loadDrafts({ silent: true });
  }, [userId, role]);

  const loadVisitResponses = async (targetVisitId) => {
    if (!targetVisitId) {
      setResponsesByQuestion({});
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/visits/${targetVisitId}`, { headers });
      const data = await res.json();
      if (!res.ok) {
        return;
      }

      const nextResponses = {};
      const nextDrafts = {};
      (data.responses || []).forEach((response) => {
        nextResponses[response.question_id] = response;
        nextDrafts[response.question_id] = {
          score: String(response.score ?? ""),
          verbatim: response.verbatim || "",
          action_required: response.action_required || "",
          action_target: response.action_target || "",
          priority_level: response.priority_level || "",
          due_date: response.due_date || ""
        };
      });

      setResponsesByQuestion(nextResponses);
      setResponseDrafts((prev) => ({
        ...prev,
        ...nextDrafts
      }));
    } catch {
      // no-op: non-blocking convenience load
    }
  };

  useEffect(() => {
    loadVisitResponses(visitId);
  }, [visitId, userId, role]);

  useEffect(() => {
    if (visitSource === "new") {
      setSelectedDraftId("");
      setSelectedDraftName("");
    }
  }, [visitSource]);

  const priorityRank = { high: 0, medium: 1, low: 2 };
  const sortPlanned = (items) =>
    [...items].sort((a, b) => {
      const priorityDiff = (priorityRank[a.business_priority] ?? 3) - (priorityRank[b.business_priority] ?? 3);
      if (priorityDiff !== 0) return priorityDiff;
      const dateDiff = (a.visit_date || "").localeCompare(b.visit_date || "");
      if (dateDiff !== 0) return dateDiff;
      return (a.business_name || "").localeCompare(b.business_name || "");
    });

  const plannedToday = sortPlanned(
    draftVisits.filter((visit) => (visit.visit_date || "") === todayString)
  );
  const plannedUpcoming = sortPlanned(
    draftVisits.filter((visit) => (visit.visit_date || "") > todayString)
  );

  const resolveBusinessName = (draft) => {
    if (draft.business_name) return draft.business_name;
    const match = businesses.find((business) => business.id === draft.business_id);
    return match ? match.name : "Business";
  };

  const handleSelectPlannedVisit = (draft) => {
    setSelectedDraftId(draft.visit_id);
    setSelectedDraftName(resolveBusinessName(draft));
    setVisitSource("planned");
    setVisitForm((prev) => ({
      ...prev,
      business_id: String(draft.business_id || ""),
      visit_date: draft.visit_date || "",
      visit_type: "Planned"
    }));
    setVisitId(draft.visit_id);
    setStatus(draft.status || "Draft");
    setActiveTab("survey");
    setSectionNotice("planned", "success", "Planned visit selected. Continue in Survey tab.");
    notify("success", "Planned visit selected.");
  };

  const updateQuestionDraft = (questionId, field, value) => {
    setResponseDrafts((prev) => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || {
          score: "",
          verbatim: "",
          action_required: "",
          action_target: "",
          priority_level: "",
          due_date: ""
        }),
        [field]: value
      }
    }));
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
    setIsCreatingVisit(true);
    setMessage("");
    try {
      if (visitSource === "planned") {
        if (!selectedDraftId) {
          const errorText = "Select a planned visit first.";
          setMessage(errorText);
          setSectionNotice("create", "error", errorText);
          notify("error", errorText);
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
          const errorText = data.detail || "Failed to update planned visit";
          setMessage(errorText);
          setSectionNotice("create", "error", errorText);
          notify("error", errorText);
          return;
        }

        setVisitId(data.visit_id);
        setStatus(data.status || "Draft");
        setMessage("Planned visit updated.");
        setSectionNotice("create", "success", "Planned visit updated and ready for responses.");
        notify("success", "Planned visit updated.");
        await loadDrafts({ silent: true });
        await loadVisitResponses(data.visit_id);
        return;
      }

      const createdBusinessId = await createBusinessIfNeeded();
      if (businessMode === "new" && !createdBusinessId) {
        setSectionNotice("create", "error", "Enter a business name before creating a visit.");
        return;
      }
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
        const errorText = data.detail || "Failed to create visit";
        setMessage(errorText);
        setSectionNotice("create", "error", errorText);
        notify("error", errorText);
        return;
      }

      setVisitId(data.visit_id);
      setStatus(data.status || "Draft");
      setMessage("Visit created.");
      setSectionNotice("create", "success", `Visit ${data.visit_id.slice(0, 8)} created.`);
      notify("success", "Visit created.");
      await loadVisitResponses(data.visit_id);
    } finally {
      setIsCreatingVisit(false);
    }
  };

  const handleSaveQuestionResponse = async (question) => {
    if (!visitId) {
      const errorText = "Create a visit first.";
      setMessage(errorText);
      setSectionNotice("response", "error", errorText);
      notify("error", errorText);
      return;
    }

    const responseForm = responseDrafts[question.id] || {};
    const scoreNum = Number(responseForm.score);
    if (!responseForm.score || Number.isNaN(scoreNum) || scoreNum < 0 || scoreNum > 10) {
      const errorText = `Enter a valid score (0-10) for ${question.category}.`;
      setSectionNotice("response", "error", errorText);
      notify("error", errorText);
      return;
    }

    if (question.is_mandatory && !responseForm.verbatim?.trim()) {
      const errorText = `Verbatim is required for "${question.question_text}".`;
      setSectionNotice("response", "error", errorText);
      notify("error", errorText);
      return;
    }

    if (
      responseForm.action_required?.trim() &&
      (!responseForm.action_target?.trim() || !responseForm.priority_level?.trim())
    ) {
      const errorText = "Action target and priority level are required when action required is filled.";
      setSectionNotice("response", "error", errorText);
      notify("error", errorText);
      return;
    }

    setSavingQuestionId(question.id);
    setMessage("");
    try {
      const payload = {
        question_id: Number(question.id),
        score: scoreNum,
        verbatim: responseForm.verbatim?.trim() || "",
        action_required: responseForm.action_required?.trim() || null,
        action_target: responseForm.action_target?.trim() || null,
        priority_level: responseForm.priority_level?.trim() || null,
        due_date: responseForm.due_date || null
      };

      const existingResponse = responsesByQuestion[question.id];
      const endpoint = existingResponse
        ? `${API_BASE}/visits/${visitId}/responses/${existingResponse.response_id}`
        : `${API_BASE}/visits/${visitId}/responses`;
      const method = existingResponse ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers,
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        const errorText = data.detail || "Failed to add response";
        setMessage(errorText);
        setSectionNotice("response", "error", errorText);
        notify("error", errorText);
        return;
      }
      const successText = existingResponse
        ? `Response updated for ${question.category}.`
        : `Response saved for ${question.category}.`;
      setMessage(successText);
      setSectionNotice("response", "success", successText);
      notify("success", successText);
      await loadVisitResponses(visitId);
    } catch {
      const errorText = "Failed to add response";
      setMessage(errorText);
      setSectionNotice("response", "error", errorText);
      notify("error", errorText);
    } finally {
      setSavingQuestionId(null);
    }
  };

  const handleSubmitVisit = async () => {
    if (!visitId) {
      const errorText = "Create a visit first.";
      setMessage(errorText);
      setSectionNotice("submit", "error", errorText);
      notify("error", errorText);
      return;
    }

    const mandatoryQuestions = questions.filter((question) => question.is_mandatory);
    const unansweredMandatory = mandatoryQuestions.filter(
      (question) => !responsesByQuestion[question.id]
    );
    if (mandatoryQuestions.length > 0 && unansweredMandatory.length > 0) {
      const errorText = `Complete all required questions before submit (${unansweredMandatory.length} remaining).`;
      setSectionNotice("submit", "error", errorText);
      setSectionNotice("response", "error", errorText);
      notify("error", errorText);
      return;
    }

    setIsSubmittingVisit(true);
    try {
      const res = await fetch(`${API_BASE}/visits/${visitId}/submit`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ submit_notes: null })
      });
      const data = await res.json();
      if (!res.ok) {
        const errorText = data.detail || "Failed to submit visit";
        setMessage(errorText);
        setSectionNotice("submit", "error", errorText);
        notify("error", errorText);
        return;
      }
      setStatus(data.status || "Pending");
      const successText = "Visit submitted for review.";
      setMessage(successText);
      setSectionNotice("submit", "success", successText);
      notify("success", successText);
    } catch {
      const errorText = "Failed to submit visit";
      setMessage(errorText);
      setSectionNotice("submit", "error", errorText);
      notify("error", errorText);
    } finally {
      setIsSubmittingVisit(false);
    }
  };

  const groupedQuestions = questions.reduce((acc, question) => {
    if (!acc[question.category]) {
      acc[question.category] = [];
    }
    acc[question.category].push(question);
    return acc;
  }, {});

  const orderedCategories = Object.keys(groupedQuestions).sort((left, right) => {
    const leftIndex = QUESTION_CATEGORY_ORDER.indexOf(left);
    const rightIndex = QUESTION_CATEGORY_ORDER.indexOf(right);
    if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right);
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  });

  const mandatoryQuestions = questions.filter((question) => question.is_mandatory);
  const completedMandatoryCount = mandatoryQuestions.filter(
    (question) => responsesByQuestion[question.id]
  ).length;

  return (
    <main className="page">
      {toast ? (
        <div className="pointer-events-none fixed right-4 top-4 z-50">
          <div
            className={`rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg backdrop-blur ${
              NOTICE_STYLE[toast.type] || NOTICE_STYLE.info
            }`}
          >
            {toast.text}
          </div>
        </div>
      ) : null}
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
            <div className="flex gap-2">
              <button
                type="button"
                className="ghost transition duration-200 hover:-translate-y-0.5 disabled:opacity-60"
                onClick={() => loadDrafts()}
                disabled={isLoadingDrafts}
              >
                {isLoadingDrafts ? "Refreshing..." : "Refresh"}
              </button>
              <button type="button" className="ghost" onClick={() => setActiveTab("survey")}>
                Start Survey
              </button>
            </div>
          </div>
          {noticeBySection.planned ? (
            <p
              className={`mt-3 rounded-xl border px-3 py-2 text-sm ${
                NOTICE_STYLE[noticeBySection.planned.type] || NOTICE_STYLE.info
              }`}
            >
              {noticeBySection.planned.text}
            </p>
          ) : null}
          {plannedToday.length === 0 && plannedUpcoming.length === 0 ? (
            <p className="message">No planned visits for today or later.</p>
          ) : (
            <div className="planned-list">
              {plannedToday.length > 0 ? (
                <div className="planned-group">
                  <span className="group-label">Today</span>
                  {plannedToday.map((draft) => (
                    <button
                      type="button"
                      key={draft.visit_id}
                      className="planned-card"
                      onClick={() => handleSelectPlannedVisit(draft)}
                    >
                      <div>
                        <strong>{resolveBusinessName(draft)}</strong>
                        <div className="planned-badges">
                          <span
                            className={`pill priority-${draft.business_priority || "medium"}`}
                          >
                            {draft.business_priority ? `${draft.business_priority} priority` : "standard priority"}
                          </span>
                          <span
                            className={`pill type-${(draft.visit_type || "Planned").toLowerCase()}`}
                          >
                            {draft.visit_type || "Planned"}
                          </span>
                          <span className="pill outline">
                            {draft.created_by_role && (draft.created_by_role === "Manager" || draft.created_by_role === "Admin")
                              ? "Manager Plan"
                              : "Rep Draft"}
                          </span>
                        </div>
                        <p>Visit ID: {draft.visit_id.slice(0, 8)}</p>
                      </div>
                      <div className="planned-meta">
                        <span>{draft.visit_date}</span>
                        <span>Representative #{draft.representative_id}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
              {plannedUpcoming.length > 0 ? (
                <div className="planned-group">
                  <span className="group-label">Upcoming</span>
                  {plannedUpcoming.map((draft) => (
                    <button
                      type="button"
                      key={draft.visit_id}
                      className="planned-card"
                      onClick={() => handleSelectPlannedVisit(draft)}
                    >
                      <div>
                        <strong>{resolveBusinessName(draft)}</strong>
                        <div className="planned-badges">
                          <span
                            className={`pill priority-${draft.business_priority || "medium"}`}
                          >
                            {draft.business_priority ? `${draft.business_priority} priority` : "standard priority"}
                          </span>
                          <span
                            className={`pill type-${(draft.visit_type || "Planned").toLowerCase()}`}
                          >
                            {draft.visit_type || "Planned"}
                          </span>
                          <span className="pill outline">
                            {draft.created_by_role && (draft.created_by_role === "Manager" || draft.created_by_role === "Admin")
                              ? "Manager Plan"
                              : "Rep Draft"}
                          </span>
                        </div>
                        <p>Visit ID: {draft.visit_id.slice(0, 8)}</p>
                      </div>
                      <div className="planned-meta">
                        <span>{draft.visit_date}</span>
                        <span>Representative #{draft.representative_id}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
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
                        visit_type: "Planned"
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
                disabled={visitSource === "planned"}
              >
                <option>Planned</option>
                <option>Priority</option>
                <option>Substitution</option>
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={handleCreateVisit}
            disabled={isCreatingVisit}
            className="transition duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCreatingVisit
              ? "Saving..."
              : visitSource === "planned"
              ? "Update Planned Visit"
              : "Create Draft Visit"}
          </button>
          {noticeBySection.create ? (
            <p
              className={`mt-3 rounded-xl border px-3 py-2 text-sm ${
                NOTICE_STYLE[noticeBySection.create.type] || NOTICE_STYLE.info
              }`}
            >
              {noticeBySection.create.text}
            </p>
          ) : null}
          {businessError ? <p className="message">{businessError}</p> : null}
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-header">
          <h2>Required Questions by Category</h2>
          <span className="pill muted">
            Required completed: {completedMandatoryCount}/{mandatoryQuestions.length}
          </span>
        </div>
        {questionError ? <p className="message">{questionError}</p> : null}
        {orderedCategories.length === 0 ? (
          <p className="message">No questions configured yet.</p>
        ) : (
          <div className="question-groups">
            {orderedCategories.map((category) => (
              <section key={category} className="question-group">
                <h3>{category}</h3>
                <div className="question-list">
                  {groupedQuestions[category].map((question) => {
                    const draft = responseDrafts[question.id] || {};
                    const existingResponse = responsesByQuestion[question.id];
                    const isSavingThisQuestion = savingQuestionId === question.id;
                    return (
                      <article key={question.id} className="question-card">
                        <div className="question-head">
                          <strong>{question.question_text}</strong>
                          <div className="question-tags">
                            {question.is_mandatory ? <span className="pill">Required</span> : null}
                            {question.is_nps ? <span className="pill type-planned">NPS</span> : null}
                            {existingResponse ? <span className="pill priority-low">Saved</span> : null}
                          </div>
                        </div>
                        <div className="grid">
                          <label>
                            Score (0-10)
                            <input
                              type="number"
                              min="0"
                              max="10"
                              value={draft.score || ""}
                              onChange={(event) =>
                                updateQuestionDraft(question.id, "score", event.target.value)
                              }
                            />
                          </label>
                          <label className="full">
                            Verbatim
                            <textarea
                              value={draft.verbatim || ""}
                              onChange={(event) =>
                                updateQuestionDraft(question.id, "verbatim", event.target.value)
                              }
                            />
                          </label>
                          <label>
                            Action Required
                            <input
                              value={draft.action_required || ""}
                              onChange={(event) =>
                                updateQuestionDraft(question.id, "action_required", event.target.value)
                              }
                            />
                          </label>
                          <label>
                            Action Target
                            <input
                              value={draft.action_target || ""}
                              onChange={(event) =>
                                updateQuestionDraft(question.id, "action_target", event.target.value)
                              }
                            />
                          </label>
                          <label>
                            Priority Level
                            <input
                              value={draft.priority_level || ""}
                              onChange={(event) =>
                                updateQuestionDraft(question.id, "priority_level", event.target.value)
                              }
                            />
                          </label>
                          <label>
                            Due Date
                            <input
                              type="date"
                              value={draft.due_date || ""}
                              onChange={(event) =>
                                updateQuestionDraft(question.id, "due_date", event.target.value)
                              }
                            />
                          </label>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSaveQuestionResponse(question)}
                          disabled={isSavingThisQuestion}
                          className="transition duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isSavingThisQuestion
                            ? "Saving..."
                            : existingResponse
                            ? "Update Response"
                            : "Save Response"}
                        </button>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
        {noticeBySection.response ? (
          <p
            className={`mt-3 rounded-xl border px-3 py-2 text-sm ${
              NOTICE_STYLE[noticeBySection.response.type] || NOTICE_STYLE.info
            }`}
          >
            {noticeBySection.response.text}
          </p>
        ) : null}
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
          <button
            type="button"
            onClick={handleSubmitVisit}
            disabled={isSubmittingVisit}
            className="transition duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmittingVisit ? "Submitting..." : "Submit for Review"}
          </button>
        </div>
      </section>

      {noticeBySection.submit ? (
        <p
          className={`mt-3 rounded-xl border px-3 py-2 text-sm ${
            NOTICE_STYLE[noticeBySection.submit.type] || NOTICE_STYLE.info
          }`}
        >
          {noticeBySection.submit.text}
        </p>
      ) : null}

      {message ? <p className="message">{message}</p> : null}
    </main>
  );
}
