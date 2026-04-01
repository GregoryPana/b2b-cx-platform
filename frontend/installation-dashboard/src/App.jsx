import React, { useCallback, useEffect, useMemo, useState } from "react";
import { InteractionRequiredAuthError, InteractionStatus } from "@azure/msal-browser";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import {
  AlertTriangle,
  ShieldCheck,
  Timer,
  UploadCloud,
} from "lucide-react";
import { ensureMsalInitialized, loginRequest } from "./auth.js";

const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const SCORE_OPTIONS = [1, 2, 3, 4, 5];

const SCORE_GUIDANCE = [
  {
    range: "4 – 5",
    label: "Pass – Excellent",
    description: "High-quality install. No further action needed.",
  },
  {
    range: "3 – 4",
    label: "Pass – Needs Improvement",
    description:
      "Minor aesthetic issues (e.g., a few loose clips) or customer education gaps. Correct minor issues on the spot and log feedback for the Technician.",
  },
  {
    range: "2",
    label: "Fail – Rework Required",
    description:
      "Significant physical or technical misses. Generate a rework order for the original contractor/staff to return and fix the installation.",
  },
  {
    range: "1",
    label: "Critical Fail",
    description:
      "Major safety violations, property damage, or severe network degradation. Trigger immediate escalation, potential financial penalty or chargeback, and urgent rework.",
  },
];

const HEADER_TEMPLATE = {
  customerName: "",
  customerType: "B2B",
  location: "",
  workDate: "",
  representativeName: "",
};

const DRAFT_STORAGE_KEY = "installation-assessment-draft";

function getQuestionNumber(question, index) {
  return (
    question.question_number ??
    question.order_index ??
    question.id ??
    index + 1
  );
}

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
  if (score >= 4) return { key: "excellent", label: "Good result", detail: "No follow-up needed" };
  if (score >= 3) return { key: "needs-improvement", label: "Needs small improvements", detail: "Record what was fixed before closing" };
  if (score >= 2) return { key: "rework", label: "Needs rework", detail: "Create a rework task" };
  return { key: "critical", label: "Urgent issue", detail: "Escalate immediately" };
};

const headerFieldsComplete = (header) => {
  if (!header.customerName || !header.location || !header.workDate || !header.representativeName) {
    return false;
  }
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

export default function App() {
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [msalReady, setMsalReady] = useState(false);
  const [accessToken, setAccessToken] = useState("");

  const [questionBank, setQuestionBank] = useState([]);
  const [header, setHeader] = useState({ ...HEADER_TEMPLATE });
  const [responses, setResponses] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [draftInitialized, setDraftInitialized] = useState(false);

  useEffect(() => {
    let active = true;
    ensureMsalInitialized().then(() => {
      if (active) setMsalReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!msalReady) return;
    if (!isAuthenticated && inProgress === InteractionStatus.None) {
      instance.loginRedirect(loginRequest);
    }
  }, [msalReady, isAuthenticated, inProgress, instance]);

  useEffect(() => {
    if (!msalReady || !accounts[0]) return;
    const acquire = async () => {
      try {
        const result = await instance.acquireTokenSilent({ ...loginRequest, account: accounts[0] });
        setAccessToken(result.accessToken || "");
      } catch (error) {
        if (error instanceof InteractionRequiredAuthError) {
          instance.acquireTokenRedirect(loginRequest);
        }
      }
    };
    acquire();
  }, [msalReady, accounts, instance]);

  const headers = useMemo(() => {
    const h = { "Content-Type": "application/json" };
    if (accessToken) h.Authorization = `Bearer ${accessToken}`;
    return h;
  }, [accessToken]);

  const groupedQuestions = useMemo(() => {
    return questionBank.reduce((acc, question) => {
      const category = question.category || "General";
      if (!acc[category]) acc[category] = [];
      acc[category].push(question);
      return acc;
    }, {});
  }, [questionBank]);

  const summary = useMemo(() => {
    const scoredValues = questionBank
      .map((question, index) => {
        const number = getQuestionNumber(question, index);
        const raw = responses[number]?.score;
        if (raw === "" || raw === undefined || raw === null) {
          return null;
        }
        const numeric = Number(raw);
        if (Number.isNaN(numeric)) return null;
        return numeric;
      })
      .filter((value) => value !== null);
    const total = scoredValues.reduce((sum, value) => sum + value, 0);
    const average = scoredValues.length ? total / scoredValues.length : null;
    const hasStarted = scoredValues.length > 0;
    const totalChecks = hasStarted ? questionBank.length : 0;
    const answeredCount = hasStarted ? scoredValues.length : 0;
    const outstandingCount = hasStarted ? Math.max(totalChecks - answeredCount, 0) : 0;
    const completion = totalChecks ? answeredCount / totalChecks : 0;
    const riskItems = hasStarted
      ? questionBank.filter((question, index) => {
          const number = getQuestionNumber(question, index);
          const raw = responses[number]?.score;
          if (raw === "" || raw === undefined || raw === null) return false;
          const score = Number(raw);
          return !Number.isNaN(score) && score <= 2;
        })
      : [];
    const safetyFlags = hasStarted
      ? questionBank.filter((question, index) => {
          const number = getQuestionNumber(question, index);
          const raw = responses[number]?.score;
          if (raw === "" || raw === undefined || raw === null) return false;
          const score = Number(raw);
          return question.category.includes("Safety") && !Number.isNaN(score) && score <= 2;
        })
      : [];
    const band = bandForScore(average);

    const categories = Object.entries(groupedQuestions).map(([category, list]) => {
      const subset = list
        .map((question, idx) => {
          const number = getQuestionNumber(question, idx);
          const raw = responses[number]?.score;
          if (raw === "" || raw === undefined || raw === null) return null;
          const numeric = Number(raw);
          if (Number.isNaN(numeric)) return null;
          return numeric;
        })
        .filter((score) => score !== null);
      const catAverage = subset.length ? subset.reduce((sum, value) => sum + value, 0) / subset.length : null;
      return { category, average: catAverage };
    });

    return {
      average,
      completion,
      completedAll: hasStarted && totalChecks > 0 && outstandingCount === 0,
      riskItems,
      safetyFlags,
      band,
      categories,
      hasStarted,
      answeredCount,
      outstandingCount,
      totalChecks,
    };
  }, [responses, groupedQuestions, questionBank.length]);

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

  const loadQuestions = async () => {
    setLoadingQuestions(true);
    try {
      const res = await fetch(`${API_BASE}/installation/questions`, { headers });
      if (!res.ok) throw new Error("Failed to load questions");
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("Installation question bank is empty");
      }
      setQuestionBank(data);
      setResponses((prev) => (Object.keys(prev).length ? prev : buildInitialResponses(data)));
      setError("");
    } catch (err) {
      setQuestionBank([]);
      setResponses({});
      setError(err instanceof Error ? err.message : "Unable to load installation questions");
    } finally {
      setLoadingQuestions(false);
    }
  };

  useEffect(() => {
    if (!msalReady || !isAuthenticated || !accessToken) return;
    loadQuestions();
  }, [msalReady, isAuthenticated, accessToken]);

  useEffect(() => {
    if (draftInitialized || loadingQuestions || !questionBank.length) return;
    const stored = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.header) {
          setHeader((prev) => ({ ...prev, ...parsed.header }));
        }
        if (parsed.responses) {
          setResponses(parsed.responses);
        }
      } catch {
        // ignore invalid draft
      }
    }
    setDraftInitialized(true);
  }, [loadingQuestions, questionBank.length, draftInitialized]);

  useEffect(() => {
    if (!draftInitialized) return;
    const payload = {
      header,
      responses,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
  }, [header, responses, draftInitialized]);

  const handleSaveDraft = () => {
    setMessage(`Draft saved for ${header.customerName || "current survey"}.`);
    setError("");
  };

  const handleSubmit = async () => {
    setError("");
    setMessage("");
    if (!questionBank.length) {
      setError("Installation checklist not loaded. Refresh to pull the latest questions.");
      return;
    }
    if (!readyToSubmit) {
      setError("Complete representative/header fields and all seven scores before submitting.");
      return;
    }

    const payload = buildPayload(header, questionBank, responses);
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/installation/assessments`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || "Failed to submit assessment");
        return;
      }
      setMessage(`Assessment submitted for ${data.customer_name || payload.customer_name}.`);
      setResponses(buildInitialResponses(questionBank));
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      setDraftInitialized(false);
    } catch {
      setError("Network error submitting assessment");
    } finally {
      setSaving(false);
    }
  };

  const handleClearAll = () => {
    setHeader({ ...HEADER_TEMPLATE });
    setResponses(buildInitialResponses(questionBank));
    setMessage("");
    setError("");
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setDraftInitialized(false);
  };

  if (!msalReady || !isAuthenticated || !accessToken) {
    return <div className="app-shell"><main className="main-area"><p className="caption">Signing in...</p></main></div>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Installation Survey</div>
        <div className="nav-block">
          <span className="nav-label">Progress</span>
          <p className="assignment-note">
            {summary.hasStarted ? `${summary.outstandingCount} questions left` : "No active survey"}
          </p>
          <p className="assignment-note">
            {summary.hasStarted && summary.safetyFlags.length ? "Safety follow-up needed" : "Safety clear"}
          </p>
        </div>
      </aside>

      <main className="main-area">
        <div className="page-header">
          <div>
            <h1>Installation Survey</h1>
            <p className="meta">Signed in as {accounts[0]?.name || accounts[0]?.username || "field engineer"}</p>
          </div>
          <div className="actions-row">
            <button type="button" className="btn ghost" onClick={handleSaveDraft}>
              <Timer size={16} />
              Save Draft
            </button>
            <button type="button" className="btn" onClick={handleClearAll}>
              Clear All
            </button>
          </div>
        </div>

        {message ? <div className="section" style={{ padding: "12px" }}>{message}</div> : null}
        {error ? (
          <div className="section" style={{ padding: "12px", borderColor: "#b91c1c", color: "#b91c1c" }}>{error}</div>
        ) : null}

        <section className="section">
          <header>
            <div>
              <h2>Assessment Header</h2>
              <p>Enter details clearly so the review team can understand each visit</p>
            </div>
            <div className={summary.safetyFlags.length ? "risk-note" : "risk-note safe"}>
              {summary.safetyFlags.length ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}
              {summary.safetyFlags.length ? "Safety issue needs attention" : "No safety issue found"}
            </div>
          </header>
          <div className="form-grid">
            <div className="field">
              <label>Customer name</label>
              <input value={header.customerName} onChange={(event) => handleFieldChange("customerName", event.target.value)} />
            </div>
            <div className="field">
              <label>Customer type</label>
              <select value={header.customerType} onChange={(event) => handleFieldChange("customerType", event.target.value)}>
                <option value="B2B">Business customer</option>
                <option value="B2C">Residential customer</option>
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
              <label>Representative / Employee name</label>
              <input value={header.representativeName} onChange={(event) => handleFieldChange("representativeName", event.target.value)} />
            </div>
          </div>
          <div className="score-summary">
            <div className="summary-card">
              <p>Visit Score</p>
              <strong>{summary.answeredCount > 0 ? summary.average.toFixed(2) : "--"}</strong>
            </div>
            <div className="summary-card">
              <p>Performance Result</p>
              <strong>{summary.answeredCount > 0 ? summary.band.label : "Incomplete"}</strong>
              <p>{summary.answeredCount > 0 ? summary.band.description : "Fill in all scores to calculate"}</p>
            </div>
            <div className="summary-card">
              <p>Visit Completion</p>
              <strong>{summary.answeredCount > 0 ? Math.round(summary.completion * 100) + "%" : "0%"}</strong>
            </div>
          </div>
        </section>
        <section className="section">
          <header>
            <div>
              <h2>Score guide</h2>
              <p>Use this guide so every person scores the same way.</p>
            </div>
          </header>
          <div className="score-guidance-grid">
            {SCORE_GUIDANCE.map((item) => (
              <article key={item.range} className="score-guidance-card">
                <div className="score-range">{item.range}</div>
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="section">
          <header>
            <div>
              <h2>Survey questions</h2>
              <p>Answer every question before submitting</p>
            </div>
          </header>
          <div className="question-groups">
            {loadingQuestions ? (
              <p className="caption">Loading checklist...</p>
            ) : questionBank.length === 0 ? (
              <p className="caption">Installation checklist not available. Apply the latest database seed and refresh.</p>
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
        <div className="form-actions bottom">
          <button type="button" className="btn ghost" onClick={handleSaveDraft}>
            <Timer size={16} />
            Save Draft
          </button>
          <button type="button" className="btn" onClick={handleClearAll}>
            Clear
          </button>
          <button type="button" className="btn primary" onClick={handleSubmit} disabled={saving}>
            <UploadCloud size={16} />
            {saving ? "Submitting..." : "Submit Assessment"}
          </button>
        </div>
      </main>
    </div>
  );
}

function buildPayload(header, questionBank, responses) {
  return {
    customer_name: header.customerName,
    customer_type: header.customerType,
    location: header.location,
    work_date: header.workDate,
    representative_name: header.representativeName,
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
