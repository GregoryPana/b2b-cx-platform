import { useEffect, useRef, useState } from "react";

const API_BASE =
  import.meta.env.VITE_API_URL ||
  `http://${window.location.hostname}:8000`;
const CACHE_BUST = `?_v=${new Date().toISOString()}_${Math.random()}`;

console.log("🔍 FRESH APP LOADED - NEW VERSION TO FORCE CACHE CLEAR");
console.log(`🌐 API Base: ${import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`}`);
console.log(`🚀 Cache Buster: ${CACHE_BUST}`);
console.log("📋 This is a completely fresh version - no cache should exist!");
console.log("🎯 If you see this, visit updates should work perfectly!");

const QUESTION_CATEGORY_ORDER = [
  "Category 1: Relationship Strength",
  "Category 2: Service & Operational Performance",
  "Category 3: Commercial & Billing",
  "Category 4: Competitive & Portfolio Intelligence",
  "Category 5: Growth & Expansion",
  "Category 6: Advocacy"
];
const Q16_KEY = "q16_other_provider_products";
const Q17_KEY = "q17_competitor_products_services";
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
  const [questions, setQuestions] = useState([]);
  const [questionError, setQuestionError] = useState("");
  const [draftVisits, setDraftVisits] = useState([]);
  const [selectedDraftId, setSelectedDraftId] = useState("");
  const [selectedDraftName, setSelectedDraftName] = useState("");
  const [visitSource, setVisitSource] = useState("new");
  const [visitForm, setVisitForm] = useState({
    business_id: "",
    representative_id: "",
    visit_date: "",
    visit_type: "Planned"
  });
  const [responsesByQuestion, setResponsesByQuestion] = useState({});
  const [responseDrafts, setResponseDrafts] = useState({});
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [savingQuestionId, setSavingQuestionId] = useState(null);
  const [isSubmittingVisit, setIsSubmittingVisit] = useState(false);
  const [sectionNotice, setSectionNotice] = useState({});
  const [newBusinessName, setNewBusinessName] = useState("");
  const [businessMode, setBusinessMode] = useState("existing");

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`
  };

  const notify = (type, text) => {
    if (type === "success") {
      console.log(`✅ ${text}`);
    } else if (type === "error") {
      console.error(`❌ ${text}`);
    }
  };

  // Load questions
  useEffect(() => {
    const loadQuestions = async () => {
      setQuestionError("");
      try {
        const res = await fetch(`${API_BASE}/questions${CACHE_BUST}`, { headers });
        const data = await res.json();
        if (!res.ok) {
          setQuestionError(data.detail || "Failed to load questions");
          return;
        }
        setQuestions(data);
      } catch {
        setQuestionError("Failed to load questions");
      }
    };

    loadQuestions();
  }, [userId, role]);

  // Load businesses
  useEffect(() => {
    const loadBusinesses = async () => {
      setBusinessError("");
      try {
        const res = await fetch(`${API_BASE}/survey-businesses${CACHE_BUST}`, { headers });
        const data = await res.json();
        if (!res.ok) {
          setBusinessError(data.detail || "Failed to load businesses");
          return;
        }
        setBusinesses(data);
      } catch {
        setBusinessError("Failed to load businesses");
      }
    };

    loadBusinesses();
  }, [userId, role]);

  // Load draft visits
  useEffect(() => {
    const loadDrafts = async ({ silent = false } = {}) => {
      setIsLoadingDrafts(true);
      setBusinessError("");
      try {
        const res = await fetch(`${API_BASE}/dashboard-visits/drafts${CACHE_BUST}`, { headers });
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
            ? `Loaded ${data.length} draft visits.`
            : "No draft visits available.";
          setSectionNotice("planned", "info", infoText);
          notify("info", infoText);
        }
      } finally {
        setIsLoadingDrafts(false);
      }
    };

    loadDrafts({ silent: true });
  }, [userId, role]);

  // Load visit responses
  useEffect(() => {
    const loadVisitResponses = async (targetVisitId) => {
      if (!targetVisitId) {
        setResponsesByQuestion({});
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/dashboard-visits/${targetVisitId}${CACHE_BUST}`, { headers });
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
            answer_text: response.answer_text || "",
            verbatim: response.verbatim || "",
            actions: (response.actions || []).map((action) => ({
              action_required: action.action_required || "",
              action_owner: action.action_owner || "",
              action_timeframe: action.action_timeframe || "",
              action_support_needed: action.action_support_needed || ""
            }))
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

    loadVisitResponses(visitId);
  }, [visitId, userId, role]);

  // Update planned visit
  const handleUpdatePlannedVisit = async () => {
    if (visitSource === "planned") {
      if (!selectedDraftId) {
        const errorText = "Select a planned visit first.";
        setMessage(errorText);
        setSectionNotice("create", "error", errorText);
        notify("error", errorText);
        return;
      }

      const res = await fetch(`${API_BASE}/dashboard-visits/${selectedDraftId}/draft${CACHE_BUST}`, {
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

    const res = await fetch(`${API_BASE}/dashboard-visits${CACHE_BUST}`, {
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
    setSectionNotice("create", "success", "Visit created and ready for responses.");
    notify("success", "Visit created.");
    await loadDrafts({ silent: true });
    await loadVisitResponses(data.visit_id);
  };

  const createBusinessIfNeeded = async () => {
    if (businessMode !== "new") return null;

    const name = newBusinessName.trim();
    if (!name) {
      setMessage("Enter a business name or choose from the list.");
      return null;
    }

    const res = await fetch(`${API_BASE}/businesses${CACHE_BUST}`, {
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

  const saveResponse = async (question) => {
    setSavingQuestionId(question.id);
    setMessage("");
    setSectionNotice("response", "", "");

    const scoreNum = Number(question.input_type === "score" ? responseDrafts[question.id]?.score : 0);

    const normalizedActions = (responseDrafts[question.id]?.actions || [])
      .filter((action) => action.action_required.trim() !== "")
      .map((action) => ({
        action_required: action.action_required,
        action_owner: action.action_owner,
        action_timeframe: action.action_timeframe,
        action_support_needed: action.action_support_needed
      }));

    const payload = {
      question_id: Number(question.id),
      score: question.input_type === "score" ? scoreNum : null,
      answer_text:
        question.input_type === "score"
          ? null
          : question.input_type === "yes_no"
          ? responseDrafts[question.id]?.answer_text || null
          : question.input_type === "always_sometimes_never"
          ? responseDrafts[question.id]?.answer_text || null
          : responseDrafts[question.id]?.answer_text?.trim() || null,
      verbatim: responseDrafts[question.id]?.verbatim?.trim() || null,
      actions: normalizedActions
    };

    const existingResponse = responsesByQuestion[question.id];
    const endpoint = existingResponse
      ? `${API_BASE}/dashboard-visits${visitId}/responses/${existingResponse.response_id}${CACHE_BUST}`
      : `${API_BASE}/dashboard-visits/${visitId}/responses${CACHE_BUST}`;
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
  };

  const deleteAction = (questionId, index) => {
    setResponseDrafts((prev) => {
      const current = prev[questionId] || {};
      const next = {
        ...current,
        actions: (current.actions || []).filter((_, i) => i !== index)
      };
      return {
        ...prev,
        [questionId]: next
      };
    });
  };

  const updateAction = (questionId, field, value) => {
    setResponseDrafts((prev) => {
      const current = prev[questionId] || {};
      const actions = (current.actions || []).map((action) => ({
        action_required: action.action_required,
        action_owner: action.action_owner,
        action_timeframe: action.action_timeframe,
        action_support_needed: action.action_support_needed
      }));
      return {
        ...prev,
        [questionId]: {
          ...current,
          [field]: value,
          actions
        }
      };
    });
  };

  const resolveBusinessName = (businessId) => {
    const match = businesses.find((business) => business.id === businessId);
    return match ? match.name : "Business";
  };

  const getDraftProgressLabel = (draft) => {
    const answered = draft.mandatory_answered_count ?? 0;
    const total = draft.mandatory_total_count ?? 0;
    if (draft.is_completed) {
      return {
        text: total > 0 ? `Ready to submit (${answered}/${total})` : "Ready to submit",
        className: "progress-complete"
      };
    }
    if (draft.is_started) {
      return {
        text: total > 0 ? `In progress (${answered}/${total})` : "In progress",
        className: "progress-started"
      };
    }
    return {
      text: total > 0 ? `Not started (0/${total})` : "Not started",
      className: "progress-not-started"
    };
  };

  const handleSelectPlannedVisit = (draft) => {
    setSelectedDraftId(draft.visit_id);
    setSelectedDraftName(resolveBusinessName(draft.business_id));
    setVisitSource("planned");
    setVisitForm((prev) => ({
      ...prev,
      business_id: String(draft.business_id)
    }));
  };

  const todayString = new Date().toISOString().split("T")[0];

  const todaysDrafts = draftVisits.filter(
    (visit) => (visit.visit_date || "") === todayString
  );
  const futureDrafts = draftVisits.filter(
    (visit) => (visit.visit_date || "") > todayString
  );

  const visibleQuestions = questions.filter((question) => question.question_key !== Q17_KEY);

  const groupedQuestions = visibleQuestions.reduce((acc, question) => {
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

  const mandatoryQuestions = visibleQuestions.filter((question) => question.is_mandatory);
  const completedMandatoryCount = mandatoryQuestions.filter(
    (question) => responsesByQuestion[question.id]
  ).length;

  const groupedQuestions = visibleQuestions.reduce((acc, question) => {
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

  const mandatoryQuestions = visibleQuestions.filter((question) => question.is_mandatory);
  const completedMandatoryCount = mandatoryQuestions.filter(
    (question) => responsesByQuestion[question.id]
  ).length;

  const handleSubmitVisit = async () => {
    if (!visitId) {
      const errorText = "Create a visit first.";
      setMessage(errorText);
      setSectionNotice("submit", "error", errorText);
      notify("error", errorText);
      return;
    }

    const mandatoryQuestions = visibleQuestions.filter((question) => question.is_mandatory);
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
      const res = await fetch(`${API_BASE}/dashboard-visits/${visitId}/submit${CACHE_BUST}`, {
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

  return (
    <main className="page">
      <section className="panel">
        <div className="panel-header">
          <h2>📊 Available Programs</h2>
          {programs.length > 0 ? (
            <ul>
              {programs.map(program => (
                <li key={program.id}>
                  <strong>{program.name}</strong> ({program.code})
                  <br />
                  <small>{program.description}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p>No programs loaded</p>
          )}
        </div>
        
        <div>
          <h2>🏢 B2B Businesses</h2>
          {businesses.length > 0 ? (
            <ul>
              {businesses.map(business => (
                <li key={business.id}>
                  <strong>{business.name}</strong>
                  <br />
                  <small>{business.location} - Priority: {business.priority_level}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p>No businesses loaded</p>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>📋 Planned Visits</h2>
          <span className="pill muted">
            {isLoadingDrafts ? "Loading..." : `${draftVisits.length} visits`}
          </span>
        </div>
        {businessError ? <p className="message">{businessError}</p> : null}
        {isLoadingDrafts ? (
          <p className="message">Loading planned visits...</p>
        ) : draftVisits.length === 0 ? (
          <p className="message">No planned visits for today or later.</p>
        ) : (
          <div className="visit-list">
            <div className="visit-group">
              <h3>📅 Today</h3>
              {todaysDrafts.map((draft) => (
                <div
                  key={draft.visit_id}
                  className={`visit-card ${selectedDraftId === draft.visit_id ? "selected" : ""}`}
                  onClick={() => handleSelectPlannedVisit(draft)}
                >
                  <div className="visit-header">
                    <strong>{resolveBusinessName(draft.business_id)}</strong>
                    <span className={`pill ${getDraftProgressLabel(draft).className}`}>
                      {getDraftProgressLabel(draft).text}
                    </span>
                  </div>
                  <div className="visit-details">
                    <div><strong>Date:</strong> {draft.visit_date || "Not set"}</div>
                    <div><strong>Type:</strong> {draft.visit_type || "Not set"}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="visit-group">
              <h3>📅 Future</h3>
              {futureDrafts.map((draft) => (
                <div
                  key={draft.visit_id}
                  className={`visit-card ${selectedDraftId === draft.visit_id ? "selected" : ""}`}
                  onClick={() => handleSelectPlannedVisit(draft)}
                >
                  <div className="visit-header">
                    <strong>{resolveBusinessName(draft.business_id)}</strong>
                    <span className={`pill ${getDraftProgressLabel(draft).className}`}>
                      {getDraftProgressLabel(draft).text}
                    </span>
                  </div>
                  <div className="visit-details">
                    <div><strong>Date:</strong> {draft.visit_date || "Not set"}</div>
                    <div><strong>Type:</strong> {draft.visit_type || "Not set"}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>✍ Create New Visit</h2>
          <span className="pill muted">
            Required completed: {completedMandatoryCount}/{mandatoryQuestions.length}
          </span>
        </div>
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

        <div className="form-group">
          <label className="form-label">Visit Source</label>
          <select
            value={visitSource}
            onChange={(e) => setVisitSource(e.target.value)}
            disabled={visitSource === "planned"}
          >
            <option value="new">Create New Business</option>
            <option value="existing">Use Existing Business</option>
            <option value="planned">Planned Visits</option>
          </select>
        </div>

        {visitSource === "new" ? (
          <>
            <div className="form-group">
              <label className="form-label">Business</label>
              <select
                value={visitForm.business_id}
                onChange={(e) => setVisitForm((prev) => ({ ...prev, business_id: e.target.value }))}
                disabled={businesses.length === 0}
              >
                <option value="">Select a business</option>
                {businesses.map((business) => (
                  <option key={business.id} value={business.id}>
                    {business.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Business Name</label>
              <input
                type="text"
                value={newBusinessName}
                onChange={(e) => setNewBusinessName(e.target.value)}
                placeholder="Enter new business name"
                disabled={businessMode !== "new"}
              />
            </div>
          </>
        ) : visitSource === "existing" ? (
          <>
            <div className="form-group">
              <label className="form-label">Business</label>
              <select
                value={visitForm.business_id}
                onChange={(e) => setVisitForm((prev) => ({ ...prev, business_id: e.target.value }))}
                disabled={businesses.length === 0}
              >
                <option value="">Select a business</option>
                {businesses.map((business) => (
                  <option key={business.id} value={business.id}>
                    {business.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : visitSource === "planned" ? (
          <>
            <div className="form-group">
              <label className="form-label">Select Planned Visit</label>
              <select
                value={selectedDraftId}
                onChange={(e) => {
                  const draft = draftVisits.find((item) => item.visit_id === e.target.value);
                  handleSelectPlannedVisit(draft);
                }}
                disabled={draftVisits.length === 0}
              >
                <option value="">Select a planned visit</option>
                {draftVisits.map((draft) => (
                  <option key={draft.visit_id} value={draft.visit_id}>
                    {resolveBusinessName(draft.business_id)} - {draft.visit_date}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Representative</label>
              <select
                value={visitForm.representative_id}
                onChange={(e) => setVisitForm((prev) => ({ ...prev, representative_id: e.target.value }))}
              >
                <option value="">Select a representative</option>
                <option value="4">Representative 4</option>
                <option value="3">Representative 3</option>
                <option value="2">Representative 2</option>
                <option value="1">Representative 1</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Visit Date</label>
              <input
                type="date"
                value={visitForm.visit_date}
                onChange={(e) => setVisitForm((prev) => ({ ...prev, visit_date: e.target.value }))}
                disabled={visitSource === "planned"}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Visit Type</label>
              <select
                value={visitForm.visit_type}
                onChange={(e) => setVisitForm((prev) => ({ ...prev, visit_type: e.target.value }))}
                disabled={visitSource === "planned"}
              >
                <option value="Planned">Planned</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Unscheduled">Unscheduled</option>
                <option value="Emergency">Emergency</option>
              </select>
            </div>
            <div className="form-actions">
              <button
                onClick={handleUpdatePlannedVisit}
                disabled={visitSource !== "planned"}
                className="btn btn-primary"
              >
                Update Planned Visit
              </button>
              <button
                onClick={handleSubmitVisit}
                className="btn btn-primary"
                disabled={visitSource === "planned"}
              >
                Create Visit
              </button>
            </div>
          </>
        )}
      </section>

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
                <div className="question-group-header">
                  <h3>{category}</h3>
                  <span className="category-chip">
                    {groupedQuestions[category].length} question
                    {groupedQuestions[category].length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="question-list">
                  {groupedQuestions[category].map((question) => {
                    const draft = responseDrafts[question.id] || {};
                    const existingResponse = responsesByQuestion[question.id];
                    const isSavingThisQuestion = savingQuestionId === question.id;
                    return (
                      <article key={question.id} className="question-card">
                        <div className="question-head">
                          <strong>
                            Q{question.order_index}. {question.question_text}
                          </strong>
                          <div className="question-tags">
                            {question.is_mandatory ? <span className="pill">Required</span> : null}
                            {question.is_nps ? <span className="pill type-planned">NPS</span> : null}
                            {existingResponse ? <span className="pill priority-low">Saved</span> : null}
                          </div>
                        </div>
                        <div className="question-body">
                          {question.input_type === "score" ? (
                            <input
                              type="number"
                              min={question.score_min}
                              max={question.score_max}
                              value={draft.score}
                              onChange={(e) => updateAction(question.id, "score", e.target.value)}
                              disabled={isSavingThisQuestion}
                            />
                          ) : question.input_type === "yes_no" ? (
                            <select
                              value={draft.answer_text}
                              onChange={(e) => updateAction(question.id, "answer_text", e.target.value)}
                              disabled={isSavingThisQuestion}
                            >
                              <option value="">Select answer</option>
                              <option value="Y">Yes</option>
                              <option value="N">No</option>
                            </select>
                          ) : question.input_type === "always_sometimes_never" ? (
                            <select
                              value={draft.answer_text}
                              onChange={(e) => updateAction(question.id, "answer_text", e.target.value)}
                              disabled={isSavingThisQuestion}
                            >
                              <option value="">Select answer</option>
                              <option value="Always">Always</option>
                              <option value="Sometimes">Sometimes</option>
                              <option value="Never">Never</option>
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={draft.answer_text}
                              onChange={(e) => updateAction(question.id, "answer_text", e.target.value)}
                              placeholder={question.helper_text}
                              disabled={isSavingThisQuestion}
                            />
                          )}

                          {question.input_type === "yes_no" && question.requires_issue && draft.answer_text === "Y" ? (
                            <div className="form-group">
                              <label className="form-label">Describe the issue</label>
                              <textarea
                                value={draft.verbatim}
                                onChange={(e) => updateAction(question.id, "verbatim", e.target.value)}
                                placeholder="Please describe the issue experienced"
                                disabled={isSavingThisQuestion}
                              />
                            </div>
                          ) : null}

                          {question.input_type === "always_sometimes_never" && question.requires_escalation && draft.answer_text === "Sometimes" || draft.answer_text === "Never" ? (
                            <div className="form-group">
                              <label className="form-label">Escalation details</label>
                              <textarea
                                value={draft.verbatim}
                                onChange={(e) => updateAction(question.id, "verbatim", e.target.value)}
                                placeholder="Please provide escalation details"
                                disabled={isSavingThisQuestion}
                              />
                            </div>
                          ) : null}

                          {question.input_type === "always_sometimes_never" && question.requires_escalation && draft.answer_text === "Always" ? (
                            <div className="form-group">
                              <label className="form-label">Action items</label>
                              <div className="action-list">
                                {draft.actions.map((action, index) => (
                                  <div key={index} className="action-item">
                                    <button
                                      type="button"
                                      className="btn btn-small btn-remove"
                                      onClick={() => deleteAction(question.id, index)}
                                      disabled={isSavingThisQuestion}
                                    >
                                      ×
                                    </button>
                                    <input
                                      type="text"
                                      value={action.action_required}
                                      onChange={(e) => updateAction(question.id, `actions.${index}.action_required`, e.target.value)}
                                      placeholder="Action required"
                                      disabled={isSavingThisQuestion}
                                    />
                                    <input
                                      type="text"
                                      value={action.action_owner}
                                      onChange={(e) => updateAction(question.id, `actions.${index}.action_owner`, e.target.value)}
                                      placeholder="Owner"
                                      disabled={isSavingThisQuestion}
                                    />
                                    <input
                                      type="text"
                                      value={action.action_timeframe}
                                      onChange={(e) => updateAction(question.id, `actions.${index}.action_timeframe`, e.target.value)}
                                      placeholder="Timeframe"
                                      disabled={isSavingThisQuestion}
                                    />
                                    <input
                                      type="text"
                                      value={action.action_support_needed}
                                      onChange={(e) => updateAction(question.id, `actions.${index}.action_support_needed`, e.target.value)}
                                      placeholder="Support needed"
                                      disabled={isSavingThisQuestion}
                                    />
                                  </div>
                                ))}
                              </div>
                              <button
                                type="button"
                                className="btn btn-small btn-add"
                                onClick={() => updateAction(question.id, "actions", [
                                  ...(draft.actions || []),
                                  {
                                    action_required: "",
                                    action_owner: "",
                                    action_timeframe: "",
                                    action_support_needed: ""
                                  }
                                ])}
                                disabled={isSavingThisQuestion}
                              >
                                + Add Action
                              </button>
                            </div>
                          ) : null}
                        </div>
                        <div className="question-footer">
                          <button
                            onClick={() => saveResponse(question)}
                            disabled={isSavingThisQuestion}
                            className="btn btn-primary"
                          >
                            {isSavingThisQuestion ? "Saving..." : existingResponse ? "Update Response" : "Save Response"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Submit Visit</h2>
          <span className="pill muted">
            Status: {status} ({completedMandatoryCount}/{mandatoryQuestions.length})
          </span>
        </div>
        {message ? <p className="message">{message}</p> : null}
        {noticeBySection.submit ? (
          <p
            className={`mt-3 rounded-xl border px-3 py-2 text-sm ${
              NOTICE_STYLE[noticeBySection.submit.type] || NOTICE_STYLE.info
            }`}
          >
            {noticeBySection.submit.text}
          </p>
        ) : null}
        <button
          onClick={handleSubmitVisit}
          disabled={!visitId || isSubmittingVisit}
          className="btn btn-primary"
        >
          {isSubmittingVisit ? "Submitting..." : "Submit Visit"}
        </button>
      </section>
    </main>
  );
}
