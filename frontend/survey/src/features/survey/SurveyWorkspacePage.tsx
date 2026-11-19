import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { gsap } from "gsap";
import Lottie from "lottie-react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, Clock3, Loader2, Plus, Save } from "lucide-react";
import emptyStateAnimation from "../../assets/empty-state-lottie.json";
import PageContainer from "../../components/layout/PageContainer";
import Disclosure from "../../components/Disclosure";
import { cn } from "../../lib/utils";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Textarea } from "../../components/ui/textarea";

const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const SURVEY_TYPE = String(import.meta.env.VITE_SURVEY_TYPE || "B2B");

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
const Q18_KEY = "q18_competitor_service_with_cws";
const ACTION_TIMEFRAME_OPTIONS = ["<1 month", "<3 months", "<6 months", ">6 months"];

type ApiHeaders = Record<string, string>;

type Business = {
  id: number;
  name: string;
  priority_level?: "large_corporate" | "sme" | "high" | "medium" | "low";
  active?: boolean;
};

type AccountExecutive = {
  id: number;
  name: string;
  email?: string;
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
  business_priority?: "large_corporate" | "sme" | "high" | "medium" | "low";
  visit_date?: string;
  status?: string;
  mandatory_answered_count?: number;
  mandatory_total_count?: number;
  is_started?: boolean;
  is_completed?: boolean;
  account_executive_name?: string;
  team_member_names?: string[];
  change_notes?: string | null;
};

type ActionItem = {
  action_required: string;
  action_owner: string;
  action_timeframe: string;
  action_support_needed: string;
  action_comments?: string;
};

type ResponseRecord = {
  response_id: string;
  question_id: number;
  score: number | null;
  answer_text: string | null;
  verbatim: string | null;
  actions?: ActionItem[];
  created_at?: string | null;
  updated_at?: string | null;
};

type ResponseDraft = {
  score: string;
  answer_text: string;
  verbatim: string;
  actions: ActionItem[];
};

type ToastKind = "info" | "success" | "error";

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

function normalizeYesNo(value: string | null | undefined): "Y" | "N" | "" {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "y" || normalized === "yes") return "Y";
  if (normalized === "n" || normalized === "no") return "N";
  return "";
}

function categoryToId(value: string) {
  return `category-${String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
}

function getScoreRangeLabel(question: Question) {
  if (question.input_type !== "score") return "";
  const min = question.score_min ?? 0;
  const max = question.score_max ?? 10;
  return `${min}-${max}`;
}

function getScoreOptions(question: Question) {
  if (question.input_type !== "score") return [];
  const min = Number(question.score_min ?? 0);
  const max = Number(question.score_max ?? 10);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) return [];
  const options: number[] = [];
  for (let value = min; value <= max; value += 1) {
    options.push(value);
  }
  return options;
}

function getScoreValidationMessage(question: Question, scoreValue: string) {
  if (question.input_type !== "score") return "";
  if (scoreValue === "") return "";
  const min = question.score_min ?? 0;
  const max = question.score_max ?? 10;
  const parsed = Number(scoreValue);
  if (!Number.isFinite(parsed)) return `Enter a number from ${min} to ${max}.`;
  if (parsed < min || parsed > max) return `Score must be between ${min} and ${max}.`;
  return "";
}

function normalizeTeamMemberNames(values: string[]) {
  const normalized: string[] = [];
  values.forEach((value) => {
    const trimmed = String(value || "").trim();
    if (trimmed && !normalized.includes(trimmed)) {
      normalized.push(trimmed);
    }
  });
  return normalized;
}

function businessTypeLabel(value?: string) {
  const normalized = String(value || "").toLowerCase();
  return normalized === "large_corporate" || normalized === "high" ? "Large Business/Corporate" : "SME";
}

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function normalizeResponseDraftForCompare(draft: ResponseDraft) {
  return {
    score: String(draft?.score ?? ""),
    answer_text: String(draft?.answer_text ?? "").trim(),
    verbatim: String(draft?.verbatim ?? "").trim(),
    actions: JSON.stringify(draft?.actions || []),
  };
}

function normalizeResponseRecordForCompare(record?: ResponseRecord | null) {
  return {
    score: String(record?.score ?? ""),
    answer_text: String(record?.answer_text ?? "").trim(),
    verbatim: String(record?.verbatim ?? "").trim(),
    actions: JSON.stringify(record?.actions || []),
  };
}

// Status badge that also surfaces the reviewer's note when a visit was sent back for changes.
function DraftStatusBadge({ draft }: { draft: DraftVisit }) {
  return (
    <div className="space-y-1">
      <Badge variant="secondary">{draft.status || "Draft"}</Badge>
      {draft.change_notes ? (
        <p className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900">
          <span className="font-semibold">Changes requested:</span> {draft.change_notes}
        </p>
      ) : null}
    </div>
  );
}

export default function SurveyWorkspacePage({ headers, userId, role }: SurveyWorkspacePageProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isPlannedRoute = location.pathname === "/planned" || location.pathname === "/";

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [accountExecutives, setAccountExecutives] = useState<AccountExecutive[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionnaireState, setQuestionnaireState] = useState("unloaded");
  const [draftVisits, setDraftVisits] = useState<DraftVisit[]>([]);
  const [submittedVisits, setSubmittedVisits] = useState<DraftVisit[]>([]);
  const [isLoadingSubmitted, setIsLoadingSubmitted] = useState(false);
  const [isViewingSubmitted, setIsViewingSubmitted] = useState(false);
  const [visitId, setVisitId] = useState("");
  const [status, setStatus] = useState("Draft");
  const [businessMode, setBusinessMode] = useState<"existing" | "new">("existing");
  const [newBusinessName, setNewBusinessName] = useState("");
  const [visitSource, setVisitSource] = useState<"new" | "planned">("new");
  const [selectedDraftId, setSelectedDraftId] = useState("");
  const [accountExecutiveSearch, setAccountExecutiveSearch] = useState("");
  const [newAccountExecutiveName, setNewAccountExecutiveName] = useState("");
  const [newAccountExecutiveEmail, setNewAccountExecutiveEmail] = useState("");
  const [currentCategory, setCurrentCategory] = useState("");
  const [responseDrafts, setResponseDrafts] = useState<Record<number, ResponseDraft>>({});
  const [responsesByQuestion, setResponsesByQuestion] = useState<Record<number, ResponseRecord>>({});
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);
  const [isCreatingVisit, setIsCreatingVisit] = useState(false);
  const [isCreatingAccountExecutive, setIsCreatingAccountExecutive] = useState(false);
  const [isSubmittingVisit, setIsSubmittingVisit] = useState(false);
  const [savingQuestionId, setSavingQuestionId] = useState<number | null>(null);
  const [submissionSignature, setSubmissionSignature] = useState({ name: "", email: "", submitted_at: "" });
  const [visitForm, setVisitForm] = useState({
    business_id: "",
    representative_id: userId,
    visit_date: "",
    visit_type: "Planned",
    account_executive_name: "",
    team_member_names: [""],
  });
  const animationRef = useRef<HTMLDivElement | null>(null);
  type VisitOwner = { id: string; saves: Set<number>; records?: Record<number, ResponseRecord>; uncertain?: Set<number>; submitting?: boolean };
  const visitScope = useRef<VisitOwner>({ id: "", saves: new Set<number>() });
  const responseReadScope = useRef<object | null>(null);
  const responseDraftsRef = useRef(responseDrafts);
  responseDraftsRef.current = responseDrafts;
  const overdueInFlight = useRef(new Set<string>());
  useEffect(() => () => { visitScope.current = { id: "", saves: new Set<number>() }; }, [headers]);
  useEffect(() => {
    if (isPlannedRoute) visitScope.current = { id: "", saves: new Set<number>() };
  }, [isPlannedRoute]);
  const canManageAccountExecutives = role === "Admin";

  const pushToast = useCallback((kind: ToastKind, title: string, duration = 2600) => {
    if (kind === "success") toast.success(title, { duration });
    else if (kind === "error") toast.error(title, { duration });
    else toast.info(title, { duration });
  }, []);

  const visibleQuestions = useMemo(() => {
    const q16Question = questions.find((q) => q.question_key === Q16_KEY);
    const q16Answer = q16Question
      ? (Object.prototype.hasOwnProperty.call(responseDrafts, q16Question.id)
        ? responseDrafts[q16Question.id]?.answer_text
        : responsesByQuestion[q16Question.id]?.answer_text) || ""
      : "";
    const q16IsYes = normalizeYesNo(q16Answer) === "Y";
    return questions.filter((q) => (q.question_key !== Q17_KEY && q.question_key !== Q18_KEY) || q16IsYes);
  }, [questions, responseDrafts, responsesByQuestion]);

  const questionnaireReady = questionnaireState === "ready" && visibleQuestions.length > 0;

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
      setQuestionnaireState("loading");
      try {
        const params = new URLSearchParams({ survey_type: SURVEY_TYPE });
        const res = await fetch(`${API_BASE}/questions?${params.toString()}`, { headers });
        const data = await res.json();
        if (!res.ok) {
          setQuestionnaireState("error");
          setError(data.detail || "Failed to load questions");
          return;
        }
        const rows = (Array.isArray(data) ? data : []).map((question: Question & { order_index?: number; order?: number }) => ({
          ...question,
          question_number: question.question_number ?? question.order_index ?? question.order ?? question.id,
        }));
        setQuestions(rows);
        setQuestionnaireState(rows.length ? "ready" : "empty");
        setResponseDrafts((prev) => {
          const next = { ...prev };
          rows.forEach((question: Question) => {
            if (!next[question.id]) next[question.id] = { ...emptyDraft };
          });
          return next;
        });
      } catch {
        setQuestionnaireState("error");
        setError("Failed to load questions. Reload the page to try again.");
      }
    };

    const loadAccountExecutives = async () => {
      const res = await fetch(`${API_BASE}/b2b/public/account-executives`, { headers });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Failed to load account executives");
        return;
      }
      const rows = Array.isArray(data) ? data : [];
      setAccountExecutives(rows);
    };

    loadBusinesses();
    loadQuestions();
    loadAccountExecutives();
  }, [headers]);

  const loadDrafts = async (owner?: typeof visitScope.current) => {
    setIsLoadingDrafts(true);
    setError("");
    const params = new URLSearchParams({
      status: "Draft",
      survey_type: SURVEY_TYPE,
      _cb: Date.now().toString(),
    });
    const res = await fetch(`${API_BASE}/dashboard-visits/all?${params.toString()}`, { headers });
    const data = await res.json();
    if (owner && owner !== visitScope.current) return;
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

  const loadSubmittedVisits = async () => {
    setIsLoadingSubmitted(true);
    setError("");
    const params = new URLSearchParams({
      survey_type: SURVEY_TYPE,
      _cb: Date.now().toString(),
    });
    const res = await fetch(`${API_BASE}/dashboard-visits/all?${params.toString()}`, { headers });
    const data = await res.json();
    setIsLoadingSubmitted(false);
    if (!res.ok) {
      setError(data.detail || "Failed to load submitted visits");
      return;
    }
    const rows = Array.isArray(data) ? data : [];
    setSubmittedVisits(
      rows
        .filter((item) => (item.status || "Draft") !== "Draft")
        .map((item) => ({ ...item, visit_id: item.visit_id || item.id }))
    );
  };

  useEffect(() => {
    loadSubmittedVisits();
  }, [headers]);

  const beginVisitSelection = (id: string) => {
    const owner: VisitOwner = { id, saves: new Set<number>() };
    visitScope.current = owner;
    responseReadScope.current = null;
    setResponseDrafts({});
    setResponsesByQuestion({});
    setSavingQuestionId(null);
    setIsSubmittingVisit(false);
    setIsCreatingVisit(false);
    setError("");
    setMessage("");
    return owner;
  };

  const loadVisitResponses = async (targetVisitId: string, preserveDrafts = false, owner = visitScope.current) => {
    if (!targetVisitId || owner !== visitScope.current || owner.id !== targetVisitId) return;
    const read = {};
    responseReadScope.current = read;
    const res = await fetch(`${API_BASE}/dashboard-visits/${targetVisitId}?_cb=${Date.now()}`, { headers });
    const data = await res.json();
    if (owner !== visitScope.current || responseReadScope.current !== read) return;
    if (!res.ok) { setError(data.detail || "Failed to verify saved responses."); return; }
    if (String(data.id ?? data.visit_id) !== String(targetVisitId)) {
      setError("Visit identity could not be verified. Your drafts are retained; check this same visit before retrying.");
      return;
    }

    const nextResponses: Record<number, ResponseRecord> = {};
    const nextDrafts: Record<number, ResponseDraft> = {};
    // Defensive: if the backend ever returns more than one row for a question
    // (legacy duplicate data prior to the UNIQUE constraint), keep only the
    // freshest so the review never renders repeated questions.
    const isFresher = (candidate: ResponseRecord, current: ResponseRecord) => {
      const key = (r: ResponseRecord) => r.updated_at || r.created_at || "";
      return key(candidate) >= key(current);
    };
    (data.responses || []).forEach((response: ResponseRecord) => {
      const existing = nextResponses[response.question_id];
      if (existing && !isFresher(response, existing)) return;
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
          action_comments: action.action_comments || "",
        })),
      };
    });
    owner.records = preserveDrafts ? { ...owner.records, ...nextResponses } : nextResponses;
    setResponsesByQuestion(nextResponses);
    if (!preserveDrafts) setResponseDrafts(nextDrafts);
    if (!preserveDrafts) {
    setSubmissionSignature({
      name: data.submitted_by_name || "",
      email: data.submitted_by_email || "",
      submitted_at: data.submitted_at || "",
    });
    setVisitForm((prev) => ({
      ...prev,
      business_id: data.business_id ? String(data.business_id) : prev.business_id,
      visit_date: data.visit_date || prev.visit_date,
      visit_type: data.visit_type || prev.visit_type,
      account_executive_name: data.account_executive_name || "",
      team_member_names: Array.isArray(data.team_member_names) && data.team_member_names.length > 0 ? data.team_member_names : [""],
    }));
    setAccountExecutiveSearch(data.account_executive_name || "");
    }
    return nextResponses;
  };

  const resolveBusinessName = (draft: DraftVisit) => {
    if (draft.business_name) return draft.business_name;
    const match = businesses.find((business) => business.id === draft.business_id);
    return match ? match.name : "Business";
  };

  const resolveActiveBusinessName = () => {
    if (!visitForm.business_id) return "No active survey selected";
    const match = businesses.find((business) => String(business.id) === String(visitForm.business_id));
    return match?.name || "Selected business";
  };

  const syncAccountExecutiveSelection = (value: string) => {
    setAccountExecutiveSearch(value);
    const match = accountExecutives.find((executive) => executive.name === value);
    setVisitForm((prev) => ({ ...prev, account_executive_name: match ? match.name : value }));
  };

  const createAccountExecutive = async () => {
    const trimmedName = newAccountExecutiveName.trim();
    const trimmedEmail = newAccountExecutiveEmail.trim();
    if (!trimmedName || !trimmedEmail) {
      setError("Enter both the account executive name and email before adding a new one.");
      return;
    }
    if (!looksLikeEmail(trimmedEmail)) {
      setError("Enter a valid account executive email address.");
      return;
    }

    setIsCreatingAccountExecutive(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/account-executives`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name: trimmedName, email: trimmedEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Failed to create account executive");
        return;
      }

      setAccountExecutives((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setVisitForm((prev) => ({ ...prev, account_executive_name: data.name }));
      setAccountExecutiveSearch(data.name);
      setNewAccountExecutiveName("");
      setNewAccountExecutiveEmail("");
      setMessage(`Account executive added: ${data.name}.`);
    } finally {
      setIsCreatingAccountExecutive(false);
    }
  };

  const handleSelectPlannedVisit = async (draft: DraftVisit, selection?: typeof visitScope.current) => {
    const selectedId = draft.visit_id ?? draft.id ?? "";
    if (!selectedId) return;
    const owner = selection || beginVisitSelection(selectedId);
    if (owner !== visitScope.current) return;
    setIsViewingSubmitted(false);
    setSelectedDraftId(selectedId);
    setVisitSource("planned");
    pushToast("info", "Loading planned visit...", 1600);
    setVisitId(selectedId);
    setStatus(draft.status || "Draft");
    setVisitForm((prev) => ({
      ...prev,
      business_id: String(draft.business_id || ""),
      visit_date: draft.visit_date || "",
      visit_type: "Planned",
      account_executive_name: draft.account_executive_name || prev.account_executive_name,
      team_member_names: Array.isArray(draft.team_member_names) && draft.team_member_names.length > 0
        ? draft.team_member_names
        : prev.team_member_names,
    }));
    setAccountExecutiveSearch(draft.account_executive_name || "");
    let records;
    try { records = await loadVisitResponses(selectedId, false, owner); }
    catch {
      if (owner !== visitScope.current) return;
      if (selection) throw new Error("Visit date accepted; readback failed.");
      setError("Could not load this visit. Check the connection and select the same visit again.");
      return;
    }
    if (owner !== visitScope.current || !records) return;
    setMessage(draft.change_notes ? `Loaded ${resolveBusinessName(draft)}. Reviewer asked for changes: ${draft.change_notes}` : `Loaded planned visit for ${resolveBusinessName(draft)}.`);
    navigate("/survey");
    return true;
  };

  const handleSelectOverdueVisit = async (draft: DraftVisit) => {
    const selectedId = draft.visit_id ?? draft.id ?? "";
    if (!selectedId || overdueInFlight.current.has(selectedId)) return;
    const confirmed = window.confirm(
      `This visit was planned for ${draft.visit_date || "an earlier date"}, which has already passed. ` +
        `Continuing will update the visit date to today (${todayString}). Continue?`
    );
    if (!confirmed) return;
    const owner = beginVisitSelection(selectedId);
    overdueInFlight.current.add(selectedId);
    let accepted = false;
    pushToast("info", "Updating visit date...", 1600);
    try {
      const res = await fetch(`${API_BASE}/dashboard-visits/${selectedId}/draft`, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ visit_date: todayString }),
      });
      const data = await res.json().catch(() => ({}));
      if (owner !== visitScope.current) return;
      if (!res.ok) {
        setError(data.detail || "Failed to update the visit date");
        return;
      }
      accepted = true;
      const loaded = await handleSelectPlannedVisit({ ...draft, visit_date: todayString }, owner);
      if (owner !== visitScope.current) return;
      if (!loaded) {
        setError("Visit date updated, but the visit could not be confirmed. Check this same visit before continuing; do not create another visit.");
        return;
      }
      // A successful PUT remains accepted even if subsequent verification fails.
      setVisitForm((prev) => ({ ...prev, visit_date: todayString }));
      await loadDrafts(owner);
    } catch (error) {
      if (owner !== visitScope.current) return;
      setError(accepted
        ? "Visit date updated, but the visit could not be confirmed. Check this same visit before continuing; do not create another visit."
        : (error instanceof Error ? error.message : "Could not confirm the visit date update. Check this visit before retrying."));
    } finally {
      overdueInFlight.current.delete(selectedId);
    }
  };

  const handleViewSubmittedVisit = async (draft: DraftVisit) => {
    const selectedId = draft.visit_id ?? draft.id ?? "";
    if (!selectedId) return;
    const owner = beginVisitSelection(selectedId);
    setIsViewingSubmitted(true);
    setVisitSource("planned");
    setSelectedDraftId(selectedId);
    pushToast("info", "Loading submitted visit...", 1600);
    setVisitId(selectedId);
    setStatus(draft.status || "Pending");
    setVisitForm((prev) => ({
      ...prev,
      business_id: String(draft.business_id || ""),
      visit_date: draft.visit_date || "",
      account_executive_name: draft.account_executive_name || prev.account_executive_name,
      team_member_names: Array.isArray(draft.team_member_names) && draft.team_member_names.length > 0
        ? draft.team_member_names
        : prev.team_member_names,
    }));
    setAccountExecutiveSearch(draft.account_executive_name || "");
    let records;
    try { records = await loadVisitResponses(selectedId, false, owner); }
    catch {
      if (owner === visitScope.current) setError("Could not load this submitted visit. Check the connection and try again.");
      return;
    }
    if (owner !== visitScope.current || !records) return;
    setMessage(`Viewing submitted visit for ${resolveBusinessName(draft)} (read-only, including any action points added during review).`);
    navigate("/survey");
  };

  const createBusinessIfNeeded = async () => {
    if (businessMode !== "new") return null;
    const name = newBusinessName.trim();
    if (!name) {
      setError("Enter a business name.");
      return null;
    }
    const res = await fetch(`${API_BASE}/b2b/businesses`, {
      method: "POST",
      headers,
          body: JSON.stringify({ name, priority_level: "sme", active: true }),
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
    const owner = beginVisitSelection(visitSource === "planned" ? selectedDraftId : "");
    pushToast("info", visitSource === "planned" ? "Preparing planned visit..." : "Creating visit...", 1500);
    setIsViewingSubmitted(false);
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
          body: JSON.stringify({
            representative_id: Number(userId),
            visit_date: visitForm.visit_date,
            visit_type: visitForm.visit_type,
            account_executive_name: visitForm.account_executive_name.trim() || null,
            team_member_names: normalizeTeamMemberNames(visitForm.team_member_names),
          }),
        });
        const data = await res.json();
        if (owner !== visitScope.current) return;
        if (!res.ok) {
          setError(data.detail || "Failed to update planned visit");
          return;
        }
        owner.id = data.visit_id;
      setVisitId(data.visit_id);
        setStatus(data.status || "Draft");
        await Promise.all([loadDrafts(owner), loadVisitResponses(data.visit_id, false, owner)]);
        if (owner !== visitScope.current) return;
        setMessage("Planned visit loaded and ready for responses.");
        navigate("/survey");
        return;
      }

      const createdBusinessId = await createBusinessIfNeeded();
      if (businessMode === "new" && !createdBusinessId) return;

      if (businessMode === "existing" && !visitForm.business_id) {
        setError("Select a business before creating a visit.");
        return;
      }

      const payload = {
        business_id: Number(createdBusinessId || visitForm.business_id),
        representative_id: Number(visitForm.representative_id || userId),
        visit_date: visitForm.visit_date,
        visit_type: visitForm.visit_type,
        survey_type: SURVEY_TYPE,
        account_executive_name: visitForm.account_executive_name.trim() || null,
        team_member_names: normalizeTeamMemberNames(visitForm.team_member_names),
      };
      const res = await fetch(`${API_BASE}/dashboard-visits?_cb=${Date.now()}`, { method: "POST", headers, body: JSON.stringify(payload) });
      const data = await res.json();
        if (owner !== visitScope.current) return;
      if (!res.ok) {
        setError(data.detail || "Failed to create visit");
        return;
      }
      owner.id = data.visit_id;
      setVisitId(data.visit_id);
      setStatus(data.status || "Draft");
      await loadDrafts(owner);
      if (owner !== visitScope.current) return;
      await loadVisitResponses(data.visit_id, false, owner);
      if (owner !== visitScope.current) return;
      setMessage("Visit created. You can now fill the survey.");
      navigate("/survey");
    } finally {
      if (owner === visitScope.current) setIsCreatingVisit(false);
    }
  };

  const saveActiveVisitDetails = async () => {
    const owner = visitScope.current;
    if (!visitId) {
      setError("No active survey to update.");
      return false;
    }
    pushToast("info", "Saving visit details...", 1500);
    setIsCreatingVisit(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`${API_BASE}/dashboard-visits/${visitId}/draft?_cb=${Date.now()}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          representative_id: Number(visitForm.representative_id || userId),
          visit_date: visitForm.visit_date,
          visit_type: visitForm.visit_type,
          account_executive_name: visitForm.account_executive_name.trim() || null,
          team_member_names: normalizeTeamMemberNames(visitForm.team_member_names),
        }),
      });
      const data = await res.json();
      if (owner !== visitScope.current) return false;
      if (!res.ok) {
        setError(data.detail || "Failed to save visit details");
        return false;
      }
      setVisitForm((prev) => ({
        ...prev,
        business_id: data.business_id ? String(data.business_id) : prev.business_id,
        visit_date: data.visit_date || prev.visit_date,
        visit_type: data.visit_type || prev.visit_type,
        account_executive_name: data.account_executive_name ?? prev.account_executive_name,
        team_member_names: Array.isArray(data.team_member_names) && data.team_member_names.length > 0
          ? data.team_member_names
          : prev.team_member_names,
      }));
      setAccountExecutiveSearch(data.account_executive_name || "");
      await loadDrafts(owner);
      if (owner !== visitScope.current) return false;
      setMessage("Visit details saved.");
      return true;
    } finally {
      if (owner === visitScope.current) setIsCreatingVisit(false);
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

  const updateVisitTeamMember = (index: number, value: string) => {
    setVisitForm((prev) => {
      const next = [...prev.team_member_names];
      next[index] = value;
      return { ...prev, team_member_names: next };
    });
  };

  const addVisitTeamMember = () => {
    setVisitForm((prev) => ({ ...prev, team_member_names: [...prev.team_member_names, ""] }));
  };

  const removeVisitTeamMember = (index: number) => {
    setVisitForm((prev) => {
      const next = prev.team_member_names.filter((_, itemIndex) => itemIndex !== index);
      return { ...prev, team_member_names: next.length > 0 ? next : [""] };
    });
  };

  const addActionItem = (questionId: number) => {
    setResponseDrafts((prev) => {
      const current = prev[questionId] || { ...emptyDraft };
      return {
        ...prev,
        [questionId]: {
          ...current,
          actions: [...(current.actions || []), { action_required: "", action_owner: "", action_timeframe: "", action_support_needed: "", action_comments: "" }],
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

  const buildResponsePayload = (question: Question, responseForm: ResponseDraft) => {
    const rawScore = responseForm.score;
    const scoreNum = (typeof rawScore === "number" || (typeof rawScore === "string" && rawScore.trim() !== ""))
      ? Number(rawScore) : NaN;
    const normalizedAnswerText = question.input_type === "yes_no"
      ? normalizeYesNo(responseForm.answer_text)
      : (responseForm.answer_text || "").trim();

    const normalizedActions = (responseForm.actions || [])
      .map((action) => ({
        action_required: action.action_required?.trim() || "",
        action_owner: action.action_owner?.trim() || "",
        action_timeframe: action.action_timeframe || "",
        action_support_needed: action.action_support_needed?.trim() || "",
        action_comments: action.action_comments?.trim() || "",
      }))
      .filter((action) => action.action_required || action.action_owner || action.action_timeframe || action.action_support_needed || action.action_comments);

    return {
      payload: {
        question_id: Number(question.id),
        score: question.input_type === "score" ? scoreNum : null,
        answer_text: question.input_type === "score" ? null : normalizedAnswerText || null,
        verbatim: responseForm.verbatim?.trim() || null,
        actions: normalizedActions,
      },
      normalizedAnswerText,
      normalizedActions,
      scoreNum,
    };
  };

  const validateResponseDraft = (question: Question, responseForm: ResponseDraft) => {
    const { normalizedAnswerText, normalizedActions, scoreNum } = buildResponsePayload(question, responseForm);

    if (question.input_type === "score") {
      const min = question.score_min ?? 0;
      const max = question.score_max ?? 10;
      if (!Number.isFinite(scoreNum) || scoreNum < min || scoreNum > max) {
        return `Enter a valid score (${min}-${max}) for Q${question.question_number || question.id}.`;
      }
    }

    if (question.input_type === "text" && question.is_mandatory && !responseForm.answer_text.trim()) {
      return `Q${question.question_number || question.id} requires an answer.`;
    }

    if (question.input_type === "yes_no" && !["Y", "N"].includes(normalizedAnswerText)) {
      return `Select Yes or No for Q${question.question_number || question.id}.`;
    }

    const explicitChoices = parseChoices(question);
    const frequencyChoices = explicitChoices.length > 0 ? explicitChoices : ["Always", "Sometimes", "Monthly", "Never"];
    if (question.input_type === "always_sometimes_never" && !frequencyChoices.includes(responseForm.answer_text || "")) {
      return `Select ${frequencyChoices.join(", ")} for Q${question.question_number || question.id}.`;
    }

    if (normalizedActions.some((action) => !action.action_required || !action.action_owner || !action.action_timeframe)) {
      return `Each action for Q${question.question_number || question.id} needs Action Required, Lead Owner, and Action Time.`;
    }

    if (normalizedActions.some((action) => !ACTION_TIMEFRAME_OPTIONS.includes(action.action_timeframe))) {
      return `Action timeframe for Q${question.question_number || question.id} must be one of: <1 month, <3 months, <6 months, >6 months.`;
    }

    return null;
  };

  const persistQuestionResponse = async (question: Question, options?: { silent?: boolean }) => {
    if (!visitId) {
      if (!options?.silent) setError("Create or select a visit first.");
      return { ok: false, error: "Create or select a visit first." };
    }

    const owner = visitScope.current;
    const responseForm = responseDrafts[question.id] || { ...emptyDraft };
    const validationError = validateResponseDraft(question, responseForm);
    if (validationError) {
      if (!options?.silent) setError(validationError);
      return { ok: false, error: validationError };
    }

    const { payload } = buildResponsePayload(question, responseForm);
    const existing = owner.records?.[question.id] || responsesByQuestion[question.id];
    const endpoint = existing
      ? `${API_BASE}/dashboard-visits/${visitId}/responses/${existing.response_id}?_cb=${Date.now()}`
      : `${API_BASE}/dashboard-visits/${visitId}/responses?_cb=${Date.now()}`;
    const method = existing ? "PUT" : "POST";

    if (!options?.silent) {
      setSavingQuestionId(question.id);
      pushToast("info", `Saving response for Q${question.question_number || question.id}...`, 1400);
    }

    try {
      const res = await fetch(endpoint, { method, headers, body: JSON.stringify(payload) });
      const data = await res.json();
      if (owner !== visitScope.current) return { ok: false, error: "Selection changed." };
      if (!res.ok) {
        const message = data.detail || "Failed to save response";
        if (!options?.silent) setError(message);
        return { ok: false, error: message };
      }
      const responseId = data.response_id || data.id || existing?.response_id;
      if (responseId) {
        const record = { ...payload, ...data, response_id: responseId } as ResponseRecord;
        owner.records = { ...owner.records, [question.id]: record };
        // Retain accepted identity for recovery without claiming verified Saved UI.

      }
      return { ok: true, data };
    } catch {
      (owner.uncertain ||= new Set()).add(question.id);
      const message = "Could not confirm response save. Check this visit before retrying.";
      if (owner === visitScope.current && !options?.silent) setError(message);
      return { ok: false, error: message };
    } finally {
      if (owner === visitScope.current && !options?.silent) setSavingQuestionId(null);
    }
  };

  const isQuestionSaved = (question: Question, records = responsesByQuestion) => {
    const draft = responseDrafts[question.id] || { ...emptyDraft };
    const existing = records[question.id];
    if (!existing) return false;
    const left = normalizeResponseDraftForCompare(draft);
    const right = normalizeResponseRecordForCompare(existing);
    return left.score === right.score
      && left.answer_text === right.answer_text
      && left.verbatim === right.verbatim
      && left.actions === right.actions;
  };

  const handleSaveQuestionResponse = async (question: Question) => {
    const owner = visitScope.current;
    if (owner.id !== visitId || owner.saves.size || owner.submitting) return;
    owner.saves.add(question.id);
    const submitted = JSON.stringify(responseDrafts[question.id] || emptyDraft);
    try {
      if (owner.uncertain?.has(question.id)) {
        const recovered = await loadVisitResponses(visitId, true, owner);
        if (owner !== visitScope.current) return;
        if (!recovered?.[question.id]) {
          setError("Previous save remains unconfirmed. Check/reopen this same visit before retrying; no duplicate answer was created.");
          return;
        }
        owner.uncertain.delete(question.id);
      }
      const existing = owner.records?.[question.id] || responsesByQuestion[question.id];
      if (existing && !window.confirm(`Replace the saved answer for Q${question.question_number || question.id}? Your current draft will replace that answer on this same visit.`)) return;
      const result = await persistQuestionResponse(question);
      if (owner !== visitScope.current || !result.ok) return;
      const records = await loadVisitResponses(visitId, true, owner);
      if (owner !== visitScope.current) return;
      if (!records) {
        (owner.uncertain ||= new Set()).add(question.id);
        setError("Response saved, but readback could not be confirmed. Your drafts are retained; check this visit before retrying.");
        return;
      }
      // Only reconcile the submitted revision of this question, never other
      // drafts or edits made while the POST/readback was pending.
      const record = records[question.id];
      const submittedValue = normalizeResponseDraftForCompare(JSON.parse(submitted));
      const savedValue = normalizeResponseRecordForCompare(record);
      if (!record || JSON.stringify(submittedValue) !== JSON.stringify(savedValue)) {
        setError("Response save could not be verified. Your drafts are retained; check this visit before retrying.");
        return;
      }
      setResponseDrafts((prev) => {
        if (owner !== visitScope.current || JSON.stringify(prev[question.id] || emptyDraft) !== submitted) return prev;
        return { ...prev, [question.id]: { score: String(record.score ?? ""), answer_text: record.answer_text || "", verbatim: record.verbatim || "", actions: record.actions || [] } };
      });
      setMessage("Response saved.");
    } catch {
      (owner.uncertain ||= new Set()).add(question.id);
      if (owner === visitScope.current) setError("Response saved, but readback could not be confirmed. Your drafts are retained; check this visit before retrying.");
    } finally {
      owner.saves.delete(question.id);
    }
  };

  const handleSubmitVisit = async () => {
    if (!visitId) {
      setError("Create a visit first.");
      return;
    }
    if (!questionnaireReady) {
      setError("The questionnaire is not ready. Reload it before submitting.");
      return;
    }
    const owner = visitScope.current;
    if (owner.id !== visitId || owner.saves.size || owner.submitting) return;
    owner.submitting = true;
    const submittedDrafts = JSON.stringify(responseDrafts);
    try {
    const visitDetailsSaved = await saveActiveVisitDetails();
    if (owner !== visitScope.current) return;
    if (!visitDetailsSaved) {
      return;
    }

    const answeredQuestions = visibleQuestions.filter((question) => {
      const draft = responseDrafts[question.id] || emptyDraft;
      return Boolean((draft.score !== "" && draft.score != null) || draft.answer_text?.trim() || draft.verbatim?.trim() || (draft.actions || []).length);
    });
    const draftQuestions = answeredQuestions.filter((question) => {
      const draft = responseDrafts[question.id] || emptyDraft;
      // Preserve valid partial progress before reporting invalid local fields.
      if (validateResponseDraft(question, draft)) return false;
      const hasDraftContent = Boolean(
        (draft.score !== "" && draft.score != null) || draft.answer_text?.trim() || draft.verbatim?.trim() || (draft.actions || []).some((action) => action.action_required || action.action_owner || action.action_timeframe || action.action_support_needed || action.action_comments)
      );
      if (!hasDraftContent) return false;
      const existing = responsesByQuestion[question.id];
      if (!existing) return true;
      return (
        String(existing.score ?? "") !== String(draft.score ?? "") ||
        String(existing.answer_text || "") !== String(draft.answer_text || "") ||
        String(existing.verbatim || "") !== String(draft.verbatim || "") ||
        JSON.stringify(existing.actions || []) !== JSON.stringify(draft.actions || [])
      );
    });

    if (owner.uncertain?.size) {
      const recovered = await loadVisitResponses(visitId, true, owner);
      if (owner !== visitScope.current) return;
      if (!recovered || [...owner.uncertain].some((id) => !recovered[id])) {
        setError("Previous save remains unconfirmed. Check/reopen this visit before retrying; submission has not advanced.");
        return;
      }
      owner.uncertain.clear();
    }
    const overwrites = draftQuestions.filter((question) => owner.records?.[question.id] || responsesByQuestion[question.id]);
    if (overwrites.length && !window.confirm(`Replace saved answers for ${overwrites.map((q) => `Q${q.question_number || q.id}`).join(", ")} with your current drafts before submitting?`)) return;
    for (const question of draftQuestions) {
      const result = await persistQuestionResponse(question, { silent: true });
      if (owner !== visitScope.current) return;
      if (!result.ok) {
        setError(result.error || `Failed to save Q${question.question_number || question.id} before submit.`);
        return;
      }
    }

    let savedResponses: Record<number, ResponseRecord> | undefined;
    try { savedResponses = await loadVisitResponses(visitId, true, owner); }
    catch {
      if (owner === visitScope.current) {
        draftQuestions.forEach((q) => (owner.uncertain ||= new Set()).add(q.id));
        setError("Could not confirm saved responses. Your drafts are retained; check this same visit before retrying.");
      }
      return;
    }
    if (owner !== visitScope.current || !savedResponses) return;
    if (JSON.stringify(responseDraftsRef.current) !== submittedDrafts) {
      setError("Answers changed while saving. Saved revisions are retained; review your current drafts before submitting again.");
      return;
    }

    // An explicit clear is not an untouched optional omission. Without a
    // verified clear contract, never submit the server's old answer instead.
    const invalidLocalQuestions = visibleQuestions.filter((question) => {
      if (!Object.prototype.hasOwnProperty.call(responseDrafts, question.id)) return false;
      const draft = responseDrafts[question.id];
      const record = savedResponses[question.id];
      const hasSavedValue = question.input_type === "score"
        ? record?.score != null : Boolean(record?.answer_text?.trim());
      const primaryIsBlank = question.input_type === "score"
        ? draft.score == null || String(draft.score).trim() === ""
        : !draft.answer_text?.trim();
      return (hasSavedValue && primaryIsBlank)
        || ((hasSavedValue || answeredQuestions.includes(question)) && Boolean(validateResponseDraft(question, draft)));
    });
    if (invalidLocalQuestions.length) {
      setError(`Answers saved. Review cleared or invalid local answers before submitting: ${invalidLocalQuestions.map((q) => `Q${q.question_number || q.id}`).join(", ")}. Drafts retained; old saved values have not been submitted.`);
      return;
    }

    // Confirm every response we just tried to save actually landed on the
    // server — a POST can report success while a dropped connection means
    // the row never committed, or a reload race can miss it.
    const unsavedAfterPersist = answeredQuestions.filter((question) => !isQuestionSaved(question, savedResponses));
    if (unsavedAfterPersist.length > 0) {
      const unsavedLabels = unsavedAfterPersist
        .map((question) => `Q${question.question_number || question.id}`)
        .join(", ");
      setError(`Some responses did not save, possibly due to a connection issue: ${unsavedLabels}. Please try again before submitting.`);
      return;
    }

    const mandatoryQuestions = visibleQuestions.filter((question) => question.is_mandatory);
    const hasSavedAnswer = (question: Question) => {
      const record = savedResponses[question.id];
      if (!record) return false;
      if (question.input_type === "score") return record.score != null && Number.isFinite(Number(record.score));
      return Boolean(String(record.answer_text || "").trim());
    };
    const optionalMissing = visibleQuestions.filter((q) => !q.is_mandatory && !hasSavedAnswer(q));
    const optionalNotice = optionalMissing.length ? `Unanswered optional questions: ${optionalMissing.map((q) => `Q${q.question_number || q.id}`).join(", ")}.` : "";
    const unanswered = mandatoryQuestions.filter((question) => !hasSavedAnswer(question));
    if (unanswered.length > 0) {
      const missingQuestionLabels = unanswered
        .map((question) => `Q${question.question_number || question.id}`)
        .join(", ");
      setError(`Answers saved. Complete all required questions before submit. Missing: ${missingQuestionLabels}. ${optionalNotice}`.trim());
      return;
    }

    if (optionalNotice) pushToast("info", optionalNotice, 6000);
    setIsSubmittingVisit(true);
    pushToast("info", "Submitting visit for review...", 1600);
    try {
      const res = await fetch(`${API_BASE}/dashboard-visits/${visitId}/submit?_cb=${Date.now()}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ submit_notes: null }),
      });
      const data = await res.json();
      if (owner !== visitScope.current) return;
      setIsSubmittingVisit(false);
      if (!res.ok) {
        const detail = data.detail;
        if (detail && typeof detail === "object") {
          const missingLabels = (detail.missing_questions || [])
            .map((q: { question_number?: number }) => `Q${q.question_number}`)
            .join(", ");
          setError(missingLabels ? `${detail.message} Missing: ${missingLabels}.` : detail.message || "Failed to submit visit");
        } else {
          setError(detail || "Failed to submit visit");
        }
        return;
      }
      setStatus(data.status || "Pending");
      setMessage("Survey submitted for review.");
      await loadDrafts(owner);
    } catch {
      if (owner !== visitScope.current) return;
      setError("Could not confirm submission. Check the visit status before trying again.");
    } finally {
      if (owner === visitScope.current) setIsSubmittingVisit(false);
    }
    } catch {
      if (owner === visitScope.current) setError("Could not confirm saved answers. Your drafts are retained; check this same visit before retrying.");
    } finally {
      owner.submitting = false;
    }
  };

  const todayString = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);

  const sortByPriority = (items: DraftVisit[]) => {
    const rank = { large_corporate: 0, high: 0, sme: 1, medium: 1, low: 1 };
    return [...items].sort((a, b) => {
      const aPriority = rank[a.business_priority || "low"] ?? 3;
      const bPriority = rank[b.business_priority || "low"] ?? 3;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return String(a.visit_date || "").localeCompare(String(b.visit_date || ""));
    });
  };

  const plannedToday = sortByPriority(draftVisits.filter((visit) => (visit.visit_date || "") === todayString));
  const plannedUpcoming = sortByPriority(draftVisits.filter((visit) => (visit.visit_date || "") > todayString));
  const plannedOverdue = sortByPriority(
    draftVisits.filter((visit) => (visit.visit_date || "") < todayString)
  );
  const submittedSorted = sortByPriority(submittedVisits);
  const isReadOnly = Boolean(isViewingSubmitted || status !== "Draft");

  const sectionStats = useMemo(() => {
    const stats: Record<string, { total: number; answered: number }> = {};
    groupedQuestions.forEach((category) => { stats[category] = { total: 0, answered: 0 }; });
    visibleQuestions.forEach((q) => {
      const key = q.category || "General";
      if (!stats[key] || !q.is_mandatory) return;
      stats[key].total += 1;
      if (responsesByQuestion[q.id]) stats[key].answered += 1;
    });
    return stats;
  }, [groupedQuestions, visibleQuestions, responsesByQuestion]);
  const activeCategory = groupedQuestions.includes(currentCategory) ? currentCategory : groupedQuestions[0] || "";
  const activeIndex = Math.max(0, groupedQuestions.indexOf(activeCategory));
  const isLastSection = activeIndex >= groupedQuestions.length - 1;
  const requiredTotal = visibleQuestions.filter((q) => q.is_mandatory).length;
  const requiredAnswered = visibleQuestions.filter((q) => q.is_mandatory && responsesByQuestion[q.id]).length;
  const requiredPercent = requiredTotal > 0 ? Math.round((requiredAnswered / requiredTotal) * 100) : 0;
  const teamNamesLabel = normalizeTeamMemberNames(visitForm.team_member_names).join(", ");
  const visitDetailsIncomplete = !visitForm.account_executive_name || !teamNamesLabel;
  const shortCategoryName = (category: string) => category.replace(/^Category\s+\d+:\s*/i, "");
  const goToCategory = (category: string | undefined) => {
    if (!category) return;
    setCurrentCategory(category);
    window.requestAnimationFrame(() => {
      document.getElementById("survey-questions")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <div ref={animationRef}>
      <PageContainer className="space-y-6">
      {error ? <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
      <datalist id="account-executive-list">
        {accountExecutives.map((executive) => (
          <option key={executive.id} value={executive.name} />
        ))}
      </datalist>


      {isPlannedRoute ? (
        <>
          <Card className="animate-target">
            <CardHeader>
              <CardTitle className="text-xl font-semibold tracking-tight">Planned Visits</CardTitle>
              <CardDescription className="text-sm">Choose an existing planned visit or create a new visit.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => loadDrafts()}>{isLoadingDrafts ? "Refreshing..." : "Refresh"}</Button>
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
                  {plannedOverdue.length > 0 ? (
                    <Disclosure
                      summary={<span className="flex items-center gap-2"><Clock3 className="h-4 w-4" aria-hidden="true" />Overdue</span>}
                      meta={<Badge variant="destructive">{plannedOverdue.length}</Badge>}
                      defaultOpen
                    >
                      <p className="mb-3 text-xs text-muted-foreground">
                        These visits are past their planned date. Continuing will update the visit date to today.
                      </p>
                      <div className="space-y-3 lg:hidden">
                        {plannedOverdue.map((draft) => (
                          <div key={draft.visit_id || draft.id || resolveBusinessName(draft)} className="space-y-3 rounded-lg border p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-base font-semibold tracking-tight">{resolveBusinessName(draft)}</p>
                                </div>
                                <Badge variant="destructive">{draft.is_started ? "Overdue (In Progress)" : "Overdue"}</Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Date</p>
                                  <p>{draft.visit_date || "--"}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Progress</p>
                                  <p>{draft.mandatory_answered_count || 0}/{draft.mandatory_total_count || 0}</p>
                                </div>
                              </div>
                              <Button className="w-full" onClick={() => handleSelectOverdueVisit(draft)}>
                                {draft.is_started ? "Continue" : "Start"} <ArrowRight className="h-4 w-4" />
                              </Button>
                            </div>
                        ))}
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
                            {plannedOverdue.map((draft) => (
                              <TableRow key={draft.visit_id || draft.id || resolveBusinessName(draft)}>
                                <TableCell>{resolveBusinessName(draft)}</TableCell>
                                <TableCell>{draft.visit_date || "--"}</TableCell>
                                <TableCell>{draft.mandatory_answered_count || 0}/{draft.mandatory_total_count || 0}</TableCell>
                                <TableCell><Badge variant="destructive">{draft.is_started ? "Overdue (In Progress)" : "Overdue"}</Badge></TableCell>
                                <TableCell>
                                  <Button size="sm" onClick={() => handleSelectOverdueVisit(draft)}>
                                    {draft.is_started ? "Continue" : "Start"} <ArrowRight className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </Disclosure>
                  ) : null}

                  <Disclosure
                    summary={<span className="flex items-center gap-2"><Clock3 className="h-4 w-4" aria-hidden="true" />Today</span>}
                    meta={<Badge variant="warning">{plannedToday.length}</Badge>}
                    defaultOpen
                  >
                    <div className="space-y-3 lg:hidden">
                      {plannedToday.length === 0 ? (
                        <p className="rounded-lg border p-4 text-sm text-muted-foreground">No visits planned for today.</p>
                      ) : (
                        plannedToday.map((draft) => {
                          return (
                            <div key={draft.visit_id || draft.id || resolveBusinessName(draft)} className="space-y-3 rounded-lg border p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-base font-semibold tracking-tight">{resolveBusinessName(draft)}</p>
                                  </div>
                                  <DraftStatusBadge draft={draft} />
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                  <div>
                                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Date</p>
                                    <p>{draft.visit_date || "--"}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Progress</p>
                                    <p>{draft.mandatory_answered_count || 0}/{draft.mandatory_total_count || 0}</p>
                                  </div>
                                </div>
                                <Button className="w-full" onClick={() => handleSelectPlannedVisit(draft)}>
                                  Continue <ArrowRight className="h-4 w-4" />
                                </Button>
                              </div>
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
                              return (
                                <TableRow key={draft.visit_id || draft.id || resolveBusinessName(draft)}>
                                  <TableCell>{resolveBusinessName(draft)}</TableCell>
                                  <TableCell>{draft.visit_date || "--"}</TableCell>
                                  <TableCell>{draft.mandatory_answered_count || 0}/{draft.mandatory_total_count || 0}</TableCell>
                                  <TableCell><DraftStatusBadge draft={draft} /></TableCell>
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
                  </Disclosure>

                  <Disclosure
                    summary={<span className="flex items-center gap-2"><CalendarDays className="h-4 w-4" aria-hidden="true" />Upcoming</span>}
                    meta={<Badge variant="secondary">{plannedUpcoming.length}</Badge>}
                    defaultOpen={plannedToday.length === 0 && plannedOverdue.length === 0}
                  >
                    <div className="space-y-3 lg:hidden">
                      {plannedUpcoming.length === 0 ? (
                        <p className="rounded-lg border p-4 text-sm text-muted-foreground">No upcoming planned visits.</p>
                      ) : (
                        plannedUpcoming.map((draft) => {
                          const priority = draft.business_priority || "sme";
                          return (
                            <div key={draft.visit_id || draft.id || resolveBusinessName(draft)} className="space-y-3 rounded-lg border p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-base font-semibold tracking-tight">{resolveBusinessName(draft)}</p>
                                  </div>
                                  <Badge variant={businessTypeLabel(priority) === "Large Business/Corporate" ? "default" : "secondary"}>{businessTypeLabel(priority)}</Badge>
                                </div>
                                <div>
                                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Date</p>
                                  <p className="text-sm">{draft.visit_date || "--"}</p>
                                </div>
                                <Button className="w-full" variant="outline" onClick={() => handleSelectPlannedVisit(draft)}>Open</Button>
                              </div>
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
                              const priority = draft.business_priority || "sme";
                              return (
                                <TableRow key={draft.visit_id || draft.id || resolveBusinessName(draft)}>
                                  <TableCell>{resolveBusinessName(draft)}</TableCell>
                                  <TableCell>{draft.visit_date || "--"}</TableCell>
                                  <TableCell><Badge variant={businessTypeLabel(priority) === "Large Business/Corporate" ? "default" : "secondary"}>{businessTypeLabel(priority)}</Badge></TableCell>
                                  <TableCell><Button size="sm" variant="outline" onClick={() => handleSelectPlannedVisit(draft)}>Open</Button></TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </Disclosure>
                </div>
              )}
            </CardContent>
          </Card>

          <Disclosure summary="Submitted visits" meta={`${submittedSorted.length} visit${submittedSorted.length === 1 ? "" : "s"}`}>
              <p className="text-sm text-muted-foreground">View a previously submitted or reviewed visit, including any action points added per question during review. Read-only.</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={loadSubmittedVisits}>{isLoadingSubmitted ? "Refreshing..." : "Refresh"}</Button>
              </div>
              {submittedSorted.length === 0 ? (
                <div className="rounded-lg border p-6 text-center">
                  <p className="text-sm text-muted-foreground">No submitted visits yet.</p>
                </div>
              ) : (
                <div className="hidden lg:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Business</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {submittedSorted.map((draft) => (
                        <TableRow key={draft.visit_id || draft.id || resolveBusinessName(draft)}>
                          <TableCell>{resolveBusinessName(draft)}</TableCell>
                          <TableCell>{draft.visit_date || "--"}</TableCell>
                          <TableCell><Badge variant="secondary">{draft.status || "--"}</Badge></TableCell>
                          <TableCell><Button size="sm" variant="outline" onClick={() => handleViewSubmittedVisit(draft)}>View</Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <div className="space-y-3 lg:hidden">
                {submittedSorted.map((draft) => (
                  <div key={draft.visit_id || draft.id || resolveBusinessName(draft)} className="space-y-3 rounded-lg border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-base font-semibold tracking-tight">{resolveBusinessName(draft)}</p>
                        <Badge variant="secondary">{draft.status || "--"}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{draft.visit_date || "--"}</p>
                      <Button className="w-full" variant="outline" onClick={() => handleViewSubmittedVisit(draft)}>View</Button>
                    </div>
                ))}
              </div>
          </Disclosure>

          <Card className="animate-target">
            <CardHeader>
              <CardTitle className="text-xl font-semibold tracking-tight">Start or Continue a Survey</CardTitle>
              <CardDescription className="text-sm">Choose a planned survey or set up a new one. Save the survey details here before you start answering questions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Source</label>
                  <p className="text-xs text-muted-foreground">Choose whether you are opening an already planned survey or starting a fresh one.</p>
                  <Select value={visitSource} onChange={(event) => setVisitSource(event.target.value as "new" | "planned")}>
                    <option value="new">Create new visit</option>
                    <option value="planned">Use planned visit</option>
                  </Select>
                </div>
                {visitSource === "new" ? (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium">Business Mode</label>
                    <p className="text-xs text-muted-foreground">Use an existing business or create a new one if it is not listed yet.</p>
                    <Select value={businessMode} onChange={(event) => setBusinessMode(event.target.value as "existing" | "new")}>
                      <option value="existing">Use existing business</option>
                      <option value="new">Create business now</option>
                    </Select>
                  </div>
                ) : null}
                {visitSource === "new" && businessMode === "existing" ? (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium">Business</label>
                    <p className="text-xs text-muted-foreground">Pick the customer account this survey is for.</p>
                    <Select value={visitForm.business_id} onChange={(event) => setVisitForm((prev) => ({ ...prev, business_id: event.target.value }))}>
                      {businesses.map((business) => (
                        <option key={business.id} value={String(business.id)}>{business.name}</option>
                      ))}
                    </Select>
                  </div>
                ) : null}
                {visitSource === "new" && businessMode === "new" ? (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium">New Business Name</label>
                    <p className="text-xs text-muted-foreground">Add the business name exactly as it should appear in reports and review screens.</p>
                    <Input value={newBusinessName} onChange={(event) => setNewBusinessName(event.target.value)} placeholder="Enter business name" />
                  </div>
                ) : null}
                {visitSource === "planned" ? null : null}
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Visit Date</label>
                  <p className="text-xs text-muted-foreground">Select the date this customer interaction happened or is planned for.</p>
                  <Input type="date" value={visitForm.visit_date} onChange={(event) => setVisitForm((prev) => ({ ...prev, visit_date: event.target.value }))} />
                </div>
              </div>
              <Disclosure
                summary="Visit type, account executive and team"
                meta="Optional"
                defaultOpen={Boolean(visitForm.account_executive_name) || visitForm.team_member_names.some((name) => name.trim()) || visitForm.visit_type !== "Planned"}
                className="bg-muted/30"
              >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Visit Type</label>
                  <p className="text-xs text-muted-foreground">Use Planned for standard surveys, or switch type if this is a special case.</p>
                  <Select value={visitForm.visit_type} onChange={(event) => setVisitForm((prev) => ({ ...prev, visit_type: event.target.value }))}>
                    <option value="Planned">Planned</option>
                    <option value="Priority">Priority</option>
                    <option value="Substitution">Substitution</option>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2 lg:col-span-4">
                  <label className="block text-sm font-medium">Account Executive</label>
                  <p className="text-xs text-muted-foreground">Search an existing account executive by name, or add a new one if you are an admin.</p>
                  <Input
                    type="text"
                    list="account-executive-list"
                    value={accountExecutiveSearch}
                    onChange={(event) => syncAccountExecutiveSelection(event.target.value)}
                    placeholder="Type to search account executive"
                  />
                  {canManageAccountExecutives ? (
                    <div className="mt-3 grid grid-cols-1 gap-3 rounded-md border bg-muted/20 p-3 md:grid-cols-[1fr_1fr_auto]">
                      <Input value={newAccountExecutiveName} onChange={(event) => setNewAccountExecutiveName(event.target.value)} placeholder="New account executive name" />
                      <Input value={newAccountExecutiveEmail} onChange={(event) => setNewAccountExecutiveEmail(event.target.value)} placeholder="New account executive email" />
                      <Button type="button" variant="outline" onClick={createAccountExecutive} disabled={isCreatingAccountExecutive} title="Create a new account executive and select them for this survey">
                        {isCreatingAccountExecutive ? "Adding..." : "Add New"}
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">Only B2B administrators can create a new account executive from this screen.</p>
                  )}
                </div>
                <div className="md:col-span-2 lg:col-span-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <label className="block text-sm font-medium">Team Member Names</label>
                      <p className="text-xs text-muted-foreground">Add every team member who took part in this survey for audit visibility.</p>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={addVisitTeamMember}>
                      Add Team Member
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {visitForm.team_member_names.map((memberName, index) => (
                      <div key={`team-member-${index}`} className="flex gap-2">
                        <Input
                          value={memberName}
                          onChange={(event) => updateVisitTeamMember(index, event.target.value)}
                          placeholder={`Team member ${index + 1}`}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => removeVisitTeamMember(index)}
                          disabled={visitForm.team_member_names.length === 1 && !visitForm.team_member_names[0].trim()}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              </Disclosure>
              <Button className="w-full sm:w-auto" onClick={handleCreateVisit} disabled={isCreatingVisit || !visitForm.visit_date} title="Save these survey details and open the active survey workspace">
                {isCreatingVisit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Prepare Visit
              </Button>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          {!visitId ? (
            <Card className="animate-target">
              <CardContent className="p-6 text-sm text-muted-foreground">
                No survey is active yet. Go to Planned Visits, choose or prepare a survey, then return here to complete the questions.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <div className="sticky top-14 z-10 -mx-4 border-b bg-background px-4 py-3 md:-mx-6 md:px-6">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{resolveActiveBusinessName()}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Account executive: {visitForm.account_executive_name || "Not selected yet"}
                      {teamNamesLabel ? ` · Team: ${teamNamesLabel}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">{status}</Badge>
                    <span className="text-xs tabular-nums text-muted-foreground">{requiredAnswered}/{requiredTotal} required saved</span>
                  </div>
                </div>
                <div
                  role="progressbar"
                  aria-label="Required answers saved"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={requiredPercent}
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
                >
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${requiredPercent}%` }} />
                </div>
              </div>

              <Disclosure
                summary="Visit details"
                meta={visitDetailsIncomplete ? "Needs attention" : "Account executive and team"}
                defaultOpen={visitDetailsIncomplete}
              >
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Account Executive</label>
                  <p className="text-xs text-muted-foreground">Need to change the account executive? Search and update it here, then save the visit details.</p>
                  <Input
                    type="text"
                    list="account-executive-list"
                    value={accountExecutiveSearch}
                    onChange={(event) => syncAccountExecutiveSelection(event.target.value)}
                    placeholder="Type to search account executive"
                  />
                </div>
                {canManageAccountExecutives ? (
                  <div className="grid grid-cols-1 gap-4 rounded-md border bg-muted/30 p-4 md:grid-cols-[1fr_1fr_auto]">
                    <Input value={newAccountExecutiveName} onChange={(event) => setNewAccountExecutiveName(event.target.value)} placeholder="New account executive name" />
                    <Input value={newAccountExecutiveEmail} onChange={(event) => setNewAccountExecutiveEmail(event.target.value)} placeholder="New account executive email" />
                    <Button type="button" variant="outline" onClick={createAccountExecutive} disabled={isCreatingAccountExecutive} title="Create a new account executive and assign them to this active survey">
                      {isCreatingAccountExecutive ? "Adding..." : "Add New"}
                    </Button>
                  </div>
                ) : null}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <label className="block text-sm font-medium">Team Member Names</label>
                      <p className="text-xs text-muted-foreground">Add every team member who took part in this survey for audit visibility.</p>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={addVisitTeamMember}>
                      Add Team Member
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {visitForm.team_member_names.map((memberName, index) => (
                      <div key={`active-team-member-${index}`} className="flex gap-2">
                        <Input
                          value={memberName}
                          onChange={(event) => updateVisitTeamMember(index, event.target.value)}
                          placeholder={`Team member ${index + 1}`}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => removeVisitTeamMember(index)}
                          disabled={visitForm.team_member_names.length === 1 && !visitForm.team_member_names[0].trim()}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
                <Button type="button" variant="outline" onClick={saveActiveVisitDetails} disabled={isCreatingVisit || !visitId} title="Save the selected account executive and team members to this active survey">
                  {isCreatingVisit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Visit Details
                </Button>
              </Disclosure>

              {groupedQuestions.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                  No B2B survey questions are available. You cannot complete this visit until an administrator configures the questionnaire.
                </div>
              ) : (
                <>
                  <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Survey sections">
                    {groupedQuestions.map((category, index) => {
                      const stats = sectionStats[category];
                      const complete = stats.total > 0 && stats.answered >= stats.total;
                      return (
                        <Button
                          key={category}
                          type="button"
                          size="sm"
                          variant={category === activeCategory ? "default" : "outline"}
                          aria-current={category === activeCategory ? "step" : undefined}
                          className="shrink-0"
                          onClick={() => goToCategory(category)}
                        >
                          {complete ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                          {index + 1}. {shortCategoryName(category)}
                        </Button>
                      );
                    })}
                  </div>

                  <div id="survey-questions" className="scroll-mt-40 space-y-4">
                    <div className="flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Section {activeIndex + 1} of {groupedQuestions.length}</p>
                        <h2 className="text-lg font-semibold tracking-tight">{shortCategoryName(activeCategory)}</h2>
                      </div>
                      <Badge variant="outline">{sectionStats[activeCategory].answered}/{sectionStats[activeCategory].total} required saved</Badge>
                    </div>

                    {visibleQuestions
                      .filter((q) => q.category === activeCategory)
                      .map((question) => {
                        const draft = responseDrafts[question.id] || { ...emptyDraft };
                        const choices = parseChoices(question);
                        const saving = savingQuestionId === question.id;
                        const questionSaved = isQuestionSaved(question);
                        const scoreRangeLabel = getScoreRangeLabel(question);
                        const scoreOptions = getScoreOptions(question);
                        const scoreValidationMessage = getScoreValidationMessage(question, draft.score);
                        return (
                          <section key={question.id} className="space-y-4 rounded-lg border bg-card p-4 md:p-6">
                            <div className="space-y-2">
                              <h3 className="text-sm font-semibold">Q{question.question_number || question.id} - {question.question_text}</h3>
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="secondary">{question.input_type}</Badge>
                                {scoreRangeLabel ? <Badge variant="outline">Score range: {scoreRangeLabel}</Badge> : null}
                                {question.is_mandatory ? <Badge variant="warning">Required</Badge> : null}
                              </div>
                            </div>

                                    {isReadOnly ? (
                                      <div className="rounded bg-muted/30 px-3 py-2 text-sm">
                                        {question.input_type === "score"
                                          ? draft.score != null && draft.score !== "" ? `${draft.score} / ${question.score_max ?? 10}` : "No score recorded"
                                          : draft.answer_text || "No answer recorded"}
                                      </div>
                                    ) : question.input_type === "score" ? (
                                      <div className="space-y-2">
                                        {scoreOptions.length === 0 ? (
                                          <p className="text-xs text-destructive">This question has no valid score range. Ask an administrator to correct it before answering.</p>
                                        ) : (
                                        <div className="flex flex-wrap gap-2" role="group" aria-label={`Select a score from ${question.score_min ?? 0} to ${question.score_max ?? 10}`}>
                                          {scoreOptions.map((scoreValue) => {
                                            const selected = String(scoreValue) === String(draft.score);
                                            return (
                                            <Button
                                              key={`${question.id}-score-${scoreValue}`}
                                              type="button"
                                              size="sm"
                                              variant={selected ? "default" : "outline"}
                                              className="min-w-10"
                                              aria-pressed={selected}
                                              aria-label={`Score ${scoreValue} out of ${question.score_max ?? 10}`}
                                              onClick={() => updateQuestionDraft(question.id, "score", String(scoreValue))}
                                            >
                                              {scoreValue}
                                            </Button>
                                            );
                                          })}
                                        </div>
                                        )}
                                        <p className="text-xs text-muted-foreground">Select a score in the range {scoreRangeLabel}.</p>
                                        {scoreValidationMessage ? <p className="text-xs text-destructive">{scoreValidationMessage}</p> : null}
                                      </div>
                                    ) : question.input_type === "yes_no" ? (
                                      <div className="flex gap-2">
                                        <Button variant={normalizeYesNo(draft.answer_text) === "Y" ? "default" : "outline"} onClick={() => updateQuestionDraft(question.id, "answer_text", "Y")}>Yes</Button>
                                        <Button variant={normalizeYesNo(draft.answer_text) === "N" ? "default" : "outline"} onClick={() => updateQuestionDraft(question.id, "answer_text", "N")}>No</Button>
                                      </div>
                                    ) : question.input_type === "always_sometimes_never" ? (
                                      <Select value={draft.answer_text} onChange={(event) => updateQuestionDraft(question.id, "answer_text", event.target.value)}>
                                        <option value="">Select one</option>
                                        {(choices.length > 0 ? choices : ["Always", "Sometimes", "Monthly", "Never"]).map((choice) => (
                                          <option key={`${question.id}-${choice}`} value={choice}>{choice}</option>
                                        ))}
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

                            <div className="space-y-2">
                              <label className="block text-sm font-medium">Verbatim / Comments</label>
                              {isReadOnly ? (
                                <div className="rounded bg-muted/30 px-3 py-2 text-sm">{draft.verbatim || "--"}</div>
                              ) : (
                                <Textarea value={draft.verbatim} onChange={(event) => updateQuestionDraft(question.id, "verbatim", event.target.value)} />
                              )}
                            </div>

                            {isReadOnly && draft.actions.length === 0 ? null : (
                              <Disclosure
                                summary="Action points"
                                meta={draft.actions.length > 0 ? `${draft.actions.length} added` : "None yet"}
                                defaultOpen={draft.actions.length > 0}
                                className="bg-muted/30"
                              >
                                {isReadOnly ? null : (
                                  <Button size="sm" variant="outline" onClick={() => addActionItem(question.id)}>Add Action</Button>
                                )}
                                      {isReadOnly
                                        ? draft.actions.map((action, index) => (
                                            <div key={`${question.id}-action-${index}`} className="rounded-md border bg-background p-3 text-sm space-y-1">
                                              <p className="font-medium">{action.action_required || "--"}</p>
                                              <p className="text-xs text-muted-foreground">
                                                Lead owner: {action.action_owner || "--"} | Timeline: {action.action_timeframe || "--"}
                                              </p>
                                              {action.action_support_needed ? <p className="text-xs text-muted-foreground">Support needed: {action.action_support_needed}</p> : null}
                                              {action.action_comments ? <p className="text-xs text-muted-foreground">Comments: {action.action_comments}</p> : null}
                                            </div>
                                          ))
                                        : draft.actions.map((action, index) => (
                                            <div key={`${question.id}-action-${index}`} className="grid grid-cols-1 gap-2 rounded-md border bg-background p-3 md:grid-cols-2">
                                              <Input placeholder="Action required" value={action.action_required} onChange={(event) => updateActionItem(question.id, index, "action_required", event.target.value)} />
                                              <Input placeholder="Lead owner" value={action.action_owner} onChange={(event) => updateActionItem(question.id, index, "action_owner", event.target.value)} />
                                              <Select value={action.action_timeframe} onChange={(event) => updateActionItem(question.id, index, "action_timeframe", event.target.value)}>
                                                <option value="">Action timeframe</option>
                                                {ACTION_TIMEFRAME_OPTIONS.map((option) => (
                                                  <option key={`${question.id}-action-time-${index}-${option}`} value={option}>{option}</option>
                                                ))}
                                              </Select>
                                              <Input placeholder="Support needed" value={action.action_support_needed} onChange={(event) => updateActionItem(question.id, index, "action_support_needed", event.target.value)} />
                                              <Input placeholder="Comments" value={action.action_comments || ""} onChange={(event) => updateActionItem(question.id, index, "action_comments", event.target.value)} />
                                              <div className="md:col-span-2">
                                                <Button size="sm" variant="destructive" onClick={() => removeActionItem(question.id, index)}>
                                                  Remove Action
                                                </Button>
                                              </div>
                                            </div>
                                          ))}
                              </Disclosure>
                            )}

                                    {isReadOnly ? null : (
                                      <Button
                                        className={cn(
                                          "w-full sm:w-auto",
                                          questionSaved && !saving ? "bg-emerald-600 text-white hover:bg-emerald-700" : ""
                                        )}
                                        variant={questionSaved && !saving ? "default" : "outline"}
                                        onClick={() => handleSaveQuestionResponse(question)}
                                        disabled={saving || Boolean(scoreValidationMessage)}
                                        title="Save this answer before moving to the next question"
                                      >
                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {questionSaved && !saving ? "Response Saved" : "Save Response"}
                                      </Button>
                                    )}
                          </section>
                        );
                      })}

                    <div className="flex items-center justify-between gap-3">
                      <Button type="button" variant="outline" onClick={() => goToCategory(groupedQuestions[activeIndex - 1])} disabled={activeIndex <= 0}>
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Previous
                      </Button>
                      {!isLastSection ? (
                        <Button type="button" onClick={() => goToCategory(groupedQuestions[activeIndex + 1])}>
                          Next section <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </>
              )}

              {isReadOnly ? (
                <Card className="animate-target">
                  <CardHeader>
                    <CardTitle>Read-only</CardTitle>
                    <CardDescription>This visit has already been submitted (status: {status}). Responses and action points are shown for reference only.</CardDescription>
                  </CardHeader>
                  {submissionSignature.name || submissionSignature.email ? (
                    <CardContent className="space-y-1 text-sm">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Audit signature</p>
                      <p>{submissionSignature.name || "Unknown"} ({submissionSignature.email || "No email"})</p>
                      {submissionSignature.submitted_at ? <p className="text-xs text-muted-foreground">Submitted at: {submissionSignature.submitted_at}</p> : null}
                    </CardContent>
                  ) : null}
                </Card>
              ) : null}

              {isLastSection && !isReadOnly ? (
            <Card className="animate-target">
              <CardHeader>
                <CardTitle>Submit Visit</CardTitle>
                <CardDescription>All required responses must be saved before submitting.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-3">
                <Button
                  className={cn(
                    "w-full sm:w-auto",
                    status === "Pending"
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "bg-amber-600 text-white hover:bg-amber-700"
                  )}
                  onClick={handleSubmitVisit}
                  disabled={isSubmittingVisit || status === "Pending" || !questionnaireReady}
                  title="Send this survey to the review queue once every required answer has been saved"
                >
                  {isSubmittingVisit ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {status === "Pending" ? "Submitted for Review" : "Submit for Review"}
                </Button>
                {!questionnaireReady ? <p role="status" className="text-sm text-muted-foreground">{questionnaireState === "loading" ? "Loading questionnaire..." : questionnaireState === "empty" ? "The questionnaire has no questions. Ask an administrator to configure it before submitting." : "The questionnaire has not loaded. Reload the page before submitting."}</p> : null}
                <Badge variant="secondary">Current status: {status}</Badge>
              </CardContent>
            </Card>
              ) : null}
            </div>
          )}
        </>
      )}
      </PageContainer>
    </div>
  );
}
