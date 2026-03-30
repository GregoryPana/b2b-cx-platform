import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ClipboardList,
  ShieldCheck,
  Timer,
  UploadCloud,
  ListChecks,
  History as HistoryIcon,
  BookOpen,
} from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const SCORE_OPTIONS = [1, 2, 3, 4, 5];

const FALLBACK_QUESTIONS = [
  {
    question_number: 1,
    category: "Technical Performance & Network Standards",
    question_text: "Is the drop cable within installation length standard (max 3 poles / 180 m)?",
  },
  {
    question_number: 2,
    category: "Technical Performance & Network Standards",
    question_text: "Is there enough cable slack at the FDP and is the correct port used?",
  },
  {
    question_number: 3,
    category: "Technical Performance & Network Standards",
    question_text: "Is trunking/internal cable secured with approved clips or screws?",
  },
  {
    question_number: 4,
    category: "Technical Performance & Network Standards",
    question_text: "Does the auditor confirm optimal signal/power and correct provisioning?",
  },
  {
    question_number: 5,
    category: "Physical Routing & Aesthetic Quality",
    question_text: "Are cables neatly routed, clipped evenly, and CPE devices placed cleanly?",
  },
  {
    question_number: 6,
    category: "Safety & Infrastructure Integrity",
    question_text: "Are exterior penetrations sealed, grounded, and using outdoor-rated cabling?",
  },
  {
    question_number: 7,
    category: "Site Cleanliness & Property Damage",
    question_text: "Is the site free of debris or damage caused by the installation team?",
  },
];

const SAMPLE_ASSIGNMENTS = [
  {
    id: "IA-DEMO-001",
    customer: "Garden City Exchange",
    customerType: "B2B",
    location: "Lusaka",
    window: "09:00 - 11:00",
    date: "2026-03-18",
    executionParty: "Field Team",
    team: "Metro Fibre Crew",
    contact: "Patricia Nkonde",
    priority: "Today",
  },
  {
    id: "IA-DEMO-002",
    customer: "Roma Park Residences",
    customerType: "B2C",
    location: "Lusaka",
    window: "13:00 - 15:00",
    date: "2026-03-18",
    executionParty: "Field Team",
    team: "South Ops Team",
    contact: "Precious Mwansa",
    priority: "Today",
  },
  {
    id: "IA-DEMO-003",
    customer: "Manda Hill Retail",
    customerType: "B2B",
    location: "Lusaka",
    window: "Tomorrow",
    date: "2026-03-19",
    executionParty: "Contractor",
    team: "Delta Cabling",
    contact: "Simon Lungu",
    priority: "Watch",
  },
  {
    id: "IA-DEMO-004",
    customer: "Ndola Innovation Lab",
    customerType: "B2B",
    location: "Ndola",
    window: "Friday",
    date: "2026-03-20",
    executionParty: "Field Team",
    team: "Northern Response",
    contact: "Zoe Chapi",
    priority: "Prep",
  },
];

const HEADER_TEMPLATE = {
  inspectorName: "",
  customerName: "",
  customerType: "B2B",
  location: "",
  workDate: "",
  executionParty: "Field Team",
  teamName: "",
  contractorName: "",
};

const buildInitialResponses = (questions) => {
  return questions.reduce((acc, question, index) => {
    const number = getQuestionNumber(question, index);
    acc[number] = { score: "", notes: "" };
    return acc;
  }, {});
};

const bandForScore = (score) => {
  if (!score && score !== 0) return {
    key: "pending",
    label: "Incomplete",
    detail: "Fill in all seven scores to calculate",
  };
  if (score >= 4) return { key: "excellent", label: "Pass · Excellent", detail: "No follow-up required" };
  if (score >= 3) return { key: "needs-improvement", label: "Pass · Needs Improvement", detail: "Log the fix before closing" };
  if (score >= 2) return { key: "rework", label: "Fail · Rework Required", detail: "Issue work order" };
  return { key: "critical", label: "Critical Fail", detail: "Escalate immediately" };
};

const headerFieldsComplete = (header) => {
  if (!header.inspectorName || !header.customerName || !header.location || !header.workDate || !header.executionParty) {
    return false;
  }
  if (header.executionParty === "Field Team" && !header.teamName) return false;
  if (header.executionParty === "Contractor" && !header.contractorName) return false;
  return true;
};

function ScoreButtons({ value, onChange }) {
  return (
    <div className="score-buttons" role="group" aria-label="Score from 1 to 5">
      {SCORE_OPTIONS.map((score) => (
        <button
          key={score}
          type="button"
          className={Number(value) === score ? "selected" : ""}
          onClick={() => onChange(score)}
        >
          {score}
        </button>
      ))}
    </div>
  );
}

  const assignments = SAMPLE_ASSIGNMENTS;
const initialAssignment = assignments.length ? assignments[0] : null;

export default function App() {
  const [activeAssignmentId, setActiveAssignmentId] = useState(initialAssignment?.id ?? null);
  const [questionBank, setQuestionBank] = useState(FALLBACK_QUESTIONS);
  const [header, setHeader] = useState(() => (initialAssignment ? hydrateHeaderFromAssignment(initialAssignment) : { ...HEADER_TEMPLATE }));
  const [responses, setResponses] = useState(buildInitialResponses(FALLBACK_QUESTIONS));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [activeModule, setActiveModule] = useState("Capture");

  const activeAssignment = assignments.find((item) => item.id === activeAssignmentId);

  const groupedQuestions = useMemo(() => {
    return questionBank.reduce((acc, question) => {
      const category = question.category || "General";
      if (!acc[category]) acc[category] = [];
      acc[category].push(question);
      return acc;
    }, {});
  }, [questionBank]);

  const summary = useMemo(() => {
    const completedScores = questionBank
      .map((question, index) => {
        const number = getQuestionNumber(question, index);
        return Number(responses[number]?.score);
      })
      .filter((score) => !Number.isNaN(score));
    const total = completedScores.reduce((sum, value) => sum + value, 0);
    const average = completedScores.length ? total / completedScores.length : null;
    const completion = completedScores.length / questionBank.length;
    const riskItems = questionBank.filter((question, index) => {
      const number = getQuestionNumber(question, index);
      const score = Number(responses[number]?.score);
      return !Number.isNaN(score) && score <= 2;
    });
    const safetyFlags = questionBank.filter((question, index) => {
      const number = getQuestionNumber(question, index);
      const score = Number(responses[number]?.score);
      return question.category.includes("Safety") && !Number.isNaN(score) && score <= 2;
    });
    const band = bandForScore(average);

    const categories = Object.entries(groupedQuestions).map(([category, list]) => {
      const subset = list
        .map((question, idx) => {
          const number = getQuestionNumber(question, idx);
          return Number(responses[number]?.score);
        })
        .filter((score) => !Number.isNaN(score));
      const catAverage = subset.length ? subset.reduce((sum, value) => sum + value, 0) / subset.length : null;
      return { category, average: catAverage };
    });

    return {
      average,
      completion,
      completedAll: completion === 1,
      riskItems,
      safetyFlags,
      band,
      categories,
    };
  }, [responses, groupedQuestions]);

  const readyToSubmit = summary.completedAll && headerFieldsComplete(header);

  const handleFieldChange = (field, value) => {
    setHeader((prev) => ({ ...prev, [field]: value }));
  };

  const handleScoreChange = (questionNumber, value) => {
    setResponses((prev) => ({
      ...prev,
      [questionNumber]: {
        ...prev[questionNumber],
        score: value,
      },
    }));
  };

  const handleNoteChange = (questionNumber, value) => {
    setResponses((prev) => ({
      ...prev,
      [questionNumber]: {
        ...prev[questionNumber],
        notes: value,
      },
    }));
  };

  const handleSelectAssignment = (assignment) => {
    setActiveAssignmentId(assignment.id);
    setHeader((prev) => ({ ...prev, ...hydrateHeaderFromAssignment(assignment) }));
    setMessage("");
    setError("");
  };

  const loadQuestions = async () => {
    setLoadingQuestions(true);
    try {
      const res = await fetch(`${API_BASE}/installation/questions`);
      if (!res.ok) throw new Error("Failed to load questions");
      const data = await res.json();
      if (Array.isArray(data) && data.length) {
        setQuestionBank(data);
        setResponses(buildInitialResponses(data));
      }
    } catch {
      // fallback already loaded
    } finally {
      setLoadingQuestions(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/installation/assessments?limit=5`);
      if (!res.ok) throw new Error("Failed to load history");
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions();
    loadHistory();
  }, []);

  const handleSaveDraft = () => {
    setMessage(`Draft saved for ${header.customerName || "current assignment"}.`);
    setError("");
  };

  const handleSubmit = async () => {
    setError("");
    setMessage("");
    if (!readyToSubmit) {
      setError("Complete inspector/header fields and all seven scores before submitting.");
      return;
    }

    const payload = buildPayload(header, questionBank, responses);
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/installation/assessments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || "Failed to submit assessment");
        return;
      }
      setMessage(`Assessment submitted for ${data.customer_name || payload.customer_name}.`);
      setResponses(buildInitialResponses(questionBank));
      await loadHistory();
    } catch {
      setError("Network error submitting assessment");
    } finally {
      setSaving(false);
    }
  };

  const outstandingChecks = questionBank.length - questionBank.filter((question, index) => responses[getQuestionNumber(question, index)]?.score).length;
  const historyRows = history;

  const handleClearAll = () => {
    setHeader({ ...HEADER_TEMPLATE });
    setResponses(buildInitialResponses(questionBank));
    setHistory([]);
    setHistoryLoading(false);
    setActiveAssignmentId(initialAssignment?.id ?? null);
    setMessage("");
    setError("");
  };

  const renderAssignmentsView = () => (
    <section className="section">
      <header>
        <div>
          <h2>Assignments</h2>
          <p>{assignments.length ? "Installations scheduled in your roster" : "No active assignments available today."}</p>
        </div>
      </header>
      {assignments.length === 0 ? (
        <p className="caption">Sync from the Operations console when new visits are assigned.</p>
      ) : (
        <div className="assignment-list">
          {assignments.map((assignment) => (
            <div key={assignment.id} className={`assignment-card ${assignment.id === activeAssignmentId ? "active" : ""}`}>
              <button type="button" onClick={() => handleSelectAssignment(assignment)}>
                <strong>{assignment.customer}</strong>
                <span className="assignment-note">{assignment.location}</span>
                <span className="assignment-note">Window: {assignment.window}</span>
                <span className={`badge ${assignment.priority === "Today" ? "scheduled" : ""}`}>{assignment.priority}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );

  const renderCaptureView = () => (
    <>
      {renderAssignmentsView()}
      <div className="stat-grid">
        <div className="stat-card">
          <span>Due today</span>
          <strong>2</strong>
          <span>Remaining visits in your route</span>
        </div>
        <div className="stat-card">
          <span>Pending uploads</span>
          <strong>1</strong>
          <span>Assessments waiting for connectivity</span>
        </div>
        <div className="stat-card">
          <span>Risk alerts</span>
          <strong>{summary.riskItems.length}</strong>
          <span>Triggered during this capture</span>
        </div>
        <div className="stat-card">
          <span>Overall score</span>
          <strong>{summary.average ? summary.average.toFixed(2) : "--"}</strong>
        </div>
      </div>
      <section className="section">
        <header>
          <div>
            <h2>Assessment Header</h2>
            <p>Keep these fields accurate for audit history</p>
          </div>
          <div className={summary.safetyFlags.length ? "risk-note" : "risk-note safe"}>
            {summary.safetyFlags.length ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}
            {summary.safetyFlags.length ? "Safety attention required" : "Safety checks passed"}
          </div>
        </header>
        <div className="form-grid">
          <div className="field">
            <label>Inspector / Auditor name</label>
            <input value={header.inspectorName} onChange={(event) => handleFieldChange("inspectorName", event.target.value)} />
          </div>
          <div className="field">
            <label>Customer name</label>
            <input value={header.customerName} onChange={(event) => handleFieldChange("customerName", event.target.value)} />
          </div>
          <div className="field">
            <label>Customer type</label>
            <select value={header.customerType} onChange={(event) => handleFieldChange("customerType", event.target.value)}>
              <option value="B2B">B2B</option>
              <option value="B2C">B2C</option>
            </select>
          </div>
          <div className="field">
            <label>Location</label>
            <input value={header.location} onChange={(event) => handleFieldChange("location", event.target.value)} />
          </div>
          <div className="field">
            <label>Work date</label>
            <input type="date" value={header.workDate} onChange={(event) => handleFieldChange("workDate", event.target.value)} />
          </div>
          <div className="field">
            <label>Execution party</label>
            <select
              value={header.executionParty}
              onChange={(event) => {
                const value = event.target.value;
                handleFieldChange("executionParty", value);
              }}
            >
              <option value="Field Team">Field Team</option>
              <option value="Contractor">Contractor</option>
            </select>
          </div>
          {header.executionParty === "Field Team" ? (
            <div className="field">
              <label>Team name</label>
              <input value={header.teamName} onChange={(event) => handleFieldChange("teamName", event.target.value)} />
            </div>
          ) : (
            <div className="field">
              <label>Contractor name</label>
              <input value={header.contractorName} onChange={(event) => handleFieldChange("contractorName", event.target.value)} />
            </div>
          )}
        </div>
        <div className="score-summary">
          <div className="summary-card">
            <p>Overall score</p>
            <strong>{summary.average ? summary.average.toFixed(2) : "--"}</strong>
          </div>
          <div className="summary-card">
            <p>Threshold</p>
            <strong>{summary.band.label}</strong>
            <p>{summary.band.detail}</p>
          </div>
          <div className="summary-card">
            <p>Completion</p>
            <strong>{Math.round(summary.completion * 100)}%</strong>
          </div>
        </div>
      </section>
      <section className="section">
        <header>
          <div>
            <h2>Quality Checklist</h2>
            <p>Score every category before submitting</p>
          </div>
        </header>
        <div className="question-groups">
          {loadingQuestions ? (
            <p className="caption">Loading checklist…</p>
          ) : (
            Object.entries(groupedQuestions).map(([category, list]) => (
              <div key={category} className="question-group">
                <h3>{category}</h3>
                {list.map((question, index) => {
                  const number = getQuestionNumber(question, index);
                  return (
                    <div key={`${category}-${number}`} className="question-card">
                      <div>
                        <p>{question.question_text || question.text}</p>
                      </div>
                      <ScoreButtons value={responses[number]?.score} onChange={(value) => handleScoreChange(number, value)} />
                      <div className="field">
                        <label>Notes (optional)</label>
                        <textarea value={responses[number]?.notes || ""} onChange={(event) => handleNoteChange(number, event.target.value)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </section>
      <section className="section">
        <header>
          <div>
            <h2>Recent submissions</h2>
            <p>Latest push to governance dashboard</p>
          </div>
        </header>
        {renderHistoryTable()}
      </section>
    </>
  );

  const renderHistoryTable = () => (
    historyLoading ? (
      <p className="caption">Loading recent submissions…</p>
    ) : historyRows.length === 0 ? (
      <p className="caption">No installation assessments submitted yet.</p>
    ) : (
      <table className="history-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Customer</th>
            <th>Score</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {historyRows.map((row) => (
            <tr key={row.id}>
              <td>{row.id}</td>
              <td>{row.customer_name || row.customer}</td>
              <td>{Number(row.overall_score ?? row.score).toFixed(2)}</td>
              <td>{row.threshold_label || row.status}</td>
              <td>{row.work_date || row.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  );

  const renderHistoryView = () => (
    <section className="section">
      <header>
        <div>
          <h2>History</h2>
          <p>Complete log of submitted assessments</p>
        </div>
      </header>
      {renderHistoryTable()}
    </section>
  );

  const renderResourcesView = () => (
    <section className="section">
      <header>
        <div>
          <h2>Resources</h2>
          <p>Guides and SOP links</p>
        </div>
      </header>
      <div className="section-list">
        <article className="assignment-card">
          <strong>Installation SOP</strong>
          <p className="assignment-note">Full checklist for fibre installs.</p>
          <span className="badge">PDF</span>
        </article>
        <article className="assignment-card">
          <strong>Safety Escalation Tree</strong>
          <p className="assignment-note">Who to call when safety issues arise.</p>
          <span className="badge">Intranet</span>
        </article>
      </div>
    </section>
  );

  const pageTitle = activeModule === "Capture" ? "Capture & Upload" : activeModule;

  const renderActiveModule = () => {
    switch (activeModule) {
      case "Assignments":
        return renderAssignmentsView();
      case "History":
        return renderHistoryView();
      case "Resources":
        return renderResourcesView();
      default:
        return renderCaptureView();
    }
  };

  const moduleNav = [
    { label: "Assignments", icon: ListChecks },
    { label: "Capture", icon: ClipboardList },
    { label: "History", icon: HistoryIcon },
    { label: "Resources", icon: BookOpen },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Installation Fieldboard</div>
        <div className="nav-block">
          <span className="nav-label">Modules</span>
          <ul className="nav-list">
            {moduleNav.map(({ label, icon: Icon }) => (
              <li key={label} className="nav-item">
                <button type="button" className={label === activeModule ? "active" : ""} onClick={() => setActiveModule(label)}>
                  <Icon size={16} />
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="nav-block">
          <span className="nav-label">Status</span>
          <p className="assignment-note">{outstandingChecks} checks outstanding</p>
          <p className="assignment-note">{summary.safetyFlags.length ? "Safety follow-up required" : "Safety clear"}</p>
        </div>
      </aside>

      <main className="main-area">
        <div className="page-header">
          <div>
            <h1>{pageTitle}</h1>
            <p className="meta">Signed in as field engineer • {activeAssignment?.window || ""}</p>
          </div>
          {activeModule === "Capture" ? (
            <div className="actions-row">
              <button type="button" className="btn ghost" onClick={handleSaveDraft}>
                <Timer size={16} />
                Save Draft
              </button>
              <button type="button" className="btn" onClick={handleClearAll}>
                Clear All
              </button>
              <button type="button" className="btn primary" onClick={handleSubmit} disabled={saving}>
                <UploadCloud size={16} />
                {saving ? "Submitting..." : "Submit Assessment"}
              </button>
            </div>
          ) : null}
        </div>

        {message ? <div className="section" style={{ padding: "12px" }}>{message}</div> : null}
        {error ? (
          <div className="section" style={{ padding: "12px", borderColor: "#b91c1c", color: "#b91c1c" }}>{error}</div>
        ) : null}

        {renderActiveModule()}
      </main>
    </div>
  );
}

function hydrateHeaderFromAssignment(assignment) {
  if (!assignment) return { ...HEADER_TEMPLATE };
  return {
    inspectorName: "",
    customerName: assignment.customer,
    customerType: assignment.customerType,
    location: assignment.location,
    workDate: assignment.date,
    executionParty: assignment.executionParty,
    teamName: assignment.executionParty === "Field Team" ? assignment.team : "",
    contractorName: assignment.executionParty === "Contractor" ? assignment.team : "",
  };
}

function getQuestionNumber(question, index) {
  return (
    question.question_number ??
    question.order_index ??
    question.id ??
    index + 1
  );
}

function buildPayload(header, questionBank, responses) {
  return {
    inspector_name: header.inspectorName,
    customer_name: header.customerName,
    customer_type: header.customerType,
    location: header.location,
    work_date: header.workDate,
    execution_party: header.executionParty,
    team_name: header.executionParty === "Field Team" ? header.teamName : null,
    contractor_name: header.executionParty === "Contractor" ? header.contractorName : null,
    responses: questionBank.map((question, index) => {
      const number = getQuestionNumber(question, index);
      const response = responses[number] || { score: "", notes: "" };
      return {
        question_number: number,
        score: Number(response.score),
        notes: response.notes?.trim() || undefined,
      };
    }),
  };
}
