import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { gsap } from "gsap";
import Lottie from "lottie-react";
import { ArrowRight, CheckCircle2, Loader2, Plus, Save, Sparkles } from "lucide-react";
import emptyStateAnimation from "../../assets/empty-state-lottie.json";
import PageContainer from "../../components/layout/PageContainer";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Textarea } from "../../components/ui/textarea";

const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

const QUESTION_CATEGORY_ORDER = [
  "Category 1: Relationship Strength",
  "Category 2: Service & Operational Performance",
  "Category 3: Commercial & Billing",
  "Category 4: Competitive & Portfolio Intelligence",
  "Category 5: Growth & Expansion",
  "Category 6: Advocacy",
];

const Q16_KEY = "q16_other_provider_products";
const Q17_KEY = "q17_competitor_products_services";

type ApiHeaders = Record<string, string>;

type Business = {
  id: number;
  name: string;
  priority_level?: "high" | "medium" | "low";
  active?: boolean;
};

type Question = {
  id: number;
  question_text: string;
  category: string;
  input_type: "score" | "yes_no" | "always_sometimes_never" | "text" | string;
  score_min?: number | null;
  score_max?: number | null;
  is_mandatory?: boolean;
  question_key?: string;
  question_number?: number;
  choices?: string | string[];
};

type DraftVisit = {
  id?: string;
  visit_id?: string;
  business_id: number;
  business_name?: string;
  business_priority?: "high" | "medium" | "low";
  visit_date?: string;
  status?: string;
  mandatory_answered_count?: number;
  mandatory_total_count?: number;
  is_started?: boolean;
  is_completed?: boolean;
};

type ActionItem = {
  action_required: string;
  action_owner: string;
  action_timeframe: string;
  action_support_needed: string;
};

type ResponseRecord = {
  response_id: string;
  question_id: number;
  score: number | null;
  answer_text: string | null;
  verbatim: string | null;
  actions?: ActionItem[];
};

type ResponseDraft = {
  score: string;
  answer_text: string;
  verbatim: string;
  actions: ActionItem[];
};

type ToastItem = {
  id: number;
  kind: "info" | "success" | "error";
  title: string;
};

interface SurveyWorkspacePageProps {
  headers: ApiHeaders;
  userId: string;
  role: string;
}

const emptyDraft: ResponseDraft = { score: "", answer_text: "", verbatim: "", actions: [] };

function parseChoices(question: Question): string[] {
  if (!question.choices) return [];
  if (Array.isArray(question.choices)) return question.choices;
  try {
    const parsed = JSON.parse(question.choices);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function categoryToId(value: string) {
  return `category-${String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
}

export default function SurveyWorkspacePage({ headers, userId }: SurveyWorkspacePageProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isPlannedRoute = location.pathname === "/planned" || location.pathname === "/";

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [draftVisits, setDraftVisits] = useState<DraftVisit[]>([]);
  const [visitId, setVisitId] = useState("");
  const [status, setStatus] = useState("Draft");
  const [businessMode, setBusinessMode] = useState<"existing" | "new">("existing");
  const [newBusinessName, setNewBusinessName] = useState("");
  const [visitSource, setVisitSource] = useState<"new" | "planned">("new");
  const [selectedDraftId, setSelectedDraftId] = useState("");
  const [currentCategory, setCurrentCategory] = useState("");
  const [responseDrafts, setResponseDrafts] = useState<Record<number, ResponseDraft>>({});
  const [responsesByQuestion, setResponsesByQuestion] = useState<Record<number, ResponseRecord>>({});
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);
  const [isCreatingVisit, setIsCreatingVisit] = useState(false);
  const [isSubmittingVisit, setIsSubmittingVisit] = useState(false);
  const [savingQuestionId, setSavingQuestionId] = useState<number | null>(null);
  const [submissionSignature, setSubmissionSignature] = useState({ name: "", email: "", submitted_at: "" });
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [visitForm, setVisitForm] = useState({
    business_id: "",
    representative_id: userId,
    visit_date: "",
    visit_type: "Planned",
  });
  const animationRef = useRef<HTMLDivElement | null>(null);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((kind: ToastItem["kind"], title: string, duration = 2600) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, kind, title }]);
    window.setTimeout(() => dismissToast(id), duration);
  }, [dismissToast]);

  const visibleQuestions = useMemo(() => {
    const q16Question = questions.find((q) => q.question_key === Q16_KEY);
    const q16Answer = q16Question ? responseDrafts[q16Question.id]?.answer_text || responsesByQuestion[q16Question.id]?.answer_text || "" : "";
    const q16IsYes = q16Answer === "Y";
    return questions.filter((q) => q.question_key !== Q17_KEY || q16IsYes);
  }, [questions, responseDrafts, responsesByQuestion]);

  const groupedQuestions = useMemo(() => {
    const grouped = visibleQuestions.reduce<Record<string, Question[]>>((acc, question) => {
      const key = question.category || "General";
      if (!acc[key]) acc[key] = [];
      acc[key].push(question);
      return acc;
    }, {});

    return Object.keys(grouped).sort((a, b) => {
      const aIndex = QUESTION_CATEGORY_ORDER.indexOf(a);
      const bIndex = QUESTION_CATEGORY_ORDER.indexOf(b);
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }, [visibleQuestions]);

  useEffect(() => {
    if (groupedQuestions.length > 0 && !currentCategory) {
      setCurrentCategory(groupedQuestions[0]);
    }
  }, [groupedQuestions, currentCategory]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const targets = gsap.utils.toArray(".animate-target");
      if (!targets.length) return;
      gsap.fromTo(targets, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.35, stagger: 0.04, ease: "power2.out" });
    }, animationRef);
    return () => ctx.revert();
  }, [isPlannedRoute, groupedQuestions.length, draftVisits.length]);

  useEffect(() => {
    if (!message) return;
    pushToast("success", message);
  }, [message, pushToast]);

  useEffect(() => {
    if (!error) return;
    pushToast("error", error, 3400);
  }, [error, pushToast]);

  useEffect(() => {
    const loadBusinesses = async () => {
      const res = await fetch(`${API_BASE}/survey-businesses`, { headers });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Failed to load businesses");
        return;
      }
      const rows = Array.isArray(data) ? data : [];
      setBusinesses(rows);
      if (rows.length > 0) {
        setVisitForm((prev) => ({ ...prev, business_id: prev.business_id || String(rows[0].id) }));
      }
    };

    const loadQuestions = async () => {
      const params = new URLSearchParams({ survey_type: "B2B" });
      const res = await fetch(`${API_BASE}/questions?${params.toString()}`, { headers });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Failed to load questions");
        return;
      }
      const rows = Array.isArray(data) ? data : [];
      setQuestions(rows);
      setResponseDrafts((prev) => {
        const next = { ...prev };
        rows.forEach((question: Question) => {
          if (!next[question.id]) next[question.id] = { ...emptyDraft };
        });
        return next;
      });
    };

    loadBusinesses();
    loadQuestions();
  }, [headers]);

  const loadDrafts = async () => {
    setIsLoadingDrafts(true);
    setError("");
    const params = new URLSearchParams({
      status: "Draft",
      survey_type: "B2B",
      _cb: Date.now().toString(),
    });
    const res = await fetch(`${API_BASE}/dashboard-visits/all?${params.toString()}`, { headers });
    const data = await res.json();
    setIsLoadingDrafts(false);
    if (!res.ok) {
      setError(data.detail || "Failed to load draft visits");
      return;
    }
    const rows = Array.isArray(data) ? data : [];
    setDraftVisits(rows.map((item) => ({ ...item, visit_id: item.visit_id || item.id })));
  };

  useEffect(() => {
    loadDrafts();
  }, [headers]);

  const loadVisitResponses = async (targetVisitId: string) => {
    if (!targetVisitId) return;
    const res = await fetch(`${API_BASE}/dashboard-visits/${targetVisitId}?_cb=${Date.now()}`, { headers });
    const data = await res.json();
    if (!res.ok) return;

    const nextResponses: Record<number, ResponseRecord> = {};
    const nextDrafts: Record<number, ResponseDraft> = {};
    (data.responses || []).forEach((response: ResponseRecord) => {
      nextResponses[response.question_id] = response;
      nextDrafts[response.question_id] = {
        score: String(response.score ?? ""),
        answer_text: response.answer_text || "",
        verbatim: response.verbatim || "",
        actions: (response.actions || []).map((action) => ({
          action_required: action.action_required || "",
          action_owner: action.action_owner || "",
          action_timeframe: action.action_timeframe || "",
          action_support_needed: action.action_support_needed || "",
        })),
      };
    });
    setResponsesByQuestion(nextResponses);
    setResponseDrafts((prev) => ({ ...prev, ...nextDrafts }));
    setSubmissionSignature({
      name: data.submitted_by_name || "",
      email: data.submitted_by_email || "",
      submitted_at: data.submitted_at || "",
    });
  };

  const resolveBusinessName = (draft: DraftVisit) => {
    if (draft.business_name) return draft.business_name;
    const match = businesses.find((business) => business.id === draft.business_id);
    return match ? match.name : "Business";
  };

  const handleSelectPlannedVisit = async (draft: DraftVisit) => {
    const selectedId = draft.visit_id ?? draft.id ?? "";
    if (!selectedId) return;
    setSelectedDraftId(selectedId);
    setVisitSource("planned");
    pushToast("info", "Loading planned visit...", 1600);
    setVisitId(selectedId);
    setStatus(draft.status || "Draft");
    setVisitForm((prev) => ({ ...prev, business_id: String(draft.business_id || ""), visit_date: draft.visit_date || "", visit_type: "Planned" }));
    await loadVisitResponses(selectedId);
    setMessage(`Loaded planned visit for ${resolveBusinessName(draft)}.`);
    navigate("/survey");
  };

  const createBusinessIfNeeded = async () => {
    if (businessMode !== "new") return null;
    const name = newBusinessName.trim();
    if (!name) {
      setError("Enter a business name.");
      return null;
    }
    const res = await fetch(`${API_BASE}/api/b2b/businesses`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name, priority_level: "medium", active: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || "Failed to create business");
      return null;
    }
    setBusinesses((prev) => [data, ...prev]);
    setVisitForm((prev) => ({ ...prev, business_id: String(data.id) }));
    setNewBusinessName("");
    return data.id;
  };

  const handleCreateVisit = async () => {
    pushToast("info", visitSource === "planned" ? "Preparing planned visit..." : "Creating visit...", 1500);
    setIsCreatingVisit(true);
    setError("");
    setMessage("");
    try {
      if (visitSource === "planned") {
        if (!selectedDraftId) {
          setError("Select a planned visit first.");
          return;
        }
        const res = await fetch(`${API_BASE}/dashboard-visits/${selectedDraftId}/draft?_cb=${Date.now()}`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ representative_id: Number(userId), visit_date: visitForm.visit_date, visit_type: visitForm.visit_type }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.detail || "Failed to update planned visit");
          return;
        }
        setVisitId(data.visit_id);
        setStatus(data.status || "Draft");
        await Promise.all([loadDrafts(), loadVisitResponses(data.visit_id)]);
        setMessage("Planned visit loaded and ready for responses.");
        navigate("/survey");
        return;
      }

      const createdBusinessId = await createBusinessIfNeeded();
      if (businessMode === "new" && !createdBusinessId) return;

      const payload = {
        business_id: Number(createdBusinessId || visitForm.business_id),
        representative_id: Number(visitForm.representative_id),
        visit_date: visitForm.visit_date,
        visit_type: visitForm.visit_type,
        meeting_attendees: [],
      };
      const res = await fetch(`${API_BASE}/dashboard-visits?_cb=${Date.now()}`, { method: "POST", headers, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Failed to create visit");
        return;
      }
      setVisitId(data.visit_id);
      setStatus(data.status || "Draft");
      await loadDrafts();
      await loadVisitResponses(data.visit_id);
      setMessage("Visit created. You can now fill the survey.");
      navigate("/survey");
    } finally {
      setIsCreatingVisit(false);
    }
  };

  const updateQuestionDraft = (questionId: number, field: keyof ResponseDraft, value: string) => {
    setResponseDrafts((prev) => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || { ...emptyDraft }),
        [field]: value,
      },
    }));
  };

  const addActionItem = (questionId: number) => {
    setResponseDrafts((prev) => {
      const current = prev[questionId] || { ...emptyDraft };
      return {
        ...prev,
        [questionId]: {
          ...current,
          actions: [...(current.actions || []), { action_required: "", action_owner: "", action_timeframe: "", action_support_needed: "" }],
        },
      };
    });
  };

  const updateActionItem = (questionId: number, index: number, field: keyof ActionItem, value: string) => {
    setResponseDrafts((prev) => {
      const current = prev[questionId] || { ...emptyDraft };
      const nextActions = [...(current.actions || [])];
      if (!nextActions[index]) return prev;
      nextActions[index] = { ...nextActions[index], [field]: value };
      return {
        ...prev,
        [questionId]: { ...current, actions: nextActions },
      };
    });
  };

  const removeActionItem = (questionId: number, index: number) => {
    setResponseDrafts((prev) => {
      const current = prev[questionId] || { ...emptyDraft };
      return {
        ...prev,
        [questionId]: { ...current, actions: (current.actions || []).filter((_, i) => i !== index) },
      };
    });
  };

  const handleSaveQuestionResponse = async (question: Question) => {
    if (!visitId) {
      setError("Create or select a visit first.");
      return;
    }

    const responseForm = responseDrafts[question.id] || { ...emptyDraft };
    const scoreNum = Number(responseForm.score);

    if (question.input_type === "score") {
      const min = question.score_min ?? 0;
      const max = question.score_max ?? 10;
      if (responseForm.score === "" || Number.isNaN(scoreNum) || scoreNum < min || scoreNum > max) {
        setError(`Enter a valid score (${min}-${max}) for this question.`);
        return;
      }
    }

    if (question.input_type === "text" && question.is_mandatory && !responseForm.answer_text.trim()) {
      setError("This text question requires an answer.");
      return;
    }

    if (question.input_type === "yes_no" && !["Y", "N"].includes(responseForm.answer_text || "")) {
      setError("Select Yes or No.");
      return;
    }

    if (question.input_type === "always_sometimes_never" && !["Always", "Sometimes", "Never"].includes(responseForm.answer_text || "")) {
      setError("Select Always, Sometimes, or Never.");
      return;
    }

    const normalizedActions = (responseForm.actions || [])
      .map((action) => ({
        action_required: action.action_required?.trim() || "",
        action_owner: action.action_owner?.trim() || "",
        action_timeframe: action.action_timeframe || "",
        action_support_needed: action.action_support_needed?.trim() || "",
      }))
      .filter((action) => action.action_required || action.action_owner || action.action_timeframe || action.action_support_needed);

    if (normalizedActions.some((action) => !action.action_required || !action.action_owner || !action.action_timeframe)) {
      setError("Each action needs Action Required, Lead Owner, and Action Time.");
      return;
    }

    setSavingQuestionId(question.id);
    pushToast("info", `Saving response for Q${question.question_number || question.id}...`, 1400);
    const payload = {
      question_id: Number(question.id),
      score: question.input_type === "score" ? scoreNum : null,
      answer_text: question.input_type === "score" ? null : responseForm.answer_text?.trim() || null,
      verbatim: responseForm.verbatim?.trim() || null,
      actions: normalizedActions,
    };
    const existing = responsesByQuestion[question.id];
    const endpoint = existing
      ? `${API_BASE}/dashboard-visits/${visitId}/responses/${existing.response_id}?_cb=${Date.now()}`
      : `${API_BASE}/dashboard-visits/${visitId}/responses?_cb=${Date.now()}`;
    const method = existing ? "PUT" : "POST";
    const res = await fetch(endpoint, { method, headers, body: JSON.stringify(payload) });
    const data = await res.json();
    setSavingQuestionId(null);
    if (!res.ok) {
      setError(data.detail || "Failed to save response");
      return;
    }
    setMessage(existing ? "Response updated." : "Response saved.");
    await loadVisitResponses(visitId);
  };

  const handleSubmitVisit = async () => {
    if (!visitId) {
      setError("Create a visit first.");
      return;
    }
    const mandatoryQuestions = visibleQuestions.filter((question) => question.is_mandatory);
    const unanswered = mandatoryQuestions.filter((question) => !responsesByQuestion[question.id]);
    if (unanswered.length > 0) {
      setError(`Complete all required questions before submit (${unanswered.length} remaining).`);
      return;
    }

    setIsSubmittingVisit(true);
    pushToast("info", "Submitting visit for review...", 1600);
    const res = await fetch(`${API_BASE}/dashboard-visits/${visitId}/submit?_cb=${Date.now()}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ submit_notes: null }),
    });
    const data = await res.json();
    setIsSubmittingVisit(false);
    if (!res.ok) {
      setError(data.detail || "Failed to submit visit");
      return;
    }
    setStatus(data.status || "Pending");
    setMessage("Visit submitted for review.");
    await loadDrafts();
  };

  const todayString = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);

  const sortByPriority = (items: DraftVisit[]) => {
    const rank = { high: 0, medium: 1, low: 2 };
    return [...items].sort((a, b) => {
      const aPriority = rank[a.business_priority || "low"] ?? 3;
      const bPriority = rank[b.business_priority || "low"] ?? 3;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return String(a.visit_date || "").localeCompare(String(b.visit_date || ""));
    });
  };

  const plannedToday = sortByPriority(draftVisits.filter((visit) => (visit.visit_date || "") === todayString));
  const plannedUpcoming = sortByPriority(draftVisits.filter((visit) => (visit.visit_date || "") > todayString));

  return (
    <div ref={animationRef}>
      <div className="fixed right-4 top-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`animate-in fade-in slide-in-from-top-2 rounded-md border px-3 py-2 text-sm shadow-sm ${
              toast.kind === "success"
                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200"
                : toast.kind === "error"
                ? "border-rose-500/50 bg-rose-500/15 text-rose-700 dark:text-rose-100"
                : "border-sky-500/40 bg-sky-500/15 text-sky-700 dark:text-sky-100"
            }`}
            role="status"
            onClick={() => dismissToast(toast.id)}
          >
            {toast.title}
          </div>
        ))}
      </div>
      <PageContainer className="space-y-6">
      {error ? <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
      {message ? <div className="rounded-md border border-success/50 bg-success/10 p-3 text-sm text-success">{message}</div> : null}

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="animate-target">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Visit Workspace
            </CardTitle>
            <CardDescription>Create visits, capture responses, and submit for review with mobile-first controls.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-md bg-muted p-3">
              <p className="text-xs text-muted-foreground">Current Visit</p>
              <p className="font-semibold">{visitId ? visitId.slice(0, 8) : "Not selected"}</p>
            </div>
            <div className="rounded-md bg-muted p-3">
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="font-semibold">{status}</p>
            </div>
            <div className="rounded-md bg-muted p-3">
              <p className="text-xs text-muted-foreground">Mandatory Progress</p>
              <p className="font-semibold">
                {visibleQuestions.filter((q) => q.is_mandatory && responsesByQuestion[q.id]).length}/{visibleQuestions.filter((q) => q.is_mandatory).length}
              </p>
            </div>
            <div className="rounded-md bg-muted p-3 md:col-span-3">
              <p className="text-xs text-muted-foreground">Audit Signature</p>
              <p className="font-semibold">
                {submissionSignature.name || submissionSignature.email
                  ? `${submissionSignature.name || "Unknown"} (${submissionSignature.email || "No email"})`
                  : "Not submitted yet"}
              </p>
              {submissionSignature.submitted_at ? <p className="text-xs text-muted-foreground">Submitted at: {submissionSignature.submitted_at}</p> : null}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {isPlannedRoute ? (
        <>
          <Card className="animate-target">
            <CardHeader>
              <CardTitle>Planned Visits</CardTitle>
              <CardDescription>Choose an existing planned visit or create a new visit.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={loadDrafts}>{isLoadingDrafts ? "Refreshing..." : "Refresh"}</Button>
              </div>

              {draftVisits.length === 0 ? (
                <div className="rounded-lg border p-6 text-center">
                  <div className="mx-auto h-36 w-36">
                    <Lottie animationData={emptyStateAnimation} loop />
                  </div>
                  <p className="text-sm text-muted-foreground">No planned visits available yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs font-semibold text-muted-foreground">TODAY</p>
                    <div className="space-y-3 lg:hidden">
                      {plannedToday.length === 0 ? (
                        <Card>
                          <CardContent className="p-4 text-sm text-muted-foreground">No visits planned for today.</CardContent>
                        </Card>
                      ) : (
                        plannedToday.map((draft) => {
                          const id = draft.visit_id || draft.id || "";
                          return (
                            <Card key={id}>
                              <CardContent className="space-y-3 p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold">{resolveBusinessName(draft)}</p>
                                    <p className="text-xs text-muted-foreground">Visit ID: {id || "--"}</p>
                                  </div>
                                  <Badge variant="secondary">{draft.status || "Draft"}</Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                  <div>
                                    <p className="text-xs text-muted-foreground">Date</p>
                                    <p>{draft.visit_date || "--"}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Progress</p>
                                    <p>{draft.mandatory_answered_count || 0}/{draft.mandatory_total_count || 0}</p>
                                  </div>
                                </div>
                                <Button className="w-full" onClick={() => handleSelectPlannedVisit(draft)}>
                                  Continue <ArrowRight className="h-4 w-4" />
                                </Button>
                              </CardContent>
                            </Card>
                          );
                        })
                      )}
                    </div>

                    <div className="hidden lg:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Business</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Progress</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {plannedToday.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5}>No visits planned for today.</TableCell>
                            </TableRow>
                          ) : (
                            plannedToday.map((draft) => {
                              const id = draft.visit_id || draft.id || "";
                              return (
                                <TableRow key={id}>
                                  <TableCell>{resolveBusinessName(draft)}</TableCell>
                                  <TableCell>{draft.visit_date || "--"}</TableCell>
                                  <TableCell>{draft.mandatory_answered_count || 0}/{draft.mandatory_total_count || 0}</TableCell>
                                  <TableCell><Badge variant="secondary">{draft.status || "Draft"}</Badge></TableCell>
                                  <TableCell>
                                    <Button size="sm" onClick={() => handleSelectPlannedVisit(draft)}>
                                      Continue <ArrowRight className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold text-muted-foreground">UPCOMING</p>
                    <div className="space-y-3 lg:hidden">
                      {plannedUpcoming.length === 0 ? (
                        <Card>
                          <CardContent className="p-4 text-sm text-muted-foreground">No upcoming planned visits.</CardContent>
                        </Card>
                      ) : (
                        plannedUpcoming.map((draft) => {
                          const id = draft.visit_id || draft.id || "";
                          const priority = draft.business_priority || "medium";
                          return (
                            <Card key={id}>
                              <CardContent className="space-y-3 p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold">{resolveBusinessName(draft)}</p>
                                    <p className="text-xs text-muted-foreground">Visit ID: {id || "--"}</p>
                                  </div>
                                  <Badge variant={priority === "high" ? "destructive" : priority === "medium" ? "warning" : "success"}>{priority}</Badge>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Date</p>
                                  <p className="text-sm">{draft.visit_date || "--"}</p>
                                </div>
                                <Button className="w-full" variant="outline" onClick={() => handleSelectPlannedVisit(draft)}>Open</Button>
                              </CardContent>
                            </Card>
                          );
                        })
                      )}
                    </div>

                    <div className="hidden lg:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Business</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {plannedUpcoming.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4}>No upcoming planned visits.</TableCell>
                            </TableRow>
                          ) : (
                            plannedUpcoming.map((draft) => {
                              const id = draft.visit_id || draft.id || "";
                              const priority = draft.business_priority || "medium";
                              return (
                                <TableRow key={id}>
                                  <TableCell>{resolveBusinessName(draft)}</TableCell>
                                  <TableCell>{draft.visit_date || "--"}</TableCell>
                                  <TableCell><Badge variant={priority === "high" ? "destructive" : priority === "medium" ? "warning" : "success"}>{priority}</Badge></TableCell>
                                  <TableCell><Button size="sm" variant="outline" onClick={() => handleSelectPlannedVisit(draft)}>Open</Button></TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="animate-target">
            <CardHeader>
              <CardTitle>Create / Prepare Visit</CardTitle>
              <CardDescription>Use this form to create a new visit or load a selected planned visit.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Source</label>
                  <Select value={visitSource} onChange={(event) => setVisitSource(event.target.value as "new" | "planned")}>
                    <option value="new">Create new visit</option>
                    <option value="planned">Use planned visit</option>
                  </Select>
                </div>
                {visitSource === "new" ? (
                  <div>
                    <label className="mb-1 block text-sm font-medium">Business Mode</label>
                    <Select value={businessMode} onChange={(event) => setBusinessMode(event.target.value as "existing" | "new")}>
                      <option value="existing">Use existing business</option>
                      <option value="new">Create business now</option>
                    </Select>
                  </div>
                ) : null}
                {visitSource === "new" && businessMode === "existing" ? (
                  <div>
                    <label className="mb-1 block text-sm font-medium">Business</label>
                    <Select value={visitForm.business_id} onChange={(event) => setVisitForm((prev) => ({ ...prev, business_id: event.target.value }))}>
                      {businesses.map((business) => (
                        <option key={business.id} value={String(business.id)}>{business.name}</option>
                      ))}
                    </Select>
                  </div>
                ) : null}
                {visitSource === "new" && businessMode === "new" ? (
                  <div>
                    <label className="mb-1 block text-sm font-medium">New Business Name</label>
                    <Input value={newBusinessName} onChange={(event) => setNewBusinessName(event.target.value)} placeholder="Enter business name" />
                  </div>
                ) : null}
                {visitSource === "planned" ? (
                  <div>
                    <label className="mb-1 block text-sm font-medium">Selected Planned Visit ID</label>
                    <Input value={selectedDraftId} disabled placeholder="Choose from table above" />
                  </div>
                ) : null}
                <div>
                  <label className="mb-1 block text-sm font-medium">Visit Date</label>
                  <Input type="date" value={visitForm.visit_date} onChange={(event) => setVisitForm((prev) => ({ ...prev, visit_date: event.target.value }))} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Visit Type</label>
                  <Select value={visitForm.visit_type} onChange={(event) => setVisitForm((prev) => ({ ...prev, visit_type: event.target.value }))}>
                    <option value="Planned">Planned</option>
                    <option value="Priority">Priority</option>
                    <option value="Substitution">Substitution</option>
                  </Select>
                </div>
              </div>
              <Button className="w-full sm:w-auto" onClick={handleCreateVisit} disabled={isCreatingVisit || !visitForm.visit_date}>
                {isCreatingVisit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Prepare Visit
              </Button>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <Card className="animate-target">
            <CardHeader>
              <CardTitle>Survey Responses</CardTitle>
              <CardDescription>Capture responses by category. Use save per question, then submit the visit.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!visitId ? (
                <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                  No visit selected. Go to Planned Visits, select or create a visit, then return here.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {groupedQuestions.map((category) => (
                      <Button
                        key={category}
                        size="sm"
                        variant={currentCategory === category ? "default" : "outline"}
                        onClick={() => {
                          setCurrentCategory(category);
                          document.getElementById(categoryToId(category))?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                      >
                        {category}
                      </Button>
                    ))}
                  </div>

                  <div className="space-y-6">
                    {groupedQuestions.map((category) => (
                      <div key={category} id={categoryToId(category)} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-base font-semibold">{category}</h3>
                          <Badge variant="outline">{visibleQuestions.filter((q) => q.category === category).length} questions</Badge>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                          {visibleQuestions
                            .filter((q) => q.category === category)
                            .map((question) => {
                              const draft = responseDrafts[question.id] || { ...emptyDraft };
                              const choices = parseChoices(question);
                              const saving = savingQuestionId === question.id;
                              return (
                                <Card key={question.id}>
                                  <CardHeader>
                                    <CardTitle className="text-sm">Q{question.question_number || question.id} - {question.question_text}</CardTitle>
                                    <CardDescription>
                                      <span className="inline-flex gap-2">
                                        <Badge variant="secondary">{question.input_type}</Badge>
                                        {question.is_mandatory ? <Badge variant="warning">Required</Badge> : null}
                                      </span>
                                    </CardDescription>
                                  </CardHeader>
                                  <CardContent className="space-y-4">
                                    {question.input_type === "score" ? (
                                      <Input
                                        type="number"
                                        min={question.score_min ?? 0}
                                        max={question.score_max ?? 10}
                                        value={draft.score}
                                        onChange={(event) => updateQuestionDraft(question.id, "score", event.target.value)}
                                      />
                                    ) : question.input_type === "yes_no" ? (
                                      <div className="flex gap-2">
                                        <Button variant={draft.answer_text === "Y" ? "default" : "outline"} onClick={() => updateQuestionDraft(question.id, "answer_text", "Y")}>Yes</Button>
                                        <Button variant={draft.answer_text === "N" ? "default" : "outline"} onClick={() => updateQuestionDraft(question.id, "answer_text", "N")}>No</Button>
                                      </div>
                                    ) : question.input_type === "always_sometimes_never" ? (
                                      <Select value={draft.answer_text} onChange={(event) => updateQuestionDraft(question.id, "answer_text", event.target.value)}>
                                        <option value="">Select one</option>
                                        <option value="Always">Always</option>
                                        <option value="Sometimes">Sometimes</option>
                                        <option value="Never">Never</option>
                                      </Select>
                                    ) : choices.length > 0 ? (
                                      <div className="flex flex-wrap gap-2">
                                        {choices.map((choice) => (
                                          <Button
                                            key={choice}
                                            variant={draft.answer_text === choice ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => updateQuestionDraft(question.id, "answer_text", choice)}
                                          >
                                            {choice}
                                          </Button>
                                        ))}
                                      </div>
                                    ) : (
                                      <Textarea value={draft.answer_text} onChange={(event) => updateQuestionDraft(question.id, "answer_text", event.target.value)} />
                                    )}

                                    <div>
                                      <label className="mb-1 block text-sm font-medium">Verbatim</label>
                                      <Textarea value={draft.verbatim} onChange={(event) => updateQuestionDraft(question.id, "verbatim", event.target.value)} />
                                    </div>

                                    <div className="space-y-2 rounded-md border bg-muted/40 p-3">
                                      <div className="flex items-center justify-between">
                                        <p className="text-sm font-medium">Actions</p>
                                        <Button size="sm" variant="outline" onClick={() => addActionItem(question.id)}>Add Action</Button>
                                      </div>
                                      {draft.actions.map((action, index) => (
                                        <div key={`${question.id}-action-${index}`} className="grid grid-cols-1 gap-2 rounded-md border bg-background p-3 md:grid-cols-2">
                                          <Input placeholder="Action required" value={action.action_required} onChange={(event) => updateActionItem(question.id, index, "action_required", event.target.value)} />
                                          <Input placeholder="Lead owner" value={action.action_owner} onChange={(event) => updateActionItem(question.id, index, "action_owner", event.target.value)} />
                                          <Input placeholder="Action timeframe" value={action.action_timeframe} onChange={(event) => updateActionItem(question.id, index, "action_timeframe", event.target.value)} />
                                          <Input placeholder="Support needed" value={action.action_support_needed} onChange={(event) => updateActionItem(question.id, index, "action_support_needed", event.target.value)} />
                                          <div className="md:col-span-2">
                                            <Button size="sm" variant="destructive" onClick={() => removeActionItem(question.id, index)}>
                                              Remove Action
                                            </Button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>

                                     <Button className="w-full sm:w-auto" onClick={() => handleSaveQuestionResponse(question)} disabled={saving}>
                                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Response
                                    </Button>
                                  </CardContent>
                                </Card>
                              );
                            })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {visitId ? (
            <Card className="animate-target">
              <CardHeader>
                <CardTitle>Submit Visit</CardTitle>
                <CardDescription>All required responses must be saved before submitting.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-3">
                <Button className="w-full sm:w-auto" onClick={handleSubmitVisit} disabled={isSubmittingVisit}>
                  {isSubmittingVisit ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Submit for Review
                </Button>
                <Badge variant="secondary">Current status: {status}</Badge>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
      </PageContainer>
    </div>
  );
}
