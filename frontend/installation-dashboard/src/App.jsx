import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ClipboardList,
  ShieldCheck,
  Timer,
  UploadCloud,
  History as HistoryIcon,
  Building2,
} from "lucide-react";

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
  const [questionBank, setQuestionBank] = useState([]);
  const [header, setHeader] = useState({ ...HEADER_TEMPLATE });
  const [responses, setResponses] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [draftInitialized, setDraftInitialized] = useState(false);
  const [activeModule, setActiveModule] = useState("Survey");
  const [selectedBusiness, setSelectedBusiness] = useState(null);

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
      const res = await fetch(`${API_BASE}/installation/questions`);
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

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/installation/assessments?limit=100`);
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
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      setDraftInitialized(false);
      await loadHistory();
    } catch {
      setError("Network error submitting assessment");
    } finally {
      setSaving(false);
    }
  };

  const historyRows = history;
  const businessSummaries = useMemo(() => {
    const map = new Map();
    history.forEach((row) => {
      const name = row.customer_name || row.customer || "Unnamed Business";
      if (!map.has(name)) {
        map.set(name, {
          name,
          visits: 0,
          representatives: new Set(),
          lastVisit: null,
          lastLocation: row.location || "—",
          scores: [],
        });
      }
      const record = map.get(name);
      record.visits += 1;
      if (row.representative_name) record.representatives.add(row.representative_name);
      const dateValue = row.work_date || row.created_at || row.date;
      if (!record.lastVisit || (dateValue && dateValue > record.lastVisit)) {
        record.lastVisit = dateValue;
        record.lastLocation = row.location || record.lastLocation;
      }
      const numeric = Number(row.overall_score ?? row.score);
      if (Number.isFinite(numeric)) record.scores.push(numeric);
    });
    return Array.from(map.values()).map((record) => {
      const averageScore = record.scores.length
        ? record.scores.reduce((sum, value) => sum + value, 0) / record.scores.length
        : null;
      return {
        ...record,
        representatives: Array.from(record.representatives).join(", ") || "—",
        averageScore,
        lastLocation: record.lastLocation,
        band: bandForScore(averageScore),
      };
    });
  }, [history]);

  const visitCounts = useMemo(() => {
    const counts = {};
    history.forEach((row) => {
      const name = row.customer_name || row.customer || "Unnamed Business";
      counts[name] = (counts[name] || 0) + 1;
    });
    return counts;
  }, [history]);

  const systemStats = useMemo(() => {
    const totalScore = historyRows.reduce((acc, row) => acc + Number(row.overall_score || row.score || 0), 0);
    const avgScore = historyRows.length > 0 ? totalScore / historyRows.length : null;
    const problemCount = historyRows.filter(r => r.threshold_band === 'rework' || r.threshold_band === 'critical').length;
    return {
      avgScore,
      totalSurveys: historyRows.length,
      problemCount,
      uniqueBusinesses: businessSummaries.length,
      band: bandForScore(avgScore)
    };
  }, [historyRows, businessSummaries]);

  const handleClearAll = () => {
    setHeader({ ...HEADER_TEMPLATE });
    setResponses(buildInitialResponses(questionBank));
    setMessage("");
    setError("");
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setDraftInitialized(false);
  };

  const renderCaptureView = () => (
    <>
            <div className="stat-grid">
        <div className="stat-card" style={{borderColor: '#2563eb', backgroundColor: '#eff6ff'}}>
          <span>Total Surveys Completed</span>
          <strong style={{color: '#1e3a8a'}}>{systemStats.totalSurveys}</strong>
          <span>Sent to review</span>
        </div>
        <div className="stat-card" style={{borderColor: '#16a34a', backgroundColor: '#f0fdf4'}}>
          <span>Businesses Serviced</span>
          <strong style={{color: '#14532d'}}>{systemStats.uniqueBusinesses}</strong>
          <span>Unique locations visited</span>
        </div>
        <div className="stat-card" style={{borderColor: '#dc2626', backgroundColor: '#fef2f2'}}>
          <span>Problem alerts</span>
          <strong style={{color: '#7f1d1d'}}>{systemStats.problemCount}</strong>
          <span>Rework/Critical issues logged</span>
        </div>
        <div className="stat-card" style={{borderColor: '#ca8a04', backgroundColor: '#fefce8'}}>
          <span>System Avg Score</span>
          <strong style={{color: '#713f12'}}>{systemStats.avgScore ? systemStats.avgScore.toFixed(2) : "--"}</strong>
          <span>Across all surveys</span>
        </div>
      </div>

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
            <p>{summary.answeredCount > 0 ? "Visit Score" : "Your Overall Average"}</p>
            <strong>{summary.answeredCount > 0 ? summary.average.toFixed(2) : (systemStats.avgScore ? systemStats.avgScore.toFixed(2) : "--")}</strong>
          </div>
          <div className="summary-card">
            <p>Performance Result</p>
            <strong>{summary.answeredCount > 0 ? summary.band.label : systemStats.band.label}</strong>
            <p>{summary.answeredCount > 0 ? summary.band.description : "Summary of all your submitted assessments"}</p>
          </div>
          <div className="summary-card">
            <p>{summary.answeredCount > 0 ? "Visit Completion" : "Daily Progress"}</p>
            <strong>{summary.answeredCount > 0 ? Math.round(summary.completion * 100) + "%" : systemStats.totalSurveys + " Surveys Done"}</strong>
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
            <p className="caption">Loading checklist…</p>
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
          {saving ? "Submitting…" : "Submit Assessment"}
        </button>
      </div>
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
            <th>Business</th>
            <th>Location</th>
            <th>Visit Date</th>
            <th>Survey person</th>
            <th>Score</th>
            <th>Status</th>
            <th>Visits</th>
          </tr>
        </thead>
        <tbody>
          {historyRows.map((row) => {
            const numericScore = Number(row.overall_score ?? row.score);
            const displayScore = Number.isFinite(numericScore) ? numericScore.toFixed(2) : "--";
            const displayStatus = row.threshold_label || row.threshold_band || row.status || "--";
            const displayDate = row.work_date || row.created_at || row.date || "--";
            const businessName = row.customer_name || row.customer || "Unnamed Business";
            const band = bandForScore(numericScore);
            return (
              <tr key={row.id} className={`status-${band.key}`} onClick={() => setSelectedBusiness(businessName)} style={{cursor: 'pointer'}}>
                <td>{businessName}</td>
                <td>{row.location || "—"}</td>
                <td>{displayDate}</td>
                <td>{row.representative_name || row.representative || "—"}</td>
                <td>{displayScore}</td>
                <td>{displayStatus}</td>
                <td>{visitCounts[businessName] || 1}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    )
  );

  const renderHistoryView = () => (
    <section className="section">
      <header>
        <div>
          <h2>History</h2>
          <p>Complete list of submitted surveys</p>
        </div>
      </header>
      {renderHistoryTable()}
    </section>
  );

  const renderBusinessesView = () => (
    <section className="section">
      <header>
        <div>
          <h2>Visited businesses</h2>
          <p>Total list of site visits. Click any row to view business performance details.</p>
        </div>
      </header>
      {renderHistoryTable()}
      {selectedBusiness && (
        <div className="business-detail">
          <div className="business-detail-overlay" onClick={() => setSelectedBusiness(null)}></div>
          <div className="business-detail-content">
          <header>
            <div>
              <h3 style={{fontSize: '1.5rem', color: '#1e293b'}}>{selectedBusiness}</h3>
              <p className="assignment-note">Full Performance Profile</p>
            </div>
            <button type="button" className="btn ghost" onClick={() => setSelectedBusiness(null)}>
              Close
            </button>
          </header>
          {(() => {
            const businessData = businessSummaries.find(b => b.name === selectedBusiness);
            if (!businessData) return <p className="caption">Aggregating company data...</p>;
            return (
              <div className="detail-scroll-area">
                <div className="detail-stats-hub">
                  <div className={`summary-card status-${businessData.band.key}`}>
                    <p style={{margin: 0, fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b'}}>Overall Avg Score</p>
                    <strong style={{fontSize: '2rem'}}>{businessData.averageScore.toFixed(2)}</strong>
                    <span className="badge" style={{marginTop: '4px'}}>{businessData.band.label}</span>
                  </div>
                  <div className="mini-stats-grid">
                    <div className="mini-stat">
                      <span>Customer Location</span>
                      <strong>{businessData.lastLocation}</strong>
                    </div>
                    <div className="mini-stat">
                      <span>Total Visits Captured</span>
                      <strong>{businessData.visits}</strong>
                    </div>
                    <div className="mini-stat">
                      <span>Field Representatives</span>
                      <strong>{businessData.representatives}</strong>
                    </div>
                  </div>
                </div>

                <div style={{marginTop: '24px'}}>
                  <h4 style={{fontSize: '1rem', fontWeight: '600', marginBottom: '12px'}}>Performance by Category</h4>
                  {(() => {
                    const businessResponses = history
                      .filter(r => (r.customer_name || r.customer || "Unnamed Business") === selectedBusiness)
                      .flatMap(r => r.responses || []);
                    
                    const catStats = businessResponses.reduce((acc, resp) => {
                      const quest = questionBank.find(q => q.question_number === resp.question_number);
                      const cat = quest ? (quest.category || quest.section) : "Technical Standards";
                      if (!acc[cat]) acc[cat] = { sum: 0, count: 0 };
                      acc[cat].sum += Number(resp.score || 0);
                      acc[cat].count += 1;
                      return acc;
                    }, {});

                    if (Object.keys(catStats).length === 0) return <p className="caption">Category breakdown not available for legacy records.</p>;

                    return (
                      <div className="mini-stats-grid" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px'}}>
                        {Object.entries(catStats).map(([cat, stats]) => (
                           <div key={cat} className="mini-stat" style={{borderLeft: '3px solid #3b82f6', backgroundColor: '#f0f9ff'}}>
                             <span style={{fontSize: '0.7rem', color: '#1e40af'}}>{cat}</span>
                             <strong style={{color: '#1e3a8a'}}>{(stats.sum / stats.count).toFixed(2)}</strong>
                           </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                <div style={{marginTop: '24px'}}>
                  <h4 style={{fontSize: '1rem', fontWeight: '600', marginBottom: '12px'}}>Visit-by-Visit History</h4>
                  <div className="business-detail-list">
                    {history
                      .filter((row) => (row.customer_name || row.customer || "Unnamed Business") === selectedBusiness)
                      .map((row, idx, filtered) => {
                        const numericScore = Number(row.overall_score ?? row.score);
                        const band = bandForScore(numericScore);
                        return (
                          <article key={`${row.id}-item`} className={`business-detail-card status-${band.key}`} style={{marginBottom: '10px', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px'}}>
                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px'}}>
                              <strong>Visit #{filtered.length - idx}</strong>
                              <span className="badge" style={{fontSize: '0.7rem'}}>{band.label}</span>
                            </div>
                            <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '0.875rem'}}>
                              <div>
                                <span style={{color: '#64748b', fontSize: '0.75rem'}}>Date:</span> {row.work_date || row.created_at || "—"}
                              </div>
                              <div>
                                <span style={{color: '#64748b', fontSize: '0.75rem'}}>By:</span> {row.representative_name || "—"}
                              </div>
                              <div>
                                <span style={{color: '#64748b', fontSize: '0.75rem'}}>Score:</span> <strong>{numericScore.toFixed(2)}</strong>
                              </div>
                            </div>
                            {row.notes && (
                              <div style={{marginTop: '8px', padding: '8px', backgroundColor: '#f8fafc', borderRadius: '4px', fontSize: '0.8rem'}}>
                                <span style={{fontSize: '0.7rem', color: '#64748b', fontWeight: '600'}}>Notes:</span> {row.notes}
                              </div>
                            )}
                          </article>
                        );
                      })}
                  </div>
                </div>
              </div>
            );
          })()}
          </div>
        </div>
      )}
    </section>
  );

  const pageTitle = activeModule === "Survey" ? "Survey" : activeModule;

  const renderActiveModule = () => {
    switch (activeModule) {
      case "History":
        return renderHistoryView();
      case "Businesses":
        return renderBusinessesView();
      case "Survey":
        return renderCaptureView();
      default:
        return renderCaptureView();
    }
  };

  const moduleNav = [
    { label: "Survey", icon: ClipboardList },
    { label: "Businesses", icon: Building2 },
    { label: "History", icon: HistoryIcon },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Installation Survey</div>
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
            <h1>{pageTitle}</h1>
            <p className="meta">Signed in as field engineer</p>
          </div>
          {activeModule === "Survey" && (
            <div className="actions-row">
              <button type="button" className="btn ghost" onClick={handleSaveDraft}>
                <Timer size={16} />
                Save Draft
              </button>
              <button type="button" className="btn" onClick={handleClearAll}>
                Clear All
              </button>
            </div>
          )}
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
    representativeName: "",
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
