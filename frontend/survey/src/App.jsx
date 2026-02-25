import { useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function App() {
  const [userId, setUserId] = useState("4");
  const [role, setRole] = useState("Representative");
  const [visitId, setVisitId] = useState("");
  const [status, setStatus] = useState("Draft");
  const [message, setMessage] = useState("");

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

  const handleCreateVisit = async () => {
    setMessage("");
    const payload = {
      business_id: Number(visitForm.business_id),
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
        <h2>Create Visit</h2>
        <div className="grid">
          <label>
            Business ID
            <input
              value={visitForm.business_id}
              onChange={(e) => setVisitForm({ ...visitForm, business_id: e.target.value })}
            />
          </label>
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
          Create Draft Visit
        </button>
      </section>

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
