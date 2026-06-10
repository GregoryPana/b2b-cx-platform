/**
 * SurveyWorkspace — reusable Mystery Shopper survey UI for both Entra and
 * mystery_public auth modes.
 *
 * Props:
 *   apiFetch   (url, options?) => Promise<{ res, data }>
 *   userInfo   { name, email, userId, role }
 *   onLogout   () => void
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, CalendarDays, ClipboardCheck, LoaderCircle, LogOut, Menu, PencilLine, PlayCircle, X } from "lucide-react";
import { GuidePage, ScoringKeyCard } from "./SurveyGuide";

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
  const answerText = question?.input_type === "score" ? "" : String(draft.answer_text ?? existing?.answer_text ?? "").trim();
  const verbatim = String(draft.verbatim ?? existing?.verbatim ?? "").trim();
  return { score, answerText, verbatim };
}

function isQuestionDirty(question, draft = {}, existing = null) {
  const draftOnly = normalizeQuestionValue(question, draft, null);
  const persisted = normalizeQuestionValue(question, {}, existing);
  return draftOnly.score !== persisted.score || draftOnly.answerText !== persisted.answerText || draftOnly.verbatim !== persisted.verbatim;
}

function QuestionField({ question, draft, onUpdate }) {
  const choices = parseChoices(question);

  if (question.input_type === "score") {
    const scoreOptions = getScoreOptions(question);
    return (
      <div className="option-grid score-option-grid" role="radiogroup" aria-label="Select score">
        {scoreOptions.map((scoreValue) => (
          <Button
            key={`${question.id}-score-${scoreValue}`}
            type="button"
            variant={String(draft.score ?? "") === String(scoreValue) ? "default" : "outline"}
            size="sm"
            className="option-pill score-pill"
            onClick={() => onUpdate("score", String(scoreValue))}
          >
            {scoreValue}
          </Button>
        ))}
      </div>
    );
  }

  if (question.input_type === "yes_no") {
    return (
      <div className="option-grid" role="radiogroup" aria-label="Yes or No response">
        <Button type="button" variant={draft.answer_text === "Y" ? "default" : "outline"} size="sm" className="option-pill" onClick={() => onUpdate("answer_text", "Y")}>Yes</Button>
        <Button type="button" variant={draft.answer_text === "N" ? "default" : "outline"} size="sm" className="option-pill" onClick={() => onUpdate("answer_text", "N")}>No</Button>
      </div>
    );
  }

  if (choices.length > 0) {
    return (
      <div className="option-grid" role="radiogroup" aria-label="Select one option">
        {choices.map((choice) => (
          <Button key={choice} type="button" variant={draft.answer_text === choice ? "default" : "outline"} size="sm" className="option-pill" onClick={() => onUpdate("answer_text", choice)}>
            {choice}
          </Button>
        ))}
      </div>
    );
  }

  return <Textarea value={draft.answer_text || ""} onChange={(event) => onUpdate("answer_text", event.target.value)} />;
}

export default function SurveyWorkspace({ apiFetch, userInfo, onLogout }) {
  const [activeTab, setActiveTab] = useState("planned");
  const [entryChoicePending, setEntryChoicePending] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState("");

  const [questions, setQuestions] = useState([]);
  const [locations, setLocations] = useState([]);
  const [purposeOptions, setPurposeOptions] = useState(DEFAULT_PURPOSE_OPTIONS);
  const [draftVisits, setDraftVisits] = useState([]);
  const [visitId, setVisitId] = useState("");
  const [status, setStatus] = useState("Draft");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState("info");
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

  // Shopper name comes from the signed-in account and is not editable.
  useEffect(() => {
    const name = userInfo?.name || "";
    if (!name) return;
    setHeaderForm((prev) => (prev.shopper_name === name ? prev : { ...prev, shopper_name: name }));
  }, [userInfo?.name]);

  const raiseMessage = useCallback((text, tone = "info") => {
    setMessage(text);
    setMessageTone(tone);
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
      if (candidate === null || candidate === undefined || candidate === "") return false;
      const numeric = Number(candidate);
      if (Number.isNaN(numeric)) return false;
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

  const todayString = new Date().toISOString().split("T")[0];
  const plannedToday = draftVisits.filter((v) => v.visit_date === todayString);
  const plannedUpcoming = draftVisits.filter((v) => v.visit_date > todayString);

  const sidebarPages = [
    { key: "planned", label: "Draft Visits", icon: CalendarDays },
    { key: "survey", label: "Survey", icon: ClipboardCheck },
    { key: "guide", label: "User Guide", icon: BookOpen },
  ];

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
    const resetScroll = () => { window.scrollTo(0, 0); document.documentElement.scrollTop = 0; document.body.scrollTop = 0; };
    resetScroll();
    const frame = window.requestAnimationFrame(resetScroll);
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab]);

  // --- Data initialisation ---
  const initialize = useCallback(async () => {
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
    setLocations(nextLocations);
    setPurposeOptions(nextPurposes.length ? nextPurposes : DEFAULT_PURPOSE_OPTIONS);

    if (!headerForm.location_id && nextLocations[0]?.id) {
      setHeaderForm((prev) => ({ ...prev, location_id: String(nextLocations[0].id) }));
    }
    if (nextQuestions[0]?.category) setCurrentCategory(nextQuestions[0].category);
  }, [apiFetch, headerForm.location_id]);

  const loadDrafts = useCallback(async () => {
    setLoadingDrafts(true);
    try {
      const { res, data } = await apiFetch(`${API_BASE}/mystery-shopper/visits/drafts`);
      if (!res.ok) throw new Error(data?.detail || "Failed to load draft visits");
      setDraftVisits(Array.isArray(data) ? data : []);
    } catch (error) {
      raiseMessage(error.message || "Failed to load draft visits", "error");
    } finally {
      setLoadingDrafts(false);
    }
  }, [apiFetch, raiseMessage]);

  const loadVisitDetail = useCallback(async (targetVisitId) => {
    const { res, data } = await apiFetch(`${API_BASE}/mystery-shopper/visits/${targetVisitId}`);
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
    setResponseDrafts((prev) => ({ ...prev, ...nextDrafts }));
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

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [message]);

  // --- Actions ---
  const selectDraftVisit = useCallback(async (visit) => {
    setHeaderForm({
      location_id: String(visit.location_id),
      visit_date: visit.visit_date || "",
      visit_time: visit.visit_time || "",
      purpose_of_visit: visit.purpose_of_visit || purposeOptions[0] || DEFAULT_PURPOSE_OPTIONS[0],
      staff_on_duty: visit.staff_on_duty || "",
      shopper_name: userInfo?.name || visit.shopper_name || "",
    });
    await loadVisitDetail(visit.visit_id);
    setEntryChoicePending(false);
    setActiveTab("survey");
  }, [purposeOptions, loadVisitDetail, userInfo?.name]);

  const createVisitFn = useCallback(async () => {
    if (!headerForm.location_id || !headerForm.visit_date || !headerForm.visit_time || !headerForm.staff_on_duty || !headerForm.shopper_name) {
      raiseMessage("Complete all visit header fields before creating a visit.", "error");
      return;
    }
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
      if (!res.ok) throw new Error(data?.detail || "Failed to create visit");
      setVisitId(data.visit_id);
      setStatus(data.status || "Draft");
      setEntryChoicePending(false);
      raiseMessage("Mystery Shopper visit created.", "success");
      setActiveTab("survey");
      await loadDrafts();
      await loadVisitDetail(data.visit_id);
    } catch (error) {
      raiseMessage(error.message || "Failed to create visit", "error");
    } finally {
      setCreatingVisit(false);
    }
  }, [headerForm, apiFetch, loadDrafts, loadVisitDetail, raiseMessage]);

  const updateQuestionDraft = useCallback((questionId, field, value) => {
    setResponseDrafts((prev) => ({
      ...prev,
      [questionId]: { ...(prev[questionId] || {}), [field]: value },
    }));
  }, []);

  const saveQuestion = useCallback(async (question) => {
    if (!visitId) { raiseMessage("Create or select a visit before saving responses.", "error"); return; }
    const draft = responseDrafts[question.id] || {};
    const existing = responsesByQuestion[question.id];
    const hasChanges = isQuestionDirty(question, draft, existing);
    const qLabel = displayQuestionNumber(question);
    if (!hasChanges) {
      raiseMessage(existing?.response_id ? `Q${qLabel} is already saved.` : `No response entered yet for Q${qLabel}.`, existing?.response_id ? "success" : "info");
      return;
    }
    if (question.input_type === "score") { const n = Number(draft.score); if (Number.isNaN(n)) { raiseMessage(`Enter a score for Q${qLabel}.`, "info"); return; } }
    if (question.input_type === "yes_no" && !draft.answer_text) { raiseMessage(`Select Yes or No for Q${qLabel}.`, "info"); return; }

    setSavingQuestionId(question.id);
    try {
      const endpoint = existing
        ? `${API_BASE}/mystery-shopper/visits/${visitId}/responses/${existing.response_id}`
        : `${API_BASE}/mystery-shopper/visits/${visitId}/responses`;
      const { res, data } = await apiFetch(endpoint, {
        method: existing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_id: question.id,
          score: question.input_type === "score" ? Number(draft.score) : null,
          answer_text: question.input_type === "score" ? null : draft.answer_text || null,
          verbatim: draft.verbatim || null,
          actions: [],
        }),
      });
      if (!res.ok) throw new Error(data?.detail || "Failed to save response");
      setResponsesByQuestion((prev) => ({ ...prev, [question.id]: data }));
      raiseMessage(`Saved Q${qLabel}.`, "success");
    } catch (error) {
      raiseMessage(error.message || "Failed to save response", "error");
    } finally {
      setSavingQuestionId(null);
    }
  }, [visitId, responseDrafts, responsesByQuestion, apiFetch, raiseMessage]);

  const submitVisitFn = useCallback(async () => {
    if (!visitId) { raiseMessage("No visit selected.", "error"); return; }
    const unanswered = questions.filter((q) => q.is_mandatory && !responsesByQuestion[q.id]);
    if (unanswered.length > 0) { raiseMessage(`Complete all required questions before submit (${unanswered.length} remaining).`, "error"); return; }
    setSubmitting(true);
    try {
      const { res, data } = await apiFetch(`${API_BASE}/mystery-shopper/visits/${visitId}/submit`, { method: "PUT" });
      if (!res.ok) throw new Error(data?.detail || "Failed to submit visit");
      setStatus("Pending");
      raiseMessage(`Submitted for review. Report date: ${data.report_completed_date || "N/A"} (UTC+4).`, "success");
      await loadDrafts();
    } catch (error) {
      raiseMessage(error.message || "Failed to submit visit", "error");
    } finally {
      setSubmitting(false);
    }
  }, [visitId, questions, responsesByQuestion, apiFetch, loadDrafts, raiseMessage]);

  const scrollToCategory = useCallback((category) => {
    setCurrentCategory(category);
    const el = document.getElementById(categoryToId(category));
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 86;
    window.scrollTo({ top, behavior: "smooth" });
  }, []);

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
                    onClick={() => { setActiveTab(page.key); setMobileNavOpen(false); }}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{page.label}</span>
                  </Button>
                );
              })}
            </nav>

            {activeTab === "survey" && groupedQuestions.length > 0 && (
              <div className="mt-6 space-y-3">
                <p className="text-xs font-medium text-muted-foreground">Jump to section</p>
                <div className="space-y-2">
                  {groupedQuestions.map(([category], index) => (
                    <Button
                      key={category}
                      type="button"
                      variant={currentCategory === category ? "secondary" : "ghost"}
                      className="h-auto w-full justify-start gap-3 px-3 py-2 text-left"
                      onClick={() => { scrollToCategory(category); setMobileNavOpen(false); }}
                    >
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border bg-background text-xs font-medium">{index + 1}</span>
                      <span className="whitespace-normal">{category}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

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
              <p className="truncate pl-2 text-xs text-muted-foreground">{userInfo?.name || "Unknown user"}</p>
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
                className={cn(
                  "mb-4 rounded border px-4 py-3 text-sm",
                  messageTone === "error"
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : messageTone === "success"
                      ? "border-success/30 bg-emerald-50 text-emerald-900"
                      : "border-amber-300 bg-amber-50 text-amber-900",
                )}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                {message}
              </motion.div>
            )}

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">Mystery Shopper Survey</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-md border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Current Visit</p>
                      <p className="mt-1 text-sm font-medium">{visitId || "Not selected"}</p>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Status</p>
                      <p className="mt-1 text-sm font-medium">{status}</p>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Required Progress</p>
                      <p className="mt-1 text-sm font-medium">{completedMandatory}/{totalMandatory || 0}</p>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Configured Locations</p>
                      <p className="mt-1 text-sm font-medium">{locations.length}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {creatingVisit && <Badge className="gap-1"><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Creating visit</Badge>}
                    {savingQuestionId && <Badge variant="secondary" className="gap-1"><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Saving response</Badge>}
                    {submitting && <Badge variant="secondary" className="gap-1"><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Submitting survey</Badge>}
                    {unsavedQuestionCount > 0 && (
                      <Badge variant="outline" className="gap-1">
                        <PencilLine className="h-3.5 w-3.5" /> {unsavedQuestionCount} unsaved change{unsavedQuestionCount === 1 ? "" : "s"}
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">User</label>
                      <Input value={userInfo?.name || "-"} disabled />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">Email</label>
                      <Input value={userInfo?.email || "-"} disabled />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {entryChoicePending && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }}>
                  <Card className="border-primary/15 shadow-sm">
                    <CardHeader>
                      <CardTitle>How would you like to begin?</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => { setEntryChoicePending(false); setActiveTab("survey"); setMobileNavOpen(false); raiseMessage("Fill out the visit header to begin a new survey.", "info"); }}
                        className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/10 active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-3">
                          <PlayCircle className="h-5 w-5 text-primary" />
                          <div>
                            <p className="font-medium">Start a new survey</p>
                            <p className="text-sm text-muted-foreground">Open the visit header and create a fresh Mystery Shopper visit.</p>
                          </div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEntryChoicePending(false); setActiveTab("planned"); setMobileNavOpen(false); }}
                        disabled={loadingDrafts || draftVisits.length === 0}
                        className="rounded-xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-muted/40 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <div className="flex items-center gap-3">
                          <CalendarDays className="h-5 w-5 text-primary" />
                          <div>
                            <p className="font-medium">Load an existing draft</p>
                            <p className="text-sm text-muted-foreground">Resume one of {draftVisits.length} draft visit{draftVisits.length === 1 ? "" : "s"} already saved.</p>
                          </div>
                        </div>
                      </button>
                    </CardContent>
                  </Card>
                  <div className="mt-6">
                    <ScoringKeyCard />
                  </div>
                </motion.div>
              )}

              {activeTab === "guide" && <GuidePage />}

              {activeTab === "planned" && (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                      <CardTitle>Today</CardTitle>
                      <Button type="button" variant="outline" size="sm" onClick={loadDrafts}>
                        {loadingDrafts ? "Refreshing..." : "Refresh"}
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {plannedToday.length === 0 && <p className="text-sm text-muted-foreground">No visits planned for today.</p>}
                      {plannedToday.map((visit) => (
                        <button key={visit.visit_id} type="button" onClick={() => selectDraftVisit(visit)} className="flex w-full items-start justify-between rounded-lg border p-4 text-left transition-colors hover:bg-muted/40">
                          <div className="space-y-1">
                            <p className="font-medium">{visit.location_name}</p>
                            <p className="text-sm text-muted-foreground">{visit.visit_date} at {visit.visit_time || "--"}</p>
                          </div>
                          <div className="space-y-1 text-right text-sm text-muted-foreground">
                            <p>{visit.purpose_of_visit || "--"}</p>
                            <p>{visit.mandatory_answered_count}/{visit.mandatory_total_count} required</p>
                          </div>
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle>Upcoming</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {plannedUpcoming.length === 0 && <p className="text-sm text-muted-foreground">No upcoming visits.</p>}
                      {plannedUpcoming.map((visit) => (
                        <button key={visit.visit_id} type="button" onClick={() => selectDraftVisit(visit)} className="flex w-full items-start justify-between rounded-lg border p-4 text-left transition-colors hover:bg-muted/40">
                          <div className="space-y-1">
                            <p className="font-medium">{visit.location_name}</p>
                            <p className="text-sm text-muted-foreground">{visit.visit_date} at {visit.visit_time || "--"}</p>
                          </div>
                          <div className="space-y-1 text-right text-sm text-muted-foreground">
                            <p>{visit.purpose_of_visit || "--"}</p>
                            <p>{visit.mandatory_answered_count}/{visit.mandatory_total_count} required</p>
                          </div>
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeTab === "survey" && (
                <div className="space-y-6">
                  <ScoringKeyCard compact />
                  <Card>
                    <CardHeader><CardTitle>Visit Header</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">Customer Service Centre</label>
                          <Select value={headerForm.location_id} onChange={(e) => setHeaderForm((prev) => ({ ...prev, location_id: e.target.value }))}>
                            <option value="">Select location</option>
                            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                          </Select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">Date of Visit</label>
                          <Input type="date" value={headerForm.visit_date} onChange={(e) => setHeaderForm((prev) => ({ ...prev, visit_date: e.target.value }))} />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">Time of Visit</label>
                          <Input type="time" value={headerForm.visit_time} onChange={(e) => setHeaderForm((prev) => ({ ...prev, visit_time: e.target.value }))} />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">Purpose of Visit</label>
                          <Select value={headerForm.purpose_of_visit} onChange={(e) => setHeaderForm((prev) => ({ ...prev, purpose_of_visit: e.target.value }))}>
                            {purposeOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                          </Select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">Staff on Duty</label>
                          <Input value={headerForm.staff_on_duty} onChange={(e) => setHeaderForm((prev) => ({ ...prev, staff_on_duty: e.target.value }))} />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">Mystery Shopper Name (You)</label>
                          <Input value={headerForm.shopper_name} disabled readOnly title="Filled automatically from your account" />
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Button type="button" onClick={createVisitFn} disabled={creatingVisit}>
                          {creatingVisit ? "Creating..." : "Create / Load Visit"}
                        </Button>
                        <Badge variant="secondary">Current Visit: {visitId || "Not selected"}</Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
                    <Card className="hidden xl:block self-start sticky top-20">
                      <CardHeader><CardTitle className="text-sm">Sections</CardTitle></CardHeader>
                      <CardContent className="space-y-2">
                        {groupedQuestions.map(([category], index) => (
                          <Button
                            key={category}
                            type="button"
                            variant={currentCategory === category ? "secondary" : "ghost"}
                            className="h-auto w-full justify-start gap-3 px-3 py-2 text-left"
                            onClick={() => scrollToCategory(category)}
                          >
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border bg-background text-xs font-medium">{index + 1}</span>
                            <span className="whitespace-normal">{category}</span>
                          </Button>
                        ))}
                      </CardContent>
                    </Card>

                    <div className="space-y-6">
                      {groupedQuestions.map(([category, items]) => (
                        <Card key={category} id={categoryToId(category)}>
                          <CardHeader><CardTitle>{category}</CardTitle></CardHeader>
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
                                <div key={question.id} className="rounded-lg border p-4 space-y-4">
                                  <div className="flex items-start gap-3">
                                    <Badge>{qLabel}</Badge>
                                    <div className="space-y-2 min-w-0 flex-1">
                                      <p className="font-medium leading-6">{question.question_text}</p>
                                      <QuestionField question={question} draft={draft} onUpdate={(field, value) => updateQuestionDraft(question.id, field, value)} />
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-3">
                                    <p className={cn("text-xs", hasChanges ? "text-amber-700" : hasSavedResponse ? "text-emerald-700" : "text-muted-foreground")}>
                                      {statusText}
                                    </p>
                                    <Button type="button" variant="outline" size="sm" onClick={() => saveQuestion(question)} disabled={savingQuestionId === question.id || !hasChanges}>
                                      {btnLabel}
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </CardContent>
                        </Card>
                      ))}

                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <Badge variant="secondary">Mandatory completion: {completedMandatory}/{totalMandatory || 0}</Badge>
                            <Button type="button" onClick={submitVisitFn} disabled={submitting || !visitId}>
                              {submitting ? "Submitting..." : "Submit for Review"}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.main>
        </div>
      </div>
    </>
  );
}
