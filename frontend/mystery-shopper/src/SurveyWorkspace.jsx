/**
 * SurveyWorkspace — reusable Mystery Shopper survey UI for both Entra and
 * mystery_public auth modes.
 *
 * Props:
 *   apiFetch   (url, options?) => Promise<{ res, data }>
 *   userInfo   { name, email, userId, role }
 *   onLogout   () => void
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, CalendarDays, Check, ChevronLeft, ChevronRight, CircleAlert, CircleCheck, ClipboardCheck, Info, LoaderCircle, LogOut, Menu, PencilLine, PlayCircle, X } from "lucide-react";
import { GuidePage, ScoringKeyBody } from "./SurveyGuide";
import Disclosure from "./components/Disclosure";
import PageTitle from "./components/PageTitle";

import { cn } from "./lib/utils";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Select } from "./components/ui/select";
import { Textarea } from "./components/ui/textarea";

const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const DEFAULT_PURPOSE_OPTIONS = ["General Enquiry", "Billing", "Device", "Broadband", "Complaint", "Other"];

function parseChoices(question) {
  if (!question?.choices) return [];
  if (Array.isArray(question.choices)) return question.choices;
  try {
    const parsed = JSON.parse(question.choices);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// The shopper's own calendar day. toISOString() is UTC, which is still "yesterday" for the first
// four hours of the day in Seychelles (UTC+4).
function localDateString(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function categoryToId(value) {
  return `category-${String(value || "general")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}`;
}

function displayQuestionNumber(question, fallbackIndex = 0) {
  const raw = Number(question?.order_index ?? question?.question_number ?? NaN);
  if (!Number.isFinite(raw)) return fallbackIndex + 1;
  if (raw >= 2000) return raw - 2000;
  if (raw >= 1000) return raw - 1000;
  if (raw > 0) return raw;
  return fallbackIndex + 1;
}

function getScoreOptions(question) {
  if (question?.input_type !== "score") return [];
  const min = Number(question.score_min ?? 0);
  const max = Number(question.score_max ?? 10);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) return [];
  const options = [];
  for (let value = min; value <= max; value += 1) options.push(value);
  return options;
}

function normalizeQuestionValue(question, draft = {}, existing = null) {
  const score = question?.input_type === "score" ? String(draft.score ?? existing?.score ?? "") : "";
  const answerText = question?.input_type === "score" ? "" : String(draft.answer_text ?? existing?.answer_text ?? "");
  const verbatim = String(draft.verbatim ?? existing?.verbatim ?? "");
  return { score, answerText, verbatim };
}

function isQuestionDirty(question, draft = {}, existing = null) {
  const draftOnly = normalizeQuestionValue(question, draft, null);
  const persisted = normalizeQuestionValue(question, {}, existing);
  return draftOnly.score !== persisted.score || draftOnly.answerText !== persisted.answerText || draftOnly.verbatim !== persisted.verbatim;
}

const OPTION_GRID = "flex flex-wrap gap-2";
const OPTION_BUTTON = "h-11 min-w-11 px-3";

function QuestionField({ question, draft, onUpdate, disabled = false }) {
  const choices = parseChoices(question);
  const groupLabel = `Answer for question ${displayQuestionNumber(question)}`;

  if (question.input_type === "score") {
    const scoreOptions = getScoreOptions(question);
    if (!scoreOptions.length) {
      return <p className="text-sm text-destructive">This question has no valid score range. Ask an administrator to correct it before answering.</p>;
    }
    const scoreMin = scoreOptions[0];
    const scoreMax = scoreOptions[scoreOptions.length - 1];
    return (
      <div>
        <div className={OPTION_GRID} role="group" aria-label={`Select a score from ${scoreMin} to ${scoreMax}`}>
          {scoreOptions.map((scoreValue) => {
            const selected = String(draft.score ?? "") === String(scoreValue);
            return (
              <Button
                key={`${question.id}-score-${scoreValue}`}
                type="button"
                variant={selected ? "default" : "outline"}
                size="sm"
                className={OPTION_BUTTON}
                aria-pressed={selected}
                aria-label={`Score ${scoreValue} out of ${scoreMax}`}
                disabled={disabled}
                onClick={() => onUpdate("score", String(scoreValue))}
              >
                {scoreValue}
              </Button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Scale: {scoreMin} (lowest) to {scoreMax} (highest)</p>
      </div>
    );
  }

  if (question.input_type === "yes_no") {
    return (
      <div className={OPTION_GRID} role="group" aria-label={`${groupLabel}: Yes or No`}>
        <Button type="button" variant={draft.answer_text === "Y" ? "default" : "outline"} size="sm" className={cn(OPTION_BUTTON, "min-w-20")} aria-pressed={draft.answer_text === "Y"} disabled={disabled} onClick={() => onUpdate("answer_text", "Y")}>Yes</Button>
        <Button type="button" variant={draft.answer_text === "N" ? "default" : "outline"} size="sm" className={cn(OPTION_BUTTON, "min-w-20")} aria-pressed={draft.answer_text === "N"} disabled={disabled} onClick={() => onUpdate("answer_text", "N")}>No</Button>
      </div>
    );
  }

  if (choices.length > 0) {
    return (
      <div className={OPTION_GRID} role="group" aria-label={`${groupLabel}: select one option`}>
        {choices.map((choice) => (
          <Button key={choice} type="button" variant={draft.answer_text === choice ? "default" : "outline"} size="sm" className="h-auto min-h-11 whitespace-normal px-3 py-2 text-left" aria-pressed={draft.answer_text === choice} disabled={disabled} onClick={() => onUpdate("answer_text", choice)}>
            {choice}
          </Button>
        ))}
      </div>
    );
  }

  return <Textarea aria-label={groupLabel} value={draft.answer_text || ""} disabled={disabled} onChange={(event) => onUpdate("answer_text", event.target.value)} />;
}

function VisitRow({ visit, onSelect }) {
  return (
    <button type="button" onClick={() => onSelect(visit)} className="flex w-full items-start justify-between gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-muted/40">
      <div className="min-w-0 space-y-1">
        <p className="font-medium">{visit.location_name}</p>
        <p className="text-sm text-muted-foreground">{visit.visit_date} at {visit.visit_time || "--"}</p>
      </div>
      <div className="shrink-0 space-y-1 text-right text-sm text-muted-foreground">
        <p>{visit.purpose_of_visit || "--"}</p>
        <p>{visit.mandatory_answered_count}/{visit.mandatory_total_count} required</p>
      </div>
    </button>
  );
}

export default function SurveyWorkspace({ apiFetch, userInfo, onLogout }) {
  const [activeTab, setActiveTab] = useState("planned");
  const [entryChoicePending, setEntryChoicePending] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState("");
  const [guideReturnAnchor, setGuideReturnAnchor] = useState(null);

  const [questions, setQuestions] = useState([]);
  const [questionnaireState, setQuestionnaireState] = useState("unloaded");
  const questionnaireReady = questionnaireState === "ready" && questions.length > 0;
  const [locations, setLocations] = useState([]);
  const [purposeOptions, setPurposeOptions] = useState(DEFAULT_PURPOSE_OPTIONS);
  const [draftVisits, setDraftVisits] = useState([]);
  const [visitId, setVisitId] = useState("");
  const [status, setStatus] = useState("Draft");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState("info");
  const [messageSeq, setMessageSeq] = useState(0);
  const messageRef = useRef(null);
  const lockedRef = useRef(null);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [creatingVisit, setCreatingVisit] = useState(false);
  const [savingQuestionId, setSavingQuestionId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [headerForm, setHeaderForm] = useState({
    location_id: "",
    visit_date: "",
    visit_time: "",
    purpose_of_visit: DEFAULT_PURPOSE_OPTIONS[0],
    staff_on_duty: "",
    shopper_name: "",
  });

  const [responseDrafts, setResponseDrafts] = useState({});
  const [responsesByQuestion, setResponsesByQuestion] = useState({});

  const selection = useRef(0);
  const operation = useRef(null);
  const liveDrafts = useRef(responseDrafts);
  liveDrafts.current = responseDrafts;
  useEffect(() => () => { selection.current += 1; operation.current = null; }, []);

  // Shopper name comes from the signed-in account and is not editable.
  useEffect(() => {
    const name = userInfo?.name || "";
    if (!name) return;
    setHeaderForm((prev) => (prev.shopper_name === name ? prev : { ...prev, shopper_name: name }));
  }, [userInfo?.name]);

  const raiseMessage = useCallback((text, tone = "info") => {
    setMessage(text);
    setMessageTone(tone);
    setMessageSeq((count) => count + 1);
  }, []);

  const groupedQuestions = useMemo(() => {
    const map = new Map();
    questions.forEach((question) => {
      const category = question.category || "General";
      if (!map.has(category)) map.set(category, []);
      map.get(category).push(question);
    });
    return Array.from(map.entries());
  }, [questions]);

  const totalMandatory = useMemo(() => questions.filter((q) => q.is_mandatory).length, [questions]);

  const hasMeaningfulAnswer = useCallback((question, draft = {}, existing = null) => {
    if (question.input_type === "score") {
      const candidate = draft.score ?? existing?.score;
      if (candidate === null || candidate === undefined || !["string", "number"].includes(typeof candidate) || String(candidate).trim() === "") return false;
      const numeric = Number(candidate);
      if (!Number.isFinite(numeric)) return false;
      const min = Number(question.score_min ?? 0);
      const max = Number(question.score_max ?? 10);
      return numeric >= min && numeric <= max;
    }
    const candidateText = String(draft.answer_text ?? existing?.answer_text ?? "").trim();
    if (question.input_type === "yes_no") return candidateText === "Y" || candidateText === "N";
    return candidateText.length > 0;
  }, []);

  const completedMandatory = useMemo(
    () => questions.filter((q) => {
      if (!q.is_mandatory) return false;
      return hasMeaningfulAnswer(q, responseDrafts[q.id] || {}, responsesByQuestion[q.id]);
    }).length,
    [questions, responseDrafts, responsesByQuestion, hasMeaningfulAnswer],
  );

  const unsavedQuestionCount = useMemo(
    () => questions.filter((q) => {
      const draft = responseDrafts[q.id] || {};
      const existing = responsesByQuestion[q.id] || {};
      return isQuestionDirty(q, draft, existing);
    }).length,
    [questions, responseDrafts, responsesByQuestion],
  );

  // Per-section progress drives the section navigation and the one-section-at-a-time view.
  const sectionStats = useMemo(() => groupedQuestions.map(([category, items]) => {
    const mandatory = items.filter((q) => q.is_mandatory);
    const mandatoryDone = mandatory.filter((q) => hasMeaningfulAnswer(q, responseDrafts[q.id] || {}, responsesByQuestion[q.id])).length;
    const unsaved = items.filter((q) => isQuestionDirty(q, responseDrafts[q.id] || {}, responsesByQuestion[q.id] || {})).length;
    const answered = items.filter((q) => hasMeaningfulAnswer(q, responseDrafts[q.id] || {}, responsesByQuestion[q.id])).length;
    return { category, total: items.length, answered, mandatory: mandatory.length, mandatoryDone, unsaved, complete: answered === items.length };
  }), [groupedQuestions, responseDrafts, responsesByQuestion, hasMeaningfulAnswer]);
  const activeSectionIndex = Math.max(0, groupedQuestions.findIndex(([category]) => category === currentCategory));
  const requiredPercent = totalMandatory > 0 ? Math.round((completedMandatory / totalMandatory) * 100) : 0;

  // A submitted (Pending) or later visit is read-only here; only Draft is editable.
  const locked = status !== "Draft";

  const todayString = localDateString();
  const sortedDrafts = [...draftVisits].sort((a, b) => `${a.visit_date || ""} ${a.visit_time || ""}`.localeCompare(`${b.visit_date || ""} ${b.visit_time || ""}`));
  // Every draft lands in exactly one group, so none can silently disappear from the list.
  const plannedOverdue = sortedDrafts.filter((v) => v.visit_date && v.visit_date < todayString);
  const plannedToday = sortedDrafts.filter((v) => v.visit_date === todayString);
  const plannedUpcoming = sortedDrafts.filter((v) => !v.visit_date || v.visit_date > todayString);

  const sidebarPages = [
    { key: "planned", label: "Draft Visits", icon: CalendarDays },
    { key: "survey", label: "Survey", icon: ClipboardCheck },
    { key: "guide", label: "User Guide", icon: BookOpen },
  ];

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    // Returning to the guide at a specific section is handled by the anchor-scroll
    // effect below — skip the top-of-page reset so it doesn't fight that scroll.
    if (activeTab === "guide" && guideReturnAnchor) return;
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
    const resetScroll = () => { window.scrollTo(0, 0); document.documentElement.scrollTop = 0; document.body.scrollTop = 0; };
    resetScroll();
    const frame = window.requestAnimationFrame(resetScroll);
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab, guideReturnAnchor]);

  useEffect(() => {
    if (activeTab !== "guide" || !guideReturnAnchor) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(guideReturnAnchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
      setGuideReturnAnchor(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab, guideReturnAnchor]);

  const navigateFromGuide = useCallback((tab, anchorId) => {
    setActiveTab(tab);
    setGuideReturnAnchor(anchorId);
    setMobileNavOpen(false);
  }, []);

  // --- Data initialisation ---
  const initialize = useCallback(async () => {
    setQuestionnaireState("loading");
    try {
      const [questionsRes, locationsRes, purposesRes] = await Promise.all([
        apiFetch(`${API_BASE}/questions?survey_type=Mystery%20Shopper`),
        apiFetch(`${API_BASE}/mystery-shopper/locations`),
        apiFetch(`${API_BASE}/mystery-shopper/purposes`),
      ]);

      if (!questionsRes.res.ok) throw new Error(questionsRes.data?.detail || "Failed to load questions");
      if (!locationsRes.res.ok) throw new Error(locationsRes.data?.detail || "Failed to load locations");
      if (!purposesRes.res.ok) throw new Error(purposesRes.data?.detail || "Failed to load purpose options");

      const nextQuestions = Array.isArray(questionsRes.data) ? questionsRes.data : [];
      const nextLocations = (Array.isArray(locationsRes.data) ? locationsRes.data : []).filter((l) => l.active);
      const nextPurposes = (Array.isArray(purposesRes.data) ? purposesRes.data : [])
        .filter((p) => p.active)
        .map((p) => p.name);

      setQuestions(nextQuestions);
      setQuestionnaireState(nextQuestions.length ? "ready" : "empty");
      setLocations(nextLocations);
      setPurposeOptions(nextPurposes.length ? nextPurposes : DEFAULT_PURPOSE_OPTIONS);

      if (!headerForm.location_id && nextLocations[0]?.id) {
        setHeaderForm((prev) => ({ ...prev, location_id: String(nextLocations[0].id) }));
      }
      if (nextQuestions[0]?.category) setCurrentCategory(nextQuestions[0].category);
    } catch (error) {
      setQuestionnaireState("error");
      throw error;
    }
  }, [apiFetch, headerForm.location_id]);

  const loadDrafts = useCallback(async () => {
    const owner = selection.current;
    setLoadingDrafts(true);
    try {
      const { res, data } = await apiFetch(`${API_BASE}/mystery-shopper/visits/drafts`);
      if (selection.current !== owner) return;
      if (!res.ok) throw new Error(data?.detail || "Failed to load draft visits");
      setDraftVisits(Array.isArray(data) ? data : []);
    } catch (error) {
      if (selection.current === owner) raiseMessage(error.message || "Failed to load draft visits", "error");
    } finally {
      if (selection.current === owner) setLoadingDrafts(false);
    }
  }, [apiFetch, raiseMessage]);

  const loadVisitDetail = useCallback(async (targetVisitId, preserveDrafts = false) => {
    const owner = selection.current;
    const { res, data } = await apiFetch(`${API_BASE}/mystery-shopper/visits/${targetVisitId}`);
    if (selection.current !== owner) return null;
    if (!res.ok) throw new Error(data?.detail || "Failed to load visit detail");

    setVisitId(String(data.id));
    setStatus(data.status || "Draft");

    const nextResponses = {};
    const nextDrafts = {};
    (data.responses || []).forEach((response) => {
      nextResponses[response.question_id] = response;
      nextDrafts[response.question_id] = {
        score: response.score ?? "",
        answer_text: response.answer_text || "",
        verbatim: response.verbatim || "",
      };
    });
    setResponsesByQuestion(nextResponses);
    if (!preserveDrafts) { liveDrafts.current = nextDrafts; setResponseDrafts(nextDrafts); }
    return nextResponses;
  }, [apiFetch]);

  useEffect(() => {
    const run = async () => {
      try {
        await initialize();
        await loadDrafts();
      } catch (error) {
        raiseMessage(error.message || "Failed to initialise", "error");
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!currentCategory && groupedQuestions[0]) setCurrentCategory(groupedQuestions[0][0]);
  }, [groupedQuestions, currentCategory]);

  useEffect(() => {
    if (!purposeOptions.length) return;
    if (!purposeOptions.includes(headerForm.purpose_of_visit)) {
      setHeaderForm((prev) => ({ ...prev, purpose_of_visit: purposeOptions[0] }));
    }
  }, [purposeOptions, headerForm.purpose_of_visit]);

  // Errors stay until dismissed or replaced (they can be long and the shopper has to act on them).
  useEffect(() => {
    if (!message || messageTone === "error") return undefined;
    const timeout = window.setTimeout(() => setMessage(""), 6000);
    return () => window.clearTimeout(timeout);
  }, [message, messageTone, messageSeq]);

  // Submit is at the bottom of the last section but the "Submitted for review" card is at the top: bring it into view.
  useEffect(() => {
    if (visitId && locked) lockedRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [visitId, locked]);

  // The banner sits at the top of the page but Save/Submit are at the bottom, so bring errors into view.
  useEffect(() => {
    if (message && messageTone === "error") messageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [message, messageTone, messageSeq]);

  // --- Actions ---
  const selectDraftVisit = useCallback(async (visit) => {
    const owner = ++selection.current;
    operation.current = null;
    setSavingQuestionId(null); setSubmitting(false);
    setVisitId(""); setResponsesByQuestion({});
    liveDrafts.current = {}; setResponseDrafts({});
    setHeaderForm({
      location_id: String(visit.location_id),
      visit_date: visit.visit_date || "",
      visit_time: visit.visit_time || "",
      purpose_of_visit: visit.purpose_of_visit || purposeOptions[0] || DEFAULT_PURPOSE_OPTIONS[0],
      staff_on_duty: visit.staff_on_duty || "",
      shopper_name: userInfo?.name || visit.shopper_name || "",
    });
    try { await loadVisitDetail(visit.visit_id); }
    catch (error) { if (selection.current === owner) raiseMessage(error.message, "error"); return; }
    if (selection.current !== owner) return;
    setEntryChoicePending(false);
    setActiveTab("survey");
  }, [purposeOptions, loadVisitDetail, userInfo?.name, raiseMessage]);

  const createVisitFn = useCallback(async () => {
    if (!headerForm.location_id || !headerForm.visit_date || !headerForm.visit_time || !headerForm.staff_on_duty || !headerForm.shopper_name) {
      raiseMessage("Complete all visit header fields before creating a visit.", "error");
      return;
    }
    if (creatingVisit || visitId) return;
    const owner = ++selection.current;
    setCreatingVisit(true);
    try {
      const payload = {
        location_id: Number(headerForm.location_id),
        visit_date: headerForm.visit_date,
        visit_type: "Planned",
        visit_time: headerForm.visit_time,
        purpose_of_visit: headerForm.purpose_of_visit,
        staff_on_duty: headerForm.staff_on_duty,
        shopper_name: headerForm.shopper_name,
      };
      const { res, data } = await apiFetch(`${API_BASE}/mystery-shopper/visits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (selection.current !== owner) return;
      if (!res.ok) throw new Error(data?.detail || "Failed to create visit");
      setVisitId(data.visit_id);
      setStatus(data.status || "Draft");
      setEntryChoicePending(false);
      raiseMessage("Mystery Shopper visit created.", "success");
      setActiveTab("survey");
      await loadDrafts();
      if (selection.current !== owner) return;
      await loadVisitDetail(data.visit_id);
    } catch (error) {
      if (selection.current === owner) raiseMessage(error.message || "Failed to create visit", "error");
    } finally {
      if (selection.current === owner) setCreatingVisit(false);
    }
  }, [headerForm, apiFetch, loadDrafts, loadVisitDetail, raiseMessage, creatingVisit, visitId]);

  const updateQuestionDraft = useCallback((questionId, field, value) => {
    const next = { ...liveDrafts.current, [questionId]: { ...(liveDrafts.current[questionId] || {}), [field]: value } };
    liveDrafts.current = next;
    setResponseDrafts(next);
  }, []);

  // A readback never replaces drafts. Each operation owns its selection and
  // snapshots only the values being saved, so edits during IO remain dirty.
  const readSaved = useCallback(async (target, owner) => {
    const { res, data } = await apiFetch(`${API_BASE}/mystery-shopper/visits/${target}`);
    if (selection.current !== owner) throw new Error("Selection changed");
    if (!res.ok) throw new Error(data?.detail || "Could not verify saved answers. Your drafts are retained; retry Save to check the server.");
    if (String(data.id) !== String(target)) throw new Error("Visit identity did not match readback.");
    const rows = {};
    const responseIds = new Set();
    for (const row of data.responses || []) {
      if (!row.response_id || rows[row.question_id] || responseIds.has(String(row.response_id))) throw new Error("Invalid or duplicate answer identity in readback.");
      responseIds.add(String(row.response_id));
      rows[row.question_id] = row;
    }
    setResponsesByQuestion(rows);
    return { rows, status: data.status };
  }, [apiFetch]);

  const persistAnswer = useCallback(async (question, draft, target, owner, existing) => {
    if (selection.current !== owner) throw new Error("Selection changed");
    const current = (await readSaved(target, owner)).rows[question.id];
    if (current && !isQuestionDirty(question, draft, current)) return current;
    if (Boolean(current) !== Boolean(existing) || (current && (current.response_id !== existing.response_id || isQuestionDirty(question, current, existing)))) {
      throw new Error(`Saved Q${displayQuestionNumber(question)} changed since confirmation. Draft retained; retry to review the overwrite.`);
    }
    const payload = {
      question_id: question.id,
      score: question.input_type === "score" ? Number(draft.score) : null,
      answer_text: question.input_type === "score" ? null : draft.answer_text || null,
      verbatim: draft.verbatim || null,
      actions: [],
    };
    let lostReply;
    let reply;
    try {
      reply = await apiFetch(`${API_BASE}/mystery-shopper/visits/${target}/responses${existing ? `/${existing.response_id}` : ""}`, {
        method: existing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
    } catch (error) { lostReply = error; }
    if (selection.current !== owner) throw new Error("Selection changed");
    // Explicit validation failures must not be converted into successful saves.
    if (reply && !reply.res.ok) throw new Error(typeof reply.data?.detail === "string" ? reply.data.detail : JSON.stringify(reply.data?.detail || "Failed to save response"));
    const { rows } = await readSaved(target, owner);
    const confirmed = rows[question.id];
    if (!confirmed || isQuestionDirty(question, draft, confirmed) || (existing && confirmed.response_id !== existing.response_id)) {
      throw new Error(`Q${displayQuestionNumber(question)} could not be verified${lostReply ? " after a connection issue" : ""}. Drafts retained; retry Save to check before overwriting.`);
    }
    return confirmed;
  }, [apiFetch, readSaved]);

  const saveQuestion = useCallback(async (question) => {
    if (!visitId) { raiseMessage("Create or select a visit before saving responses.", "error"); return; }
    if (operation.current) return;
    const draft = { ...(liveDrafts.current[question.id] || {}) };
    if (!hasMeaningfulAnswer(question, draft)) { raiseMessage(`Enter a valid answer for Q${displayQuestionNumber(question)}.`, "error"); return; }
    const token = { owner: selection.current };
    operation.current = token;
    setSavingQuestionId(question.id);
    try {
      const { rows } = await readSaved(visitId, token.owner);
      const existing = rows[question.id];
      if (existing && isQuestionDirty(question, draft, existing) && !window.confirm(`Overwrite the saved answer for Q${displayQuestionNumber(question)}? Your new answer will replace it.`)) return;
      await persistAnswer(question, draft, visitId, token.owner, existing);
      if (selection.current === token.owner) raiseMessage(`Saved Q${displayQuestionNumber(question)} (verified on server).`, "success");
    } catch (error) {
      if (selection.current === token.owner) raiseMessage(error.message || "Save could not be verified. Drafts retained.", "error");
    } finally {
      if (operation.current === token) { operation.current = null; setSavingQuestionId(null); }
    }
  }, [visitId, hasMeaningfulAnswer, readSaved, persistAnswer, raiseMessage]);

  const submitVisitFn = useCallback(async () => {
    if (!visitId) { raiseMessage("No visit selected.", "error"); return; }
    if (!questionnaireReady) { raiseMessage("The questionnaire is not ready. Reload it before submitting.", "error"); return; }
    if (operation.current) return;
    const token = { owner: selection.current };
    operation.current = token;
    setSubmitting(true);
    const snapshot = Object.fromEntries(questions.map(q => [q.id, { ...(liveDrafts.current[q.id] || {}) }]));
    const answered = questions.filter(q => hasMeaningfulAnswer(q, snapshot[q.id]));
    try {
      const before = (await readSaved(visitId, token.owner)).rows;
      const overwritten = answered.filter(q => before[q.id] && isQuestionDirty(q, snapshot[q.id], before[q.id]));
      if (overwritten.length && !window.confirm(`Overwrite previously saved answers: ${overwritten.map(q => `Q${displayQuestionNumber(q)}`).join(", ")}? Submit will save all answered questions, then check for unanswered questions.`)) return;
      for (const q of answered) await persistAnswer(q, snapshot[q.id], visitId, token.owner, before[q.id]);
      const verified = await readSaved(visitId, token.owner);
      if (answered.some(q => !verified.rows[q.id] || isQuestionDirty(q, snapshot[q.id], verified.rows[q.id]))) throw new Error("Some saved answers changed during verification. Drafts retained; check and retry.");
      if (questions.some(q => isQuestionDirty(q, liveDrafts.current[q.id] || {}, snapshot[q.id]))) throw new Error("Answers edited while saving. Saved answers are retained; submit again to include your latest changes.");
      const missing = questions.filter(q => !hasMeaningfulAnswer(q, snapshot[q.id]) || !hasMeaningfulAnswer(q, {}, verified.rows[q.id]));
      const labels = list => list.map(q => `Q${displayQuestionNumber(q)}${q.question_text ? `: ${q.question_text}` : ""}`).join("; ");
      const required = missing.filter(q => q.is_mandatory);
      const optional = missing.filter(q => !q.is_mandatory);
      // An explicit cleared/invalid field is not an untouched optional omission.
      // Without a supported clear mutation, do not submit its old persisted value.
      const unresolvedClears = questions.filter(q => {
        const field = q.input_type === "score" ? "score" : "answer_text";
        return Object.prototype.hasOwnProperty.call(snapshot[q.id], field)
          && !hasMeaningfulAnswer(q, snapshot[q.id])
          && hasMeaningfulAnswer(q, {}, verified.rows[q.id]);
      });
      if (unresolvedClears.length) {
        raiseMessage(`Answered questions saved and verified. Visit remains Draft. Cleared or invalid answers still have saved values: ${labels(unresolvedClears)}. Restore or replace these answers before submitting.${required.length ? ` Required unanswered: ${labels(required)}.` : ""}${optional.length ? ` Optional unanswered: ${labels(optional)}.` : ""}`, "error");
        return;
      }
      if (required.length) {
        raiseMessage(`Answered questions saved and verified. Visit remains Draft. Required unanswered: ${labels(required)}.${optional.length ? ` Optional unanswered: ${labels(optional)}.` : ""}`, "error");
        return;
      }
      if (optional.length && !window.confirm(`Answered questions saved. Optional unanswered: ${labels(optional)}. Submit anyway?`)) {
        raiseMessage("Answered questions saved and verified. Visit remains Draft.", "success"); return;
      }
      const { res, data } = await apiFetch(`${API_BASE}/mystery-shopper/visits/${visitId}/submit`, { method: "PUT" });
      if (selection.current !== token.owner) return;
      if (!res.ok) throw new Error(typeof data?.detail === "string" ? data.detail : JSON.stringify(data?.detail || "Failed to submit visit"));
      const after = await readSaved(visitId, token.owner);
      if (after.status !== "Pending" || answered.some(q => !after.rows[q.id] || isQuestionDirty(q, snapshot[q.id], after.rows[q.id]))) throw new Error("Submission could not be verified. Answers retained; check this visit before retrying.");
      setStatus(after.status);
      raiseMessage(`Submitted for review. Report date: ${data.report_completed_date || "N/A"} (UTC+4).`, "success");
      await loadDrafts();
    } catch (error) {
      if (selection.current === token.owner) raiseMessage(error.message || "Could not verify submission. Saved answers and drafts are retained.", "error");
    } finally {
      if (operation.current === token) { operation.current = null; setSubmitting(false); }
    }
  }, [visitId, questions, questionnaireReady, hasMeaningfulAnswer, readSaved, persistAnswer, apiFetch, loadDrafts, raiseMessage]);

  const scrollToCategory = useCallback((category) => {
    setCurrentCategory(category);
    // The section swaps on the next render; scroll after it so the new section starts at the top.
    window.requestAnimationFrame(() => {
      const el = document.getElementById("survey-questions");
      if (!el) return;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 130, behavior: "smooth" });
    });
  }, []);

  // Re-runs the initial load after a failure, without reloading the page.
  const retryLoad = async () => {
    try {
      await initialize();
      await loadDrafts();
      setMessage("");
    } catch (error) {
      raiseMessage(error.message || "Failed to initialise", "error");
    }
  };

  // Clears the open visit so the shopper can fill in a new visit header.
  const startNewVisit = () => {
    selection.current += 1;
    operation.current = null;
    setSavingQuestionId(null);
    setSubmitting(false);
    setVisitId("");
    setStatus("Draft");
    setResponsesByQuestion({});
    liveDrafts.current = {};
    setResponseDrafts({});
    setHeaderForm((prev) => ({ ...prev, visit_date: "", visit_time: "", staff_on_duty: "" }));
    setMessage("");
    setCurrentCategory(groupedQuestions[0]?.[0] || "");
    setActiveTab("survey");
  };

  // --- Render ---
  return (
    <>
      <div className="relative flex min-h-screen bg-background">
        {mobileNavOpen && (
          <motion.button
            type="button"
            className="fixed inset-0 z-20 bg-black/40 lg:hidden"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
        <motion.aside
          className={cn(
            "fixed left-0 top-0 z-30 h-screen w-[min(86vw,20rem)] max-w-full border-r bg-card shadow-2xl transition-transform duration-300 lg:w-72",
            mobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          )}
          initial={{ opacity: 0.98 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18 }}
        >
          <div className="flex h-14 items-center justify-between border-b px-4">
            <span className="text-sm font-semibold">Mystery Shopper Survey</span>
            <Button type="button" variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex h-[calc(100vh-56px)] flex-col overflow-y-auto p-3 custom-scrollbar">
            <nav className="space-y-1">
              {sidebarPages.map((page) => {
                const Icon = page.icon;
                return (
                  <Button
                    key={page.key}
                    type="button"
                    variant={activeTab === page.key ? "secondary" : "ghost"}
                    className="w-full justify-start gap-3"
                    onClick={() => { setActiveTab(page.key); setEntryChoicePending(false); setMobileNavOpen(false); }}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{page.label}</span>
                  </Button>
                );
              })}
            </nav>

            <div className="mt-auto rounded-lg border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Signed in</p>
              <p className="truncate text-sm font-medium">{userInfo?.name || "Unknown user"}</p>
              <p className="truncate text-xs text-muted-foreground">{userInfo?.email || "No email"}</p>
              {onLogout && (
                <Button type="button" variant="outline" className="mt-3 w-full justify-start gap-2" onClick={onLogout}>
                  <LogOut className="h-4 w-4" /> Logout
                </Button>
              )}
            </div>
          </div>
        </motion.aside>

        <div className="flex flex-1 flex-col lg:pl-72">
          <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
            <motion.div
              className="flex h-14 items-center justify-between px-4 md:px-6"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex min-w-0 items-center gap-2">
                <Button type="button" variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation">
                  <Menu className="h-4 w-4" />
                </Button>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Customer Service Centre Assessment</p>
                  <p className="truncate text-xs text-muted-foreground">Mystery Shopper survey workspace</p>
                </div>
              </div>
              <p className="truncate pl-2 text-xs text-muted-foreground lg:hidden">{userInfo?.name || "Unknown user"}</p>
            </motion.div>
          </header>

          <motion.main
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="mx-auto w-full max-w-[1600px] flex-1 p-4 md:p-6"
          >
            {message && (
              <motion.div
                ref={messageRef}
                role={messageTone === "error" ? "alert" : "status"}
                className={cn(
                  "mb-4 flex scroll-mt-32 items-start gap-3 rounded-lg border p-4 text-sm",
                  messageTone === "error"
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : messageTone === "success"
                      ? "border-success/30 bg-success/10 text-foreground"
                      : "bg-muted text-foreground",
                )}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                {messageTone === "error" ? <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : messageTone === "success" ? <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" /> : <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
                <p className="min-w-0 flex-1 break-words">{message}</p>
                <Button type="button" variant="ghost" size="icon" className="-my-2 -mr-2 h-8 w-8 shrink-0" onClick={() => setMessage("")} aria-label="Dismiss message">
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </motion.div>
            )}

            <div className="space-y-6">
              {entryChoicePending && (
                <motion.div className="space-y-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }}>
                  <PageTitle title="How would you like to begin?" />
                  <div className="grid gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => { setEntryChoicePending(false); setActiveTab("survey"); setMobileNavOpen(false); }}
                      className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-left transition-colors hover:bg-primary/10"
                    >
                      <div className="flex items-center gap-3">
                        <PlayCircle className="h-5 w-5 text-primary" aria-hidden="true" />
                        <div>
                          <p className="font-medium">Start a new survey</p>
                          <p className="text-sm text-muted-foreground">Enter the visit details and create a fresh Mystery Shopper visit.</p>
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEntryChoicePending(false); setActiveTab("planned"); setMobileNavOpen(false); }}
                      disabled={loadingDrafts || draftVisits.length === 0}
                      className="rounded-lg border p-4 text-left transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <div className="flex items-center gap-3">
                        <CalendarDays className="h-5 w-5 text-primary" aria-hidden="true" />
                        <div>
                          <p className="font-medium">Load an existing draft</p>
                          <p className="text-sm text-muted-foreground">
                            {loadingDrafts ? "Checking for saved drafts..." : draftVisits.length === 0 ? "You have no saved drafts." : `Resume one of ${draftVisits.length} draft visit${draftVisits.length === 1 ? "" : "s"} already saved.`}
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>
                  <Disclosure summary="Scoring key" meta="Read before you start">
                    <ScoringKeyBody />
                  </Disclosure>
                </motion.div>
              )}

              {activeTab === "guide" && <GuidePage onNavigateToTab={navigateFromGuide} />}

              {activeTab === "planned" && !entryChoicePending && (
                <div className="space-y-6">
                  <PageTitle title="Draft visits" description="Pick up a visit you have already started or planned." />
                  {plannedOverdue.length > 0 ? (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle>Overdue</CardTitle>
                          <Badge variant="warning">{plannedOverdue.length}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">These drafts were planned for an earlier date. Open one to finish it.</p>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {plannedOverdue.map((visit) => <VisitRow key={visit.visit_id} visit={visit} onSelect={selectDraftVisit} />)}
                      </CardContent>
                    </Card>
                  ) : null}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                      <CardTitle>Today</CardTitle>
                      <Button type="button" variant="outline" size="sm" onClick={loadDrafts}>
                        {loadingDrafts ? "Refreshing..." : "Refresh"}
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {plannedToday.length === 0 && <p className="rounded-lg border p-4 text-sm text-muted-foreground">No visits planned for today.</p>}
                      {plannedToday.map((visit) => <VisitRow key={visit.visit_id} visit={visit} onSelect={selectDraftVisit} />)}
                    </CardContent>
                  </Card>
                  {plannedUpcoming.length > 0 ? (
                    <Disclosure summary="Upcoming" meta={`${plannedUpcoming.length} visit${plannedUpcoming.length === 1 ? "" : "s"}`}>
                      {plannedUpcoming.map((visit) => <VisitRow key={visit.visit_id} visit={visit} onSelect={selectDraftVisit} />)}
                    </Disclosure>
                  ) : (
                    <p className="rounded-lg border p-4 text-sm text-muted-foreground">No upcoming visits.</p>
                  )}
                </div>
              )}

              {activeTab === "survey" && (
                <div className="space-y-6">
                  <PageTitle
                    title={visitId ? "Survey" : "New visit"}
                    description={visitId ? undefined : "Enter the visit details to create the visit. The questions open once it is created."}
                  />
                  {visitId ? (
                    <div className="sticky top-14 z-10 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
                      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                        <p className="text-sm font-medium">
                          Required answers <span className="tabular-nums text-muted-foreground">{completedMandatory} of {totalMandatory || 0}</span>
                        </p>
                        <div className="flex flex-wrap items-center gap-2" aria-live="polite">
                          {creatingVisit && <Badge className="gap-1"><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Creating visit</Badge>}
                          {savingQuestionId && <Badge variant="secondary" className="gap-1"><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Saving</Badge>}
                          {submitting && <Badge variant="secondary" className="gap-1"><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Submitting</Badge>}
                          {unsavedQuestionCount > 0 && (
                            <Badge variant="outline" className="gap-1">
                              <PencilLine className="h-3.5 w-3.5" /> {unsavedQuestionCount} unsaved
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div
                        role="progressbar"
                        aria-label="Required answers completed"
                        aria-valuemin={0}
                        aria-valuemax={totalMandatory || 0}
                        aria-valuenow={completedMandatory}
                        className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
                      >
                        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${requiredPercent}%` }} />
                      </div>
                    </div>
                  ) : null}

                  {visitId && locked ? (
                    <div ref={lockedRef} role="status" className="scroll-mt-32 rounded-lg border border-success/30 bg-success/10 p-4">
                      <div className="flex items-start gap-3">
                        <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="space-y-1">
                            <p className="font-medium">{status === "Pending" ? "Submitted for review" : `Visit status: ${status}`}</p>
                            <p className="text-sm text-muted-foreground">
                              {status === "Pending"
                                ? "A CX reviewer checks it next. You can no longer edit it here; if it is sent back it appears in your draft visits again."
                                : "This visit can no longer be edited here."}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button type="button" onClick={startNewVisit}>Start another survey</Button>
                            <Button type="button" variant="outline" onClick={() => setActiveTab("planned")}>Back to draft visits</Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Open before the visit exists (read it first), closed once the questions are showing. */}
                  <Disclosure key={visitId ? "in-visit" : "before-visit"} summary="Scoring key" meta={visitId ? "Reference" : "Read before you start"} defaultOpen={!visitId}>
                    <ScoringKeyBody />
                  </Disclosure>

                  {visitId ? (
                    <Card>
                      <CardContent className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 p-4">
                        <div className="min-w-0">
                          <p className="font-medium">{locations.find((l) => String(l.id) === String(headerForm.location_id))?.name || "Visit"}</p>
                          <p className="text-sm text-muted-foreground">
                            {headerForm.visit_date} at {headerForm.visit_time || "--"} · {headerForm.purpose_of_visit}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground">Staff on duty: {headerForm.staff_on_duty || "--"}</p>
                        <Badge variant="secondary" title={`Visit ${visitId}`}>{status}</Badge>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardHeader><CardTitle>Visit details</CardTitle></CardHeader>
                      <CardContent className="space-y-6">
                        {questionnaireState === "error" || questionnaireState === "empty" || (questionnaireState === "ready" && locations.length === 0) ? (
                          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                            <p className="min-w-0 flex-1">
                              {questionnaireState === "error"
                                ? "The questions or locations could not be loaded, so a visit cannot be created yet."
                                : questionnaireState === "empty"
                                  ? "There are no Mystery Shopper questions yet. Ask an administrator to configure the questionnaire."
                                  : "No active locations are available. Ask an administrator to add the location you visited."}
                            </p>
                            <Button type="button" variant="outline" size="sm" onClick={retryLoad}>Try again</Button>
                          </div>
                        ) : null}
                        <p className="text-sm text-muted-foreground">All fields are required.</p>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                          <div className="space-y-2">
                            <label htmlFor="visit-location" className="block text-sm font-medium">Customer Service Centre <span aria-hidden="true" className="text-destructive">*</span></label>
                            <Select id="visit-location" aria-required="true" value={headerForm.location_id} onChange={(e) => setHeaderForm((prev) => ({ ...prev, location_id: e.target.value }))}>
                              <option value="">Select location</option>
                              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <label htmlFor="visit-date" className="block text-sm font-medium">Date of Visit <span aria-hidden="true" className="text-destructive">*</span></label>
                            <Input id="visit-date" aria-required="true" type="date" value={headerForm.visit_date} onChange={(e) => setHeaderForm((prev) => ({ ...prev, visit_date: e.target.value }))} />
                          </div>
                          <div className="space-y-2">
                            <label htmlFor="visit-time" className="block text-sm font-medium">Time of Visit <span aria-hidden="true" className="text-destructive">*</span></label>
                            <Input id="visit-time" aria-required="true" type="time" value={headerForm.visit_time} onChange={(e) => setHeaderForm((prev) => ({ ...prev, visit_time: e.target.value }))} />
                          </div>
                          <div className="space-y-2">
                            <label htmlFor="visit-purpose" className="block text-sm font-medium">Purpose of Visit <span aria-hidden="true" className="text-destructive">*</span></label>
                            <Select id="visit-purpose" aria-required="true" value={headerForm.purpose_of_visit} onChange={(e) => setHeaderForm((prev) => ({ ...prev, purpose_of_visit: e.target.value }))}>
                              {purposeOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <label htmlFor="visit-staff" className="block text-sm font-medium">Staff on Duty <span aria-hidden="true" className="text-destructive">*</span></label>
                            <Input id="visit-staff" aria-required="true" value={headerForm.staff_on_duty} onChange={(e) => setHeaderForm((prev) => ({ ...prev, staff_on_duty: e.target.value }))} />
                          </div>
                          <div className="space-y-2">
                            <label htmlFor="visit-shopper" className="block text-sm font-medium">Mystery Shopper Name (You)</label>
                            <Input id="visit-shopper" value={headerForm.shopper_name} disabled readOnly title="Filled automatically from your account" />
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <Button type="button" onClick={createVisitFn} disabled={creatingVisit || !questionnaireReady}>
                            {creatingVisit ? "Creating..." : "Create visit and start"}
                          </Button>
                          {!questionnaireReady && questionnaireState === "loading" ? <p className="text-sm text-muted-foreground">Loading the questionnaire...</p> : null}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {visitId ? (
                    <div id="survey-questions" className="grid grid-cols-1 gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
                      <Card className="hidden self-start xl:sticky xl:top-36 xl:block">
                        <CardHeader><CardTitle className="text-sm">Sections</CardTitle></CardHeader>
                        <CardContent className="space-y-1">
                          {sectionStats.map((section, index) => (
                            <Button
                              key={section.category}
                              type="button"
                              variant={activeSectionIndex === index ? "secondary" : "ghost"}
                              className="h-auto w-full justify-start gap-3 px-3 py-2 text-left"
                              aria-current={activeSectionIndex === index ? "step" : undefined}
                              onClick={() => scrollToCategory(section.category)}
                            >
                              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border bg-background text-xs font-medium">
                                {section.complete ? <Check className="h-3.5 w-3.5 text-success" aria-label="Complete" /> : index + 1}
                              </span>
                              <span className="min-w-0 flex-1 whitespace-normal">{section.category}</span>
                              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{section.answered}/{section.total}</span>
                            </Button>
                          ))}
                        </CardContent>
                      </Card>

                      <div className="min-w-0 space-y-4">
                        {/* Phones and tablets: the same sections as a swipeable row instead of a hidden drawer item. */}
                        {sectionStats.length > 1 ? (
                          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 xl:hidden" role="group" aria-label="Survey sections">
                            {sectionStats.map((section, index) => (
                              <button
                                key={section.category}
                                type="button"
                                onClick={() => scrollToCategory(section.category)}
                                aria-current={activeSectionIndex === index ? "step" : undefined}
                                className={cn(
                                  "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                                  activeSectionIndex === index ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                                )}
                              >
                                {section.complete ? <Check className="h-3.5 w-3.5" aria-label="Complete" /> : <span className="tabular-nums">{index + 1}</span>}
                                <span>{section.category}</span>
                              </button>
                            ))}
                          </div>
                        ) : null}

                        {groupedQuestions.length === 0 ? (
                          <Card>
                            <CardContent className="p-6 text-sm text-muted-foreground">
                              No Mystery Shopper questions are available. You cannot complete this visit until an administrator configures the questionnaire.
                            </CardContent>
                          </Card>
                        ) : (
                          (() => {
                            const [category, items] = groupedQuestions[activeSectionIndex];
                            const section = sectionStats[activeSectionIndex];
                            const isLastSection = activeSectionIndex === groupedQuestions.length - 1;
                            return (
                              <>
                                <Card key={category} id={categoryToId(category)}>
                                  <CardHeader>
                                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                                      <CardTitle>{category}</CardTitle>
                                      <p className="text-xs text-muted-foreground">Section {activeSectionIndex + 1} of {groupedQuestions.length}</p>
                                    </div>
                                  </CardHeader>
                                  <CardContent className="space-y-4">
                                    {items.map((question, questionIndex) => {
                                      const draft = responseDrafts[question.id] || {};
                                      const existing = responsesByQuestion[question.id] || null;
                                      const hasChanges = isQuestionDirty(question, draft, existing);
                                      const hasSavedResponse = Boolean(existing?.response_id);
                                      const qLabel = displayQuestionNumber(question, questionIndex);
                                      const btnLabel = savingQuestionId === question.id
                                        ? "Saving..."
                                        : hasChanges ? "Save" : hasSavedResponse ? "Saved" : "No changes";
                                      const statusText = hasChanges
                                        ? "Unsaved changes"
                                        : hasSavedResponse ? "Response captured" : "No response captured yet";
                                      return (
                                        <div key={question.id} className="space-y-4 rounded-lg border p-4">
                                          <div className="flex items-start gap-3">
                                            <Badge>{qLabel}</Badge>
                                            <div className="min-w-0 flex-1 space-y-2">
                                              <p className="font-medium leading-6">{question.question_text}</p>
                                              <QuestionField question={question} draft={draft} disabled={locked} onUpdate={(field, value) => updateQuestionDraft(question.id, field, value)} />
                                            </div>
                                          </div>
                                          <div className="flex items-center justify-between gap-3">
                                            <p className={cn("text-xs", hasChanges ? "text-amber-700" : hasSavedResponse ? "text-emerald-700" : "text-muted-foreground")}>
                                              {statusText}
                                            </p>
                                            <Button type="button" variant="outline" size="sm" onClick={() => saveQuestion(question)} disabled={locked || submitting || savingQuestionId !== null || !hasChanges}>
                                              {btnLabel}
                                            </Button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </CardContent>
                                </Card>

                                {section.unsaved > 0 ? (
                                  <p className="text-sm text-amber-700" role="status">
                                    {section.unsaved} answer{section.unsaved === 1 ? "" : "s"} in this section not saved yet. Use Save on each question before you submit.
                                  </p>
                                ) : null}

                                <div className="flex items-center justify-between gap-3">
                                  <Button type="button" variant="outline" onClick={() => scrollToCategory(groupedQuestions[activeSectionIndex - 1][0])} disabled={activeSectionIndex === 0}>
                                    <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous
                                  </Button>
                                  {!isLastSection ? (
                                    <Button type="button" onClick={() => scrollToCategory(groupedQuestions[activeSectionIndex + 1][0])}>
                                      Next section <ChevronRight className="h-4 w-4" aria-hidden="true" />
                                    </Button>
                                  ) : null}
                                </div>

                                {isLastSection && !locked ? (
                                  <Card>
                                    <CardContent className="p-6">
                                      <div className="flex flex-wrap items-center justify-between gap-3">
                                        {!questionnaireReady ? <p role="status" className="text-sm text-muted-foreground">{questionnaireState === "loading" ? "Loading questionnaire..." : questionnaireState === "empty" ? "The questionnaire has no questions. Ask an administrator to configure it before submitting." : "The questionnaire has not loaded. Reload the page before submitting."}</p> : null}
                                        <Badge variant="secondary">Mandatory completion: {completedMandatory}/{totalMandatory || 0}</Badge>
                                        <Button type="button" onClick={submitVisitFn} disabled={submitting || savingQuestionId !== null || !visitId || !questionnaireReady}>
                                          {submitting ? "Submitting..." : "Submit for Review"}
                                        </Button>
                                      </div>
                                    </CardContent>
                                  </Card>
                                ) : null}
                              </>
                            );
                          })()
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Create the visit above to see the questions.</p>
                  )}
                </div>
              )}
            </div>
          </motion.main>
        </div>
      </div>

      {guideReturnAnchor && activeTab !== "guide" ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-2 shadow-lg"
            onClick={() => setActiveTab("guide")}
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Guide
          </Button>
        </div>
      ) : null}
    </>
  );
}
