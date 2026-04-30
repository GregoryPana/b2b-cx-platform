import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { cn } from "./lib/utils";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Select } from "./components/ui/select";
import { Separator } from "./components/ui/separator";
import { Textarea } from "./components/ui/textarea";
import { ensureMsalInitialized, loginRequest } from "./auth";
import { isTokenExpired } from "./utils/tokenExpiry";
import { motion } from "framer-motion";
import { CalendarDays, ClipboardCheck, LogOut, Menu, X } from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const MYSTERY_ALLOWED_ROLES = new Set(["MYSTERY_ADMIN", "MYSTERY_SURVEYOR", "CX_SUPER_ADMIN"]);
const surveyBasePath = (import.meta.env.VITE_BASE_PATH || "/").replace(/\/+$/, "") || "/";
const surveyPostLogoutUri = new URL(surveyBasePath === "/" ? "/" : `${surveyBasePath}/`, window.location.origin).toString();
const APP_VERSION = import.meta.env.VITE_APP_VERSION || "dev";

const DEFAULT_PURPOSE_OPTIONS = ["General Enquiry", "Billing", "Device", "Broadband", "Complaint", "Other"];

function hasMysteryAccess(roles) {
  return Array.isArray(roles) && roles.some((role) => MYSTERY_ALLOWED_ROLES.has(role));
}

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
  for (let value = min; value <= max; value += 1) {
    options.push(value);
  }
  return options;
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
        <Button
          type="button"
          variant={draft.answer_text === "Y" ? "default" : "outline"}
          size="sm"
          className="option-pill"
          onClick={() => onUpdate("answer_text", "Y")}
        >
          Yes
        </Button>
        <Button
          type="button"
          variant={draft.answer_text === "N" ? "default" : "outline"}
          size="sm"
          className="option-pill"
          onClick={() => onUpdate("answer_text", "N")}
        >
          No
        </Button>
      </div>
    );
  }

  if (choices.length > 0) {
    return (
      <div className="option-grid" role="radiogroup" aria-label="Select one option">
        {choices.map((choice) => (
          <Button
            key={choice}
            type="button"
            variant={draft.answer_text === choice ? "default" : "outline"}
            size="sm"
            className="option-pill"
            onClick={() => onUpdate("answer_text", choice)}
          >
            {choice}
          </Button>
        ))}
      </div>
    );
  }

  return <Textarea value={draft.answer_text || ""} onChange={(event) => onUpdate("answer_text", event.target.value)} />;
}

export default function App() {
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  // Enforce token expiry (force re-login when token near expiry)
  useEffect(() => {
    if (isAuthenticated && accounts.length > 0) {
      const account = accounts[0];
      if (isTokenExpired(account)) {
        instance.logout();
      }
    }
  }, [isAuthenticated, accounts, instance]);

  const [userId, setUserId] = useState("3");
  const [role, setRole] = useState("Representative");
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [entraRoles, setEntraRoles] = useState([]);
  const [roleResolved, setRoleResolved] = useState(false);
  const [authProfileError, setAuthProfileError] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [activeTab, setActiveTab] = useState("planned");
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
  const [autoSaving, setAutoSaving] = useState(false);

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
  const [msalReady, setMsalReady] = useState(false);

  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        await ensureMsalInitialized();
        if (active) setMsalReady(true);
      } catch {
        if (active) raiseMessage("Authentication initialization failed.", "error");
      }
    };
    init();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!msalReady) return;
    if (!isAuthenticated && inProgress === "none") {
      instance.loginRedirect(loginRequest);
    }
  }, [instance, inProgress, isAuthenticated, msalReady]);

  useEffect(() => {
    if (!msalReady) return;
    const account = accounts[0];
    if (!account) return;

    const claims = account.idTokenClaims || {};
    const roles = Array.isArray(claims.roles) ? claims.roles : [];
    setEntraRoles(roles);
    setRole(roles.includes("MYSTERY_ADMIN") || roles.includes("CX_SUPER_ADMIN") ? "Admin" : "Representative");
    setUserId(String(claims.sub || claims.oid || claims.preferred_username || ""));
    setUserName(claims.name || account.name || "");
    setUserEmail(claims.preferred_username || account.username || "");

    const loadToken = async () => {
      try {
        const result = await instance.acquireTokenSilent({
          ...loginRequest,
          account,
        });
        setAccessToken(result.accessToken || "");
      } catch (error) {
        if (error instanceof InteractionRequiredAuthError) {
          instance.acquireTokenRedirect(loginRequest);
        }
      }
    };

    loadToken();
  }, [accounts, instance, msalReady]);

  useEffect(() => {
    if (!accessToken) return;
    setRoleResolved(true);
  }, [accessToken]);

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: accessToken ? `Bearer ${accessToken}` : "",
      "X-User-Id": userId,
      "X-Role": role,
    }),
    [accessToken, userId, role]
  );

  const groupedQuestions = useMemo(() => {
    const map = new Map();
    questions.forEach((question) => {
      const category = question.category || "General";
      if (!map.has(category)) map.set(category, []);
      map.get(category).push(question);
    });
    return Array.from(map.entries());
  }, [questions]);

  const totalMandatory = useMemo(() => questions.filter((question) => question.is_mandatory).length, [questions]);

  const hasMeaningfulAnswer = (question, draft = {}, existing = null) => {
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
    if (question.input_type === "yes_no") {
      return candidateText === "Y" || candidateText === "N";
    }

    return candidateText.length > 0;
  };

  const raiseMessage = (text, tone = "info") => {
    setMessage(text);
    setMessageTone(tone);
  };

  const completedMandatory = useMemo(
    () =>
      questions.filter((question) => {
        if (!question.is_mandatory) return false;
        return hasMeaningfulAnswer(question, responseDrafts[question.id] || {}, responsesByQuestion[question.id]);
      }).length,
    [questions, responseDrafts, responsesByQuestion]
  );

  const todayString = new Date().toISOString().split("T")[0];
  const plannedToday = draftVisits.filter((visit) => visit.visit_date === todayString);
  const plannedUpcoming = draftVisits.filter((visit) => visit.visit_date > todayString);
  const sidebarPages = [
    { key: "planned", label: "Draft Visits", icon: CalendarDays },
    { key: "survey", label: "Survey", icon: ClipboardCheck },
  ];

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const resetScroll = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    resetScroll();
    const frame = window.requestAnimationFrame(resetScroll);
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab]);

  const initialize = async () => {
    const [questionsRes, locationsRes, purposesRes] = await Promise.all([
      fetch(`${API_BASE}/questions?survey_type=Mystery%20Shopper`, { headers }),
      fetch(`${API_BASE}/mystery-shopper/locations`, { headers }),
      fetch(`${API_BASE}/mystery-shopper/purposes`, { headers }),
    ]);

    const questionsData = await questionsRes.json();
    const locationsData = await locationsRes.json();
    const purposesData = await purposesRes.json();

    if (!questionsRes.ok) throw new Error(questionsData.detail || "Failed to load questions");
    if (!locationsRes.ok) throw new Error(locationsData.detail || "Failed to load locations");
    if (!purposesRes.ok) throw new Error(purposesData.detail || "Failed to load purpose options");

    const nextQuestions = Array.isArray(questionsData) ? questionsData : [];
    const nextLocations = (Array.isArray(locationsData) ? locationsData : []).filter((location) => location.active);
    const nextPurposes = (Array.isArray(purposesData) ? purposesData : [])
      .filter((purpose) => purpose.active)
      .map((purpose) => purpose.name);

    setQuestions(nextQuestions);
    setLocations(nextLocations);
    setPurposeOptions(nextPurposes.length ? nextPurposes : DEFAULT_PURPOSE_OPTIONS);

    if (!headerForm.location_id && nextLocations[0]?.id) {
      setHeaderForm((prev) => ({ ...prev, location_id: String(nextLocations[0].id) }));
    }

    if (nextQuestions[0]?.category) {
      setCurrentCategory(nextQuestions[0].category);
    }
  };

  const loadDrafts = async () => {
    setLoadingDrafts(true);
    try {
      const res = await fetch(`${API_BASE}/mystery-shopper/visits/drafts`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to load draft visits");
      setDraftVisits(Array.isArray(data) ? data : []);
    } catch (error) {
      setMessage(error.message || "Failed to load draft visits");
    } finally {
      setLoadingDrafts(false);
    }
  };

  const loadVisitDetail = async (targetVisitId) => {
    const res = await fetch(`${API_BASE}/mystery-shopper/visits/${targetVisitId}`, { headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to load visit detail");

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
  };

  useEffect(() => {
    if (!accessToken) return;
    const run = async () => {
      try {
        await initialize();
        await loadDrafts();
      } catch (error) {
        setMessage(error.message || "Failed to initialize Mystery Shopper survey");
      }
    };
    run();
  }, [accessToken, userId, role]);

  useEffect(() => {
    if (!currentCategory && groupedQuestions[0]) {
      setCurrentCategory(groupedQuestions[0][0]);
    }
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

  const selectDraftVisit = async (visit) => {
    setHeaderForm((prev) => ({
      ...prev,
      location_id: String(visit.location_id),
      visit_date: visit.visit_date || "",
      visit_time: visit.visit_time || "",
      purpose_of_visit: visit.purpose_of_visit || purposeOptions[0] || DEFAULT_PURPOSE_OPTIONS[0],
      staff_on_duty: visit.staff_on_duty || "",
      shopper_name: visit.shopper_name || "",
    }));
    await loadVisitDetail(visit.visit_id);
    setActiveTab("survey");
  };

  const createVisit = async () => {
    if (!headerForm.location_id || !headerForm.visit_date || !headerForm.visit_time || !headerForm.staff_on_duty || !headerForm.shopper_name) {
      setMessage("Complete all visit header fields before creating a visit.");
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

      const res = await fetch(`${API_BASE}/mystery-shopper/visits`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to create visit");

      setVisitId(data.visit_id);
      setStatus(data.status || "Draft");
      setMessage("Mystery Shopper visit created.");
      setActiveTab("survey");
      await loadDrafts();
      await loadVisitDetail(data.visit_id);
    } catch (error) {
      setMessage(error.message || "Failed to create visit");
    } finally {
      setCreatingVisit(false);
    }
  };

  const updateQuestionDraft = (questionId, field, value) => {
    setResponseDrafts((prev) => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || {}),
        [field]: value,
      },
    }));
  };

  const saveQuestion = async (question) => {
    if (!visitId) {
      setMessage("Create or select a visit before saving responses.");
      return;
    }

    const draft = responseDrafts[question.id] || {};
    const existing = responsesByQuestion[question.id];

    const questionLabel = displayQuestionNumber(question);

    if (question.input_type === "score") {
      const numeric = Number(draft.score);
      if (Number.isNaN(numeric)) {
        setMessage(`Enter a score for Q${questionLabel}.`);
        return;
      }
    }

    if (question.input_type === "yes_no" && !draft.answer_text) {
      setMessage(`Select Yes or No for Q${questionLabel}.`);
      return;
    }

    setSavingQuestionId(question.id);
    try {
      const endpoint = existing
        ? `${API_BASE}/mystery-shopper/visits/${visitId}/responses/${existing.response_id}`
        : `${API_BASE}/mystery-shopper/visits/${visitId}/responses`;

      const res = await fetch(endpoint, {
        method: existing ? "PUT" : "POST",
        headers,
        body: JSON.stringify({
          question_id: question.id,
          score: question.input_type === "score" ? Number(draft.score) : null,
          answer_text: question.input_type === "score" ? null : draft.answer_text || null,
          verbatim: draft.verbatim || null,
          actions: [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to save response");

      setResponsesByQuestion((prev) => ({ ...prev, [question.id]: data }));
      setMessage(`Saved Q${questionLabel}.`);
    } catch (error) {
      setMessage(error.message || "Failed to save response");
    } finally {
      setSavingQuestionId(null);
    }
  };

  const submitVisit = async () => {
    if (!visitId) {
      setMessage("No visit selected.");
      return;
    }

    const unanswered = questions.filter((question) => question.is_mandatory && !responsesByQuestion[question.id]);
    if (unanswered.length > 0) {
      setMessage(`Complete all required questions before submit (${unanswered.length} remaining).`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/mystery-shopper/visits/${visitId}/submit`, { method: "PUT", headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to submit visit");

      setStatus("Pending");
      setMessage(`Submitted for review. Report date: ${data.report_completed_date} (UTC+4).`);
      await loadDrafts();
    } catch (error) {
      setMessage(error.message || "Failed to submit visit");
    } finally {
      setSubmitting(false);
    }
  };

  const scrollToCategory = (category) => {
    setCurrentCategory(category);
    const element = document.getElementById(categoryToId(category));
    if (!element) return;
    const top = element.getBoundingClientRect().top + window.scrollY - 86;
    window.scrollTo({ top, behavior: "smooth" });
  };

  const handleLogout = () => {
    instance.logoutRedirect({ postLogoutRedirectUri: surveyPostLogoutUri });
  };

  if (!msalReady || !isAuthenticated || !accessToken || !roleResolved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <Card className="max-w-lg p-6" role="status" aria-live="polite" aria-atomic="true">
          <CardContent className="space-y-3 pt-6">
            <CardTitle className="text-2xl">Signing you in...</CardTitle>
            <p className="text-sm text-muted-foreground">Please wait while Microsoft Entra authentication completes.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!hasMysteryAccess(entraRoles)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <Card className="max-w-lg p-6" role="alert" aria-live="polite">
          <CardContent className="space-y-3 pt-6">
            <CardTitle className="text-2xl">No Mystery Shopper Access</CardTitle>
            <p className="text-sm text-muted-foreground">Your account is signed in, but it does not have a Mystery Shopper survey role. Ask an administrator to assign `MYSTERY_ADMIN`, `MYSTERY_SURVEYOR`, or `CX_SUPER_ADMIN`.</p>
            <Button type="button" variant="outline" onClick={handleLogout}>Logout</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
    {authProfileError ? (
      <div className="border-b bg-warning/20 px-4 py-2 text-sm text-warning-foreground">{authProfileError}</div>
    ) : null}
    <div className="relative flex min-h-screen bg-background">
      {mobileNavOpen ? <button type="button" className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" /> : null}
      <aside className={cn("fixed left-0 top-0 z-30 h-screen w-72 border-r bg-card transition-transform duration-300", mobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0") }>
        <div className="flex h-14 items-center justify-between border-b px-4">
          <span className="text-sm font-semibold">Mystery Shopper Survey</span>
          <Button type="button" variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex h-[calc(100vh-56px)] flex-col p-3">
          <nav className="space-y-1">
            {sidebarPages.map((page) => {
              const Icon = page.icon;
              return (
                <Button key={page.key} type="button" variant={activeTab === page.key ? "secondary" : "ghost"} className="w-full justify-start gap-3" onClick={() => { setActiveTab(page.key); setMobileNavOpen(false); }}>
                  <Icon className="h-4 w-4" />
                  <span>{page.label}</span>
                </Button>
              );
            })}
          </nav>

          {activeTab === "survey" && groupedQuestions.length > 0 ? (
            <div className="mt-6 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Jump to section</p>
              <div className="space-y-2">
                {groupedQuestions.map(([category], index) => (
                  <Button
                    key={category}
                    type="button"
                    variant={currentCategory === category ? "secondary" : "ghost"}
                    className="h-auto w-full justify-start gap-3 px-3 py-2 text-left"
                    onClick={() => {
                      scrollToCategory(category);
                      setMobileNavOpen(false);
                    }}
                  >
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border bg-background text-xs font-medium">{index + 1}</span>
                    <span className="whitespace-normal">{category}</span>
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-auto rounded-lg border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Signed in</p>
            <p className="text-[11px] text-muted-foreground">Build: {APP_VERSION}</p>
            <p className="truncate text-sm font-medium">{userName || "Unknown user"}</p>
            <p className="truncate text-xs text-muted-foreground">{userEmail || "No email"}</p>
            <Button type="button" variant="outline" className="mt-3 w-full justify-start gap-2" onClick={handleLogout}>
              <LogOut className="h-4 w-4" /> Logout
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col lg:pl-72">
        <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
          <motion.div className="flex h-14 items-center justify-between px-4 md:px-6" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            <div className="flex min-w-0 items-center gap-2">
              <Button type="button" variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation">
                <Menu className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Customer Service Centre Assessment</p>
                <p className="truncate text-xs text-muted-foreground">Mystery Shopper survey workspace</p>
              </div>
            </div>
            <p className="truncate pl-2 text-xs text-muted-foreground">{userName || "Unknown user"}</p>
          </motion.div>
        </header>

        <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} className="mx-auto w-full max-w-[1600px] flex-1 p-4 md:p-6">
          {message ? (
            <div className="mb-4 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div>
          ) : null}

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Mystery Shopper Survey</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-md border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Current Visit</p><p className="mt-1 text-sm font-medium">{visitId || "Not selected"}</p></div>
                  <div className="rounded-md border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Status</p><p className="mt-1 text-sm font-medium">{status}</p></div>
                  <div className="rounded-md border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Required Progress</p><p className="mt-1 text-sm font-medium">{completedMandatory}/{totalMandatory || 0}</p></div>
                  <div className="rounded-md border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Configured Locations</p><p className="mt-1 text-sm font-medium">{locations.length}</p></div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">User</label>
                    <Input value={userName || "-"} disabled />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Email</label>
                    <Input value={userEmail || "-"} disabled />
                  </div>
                </div>
              </CardContent>
            </Card>

            {activeTab === "planned" ? (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <CardTitle>Today</CardTitle>
                    <Button type="button" variant="outline" size="sm" onClick={loadDrafts}>{loadingDrafts ? "Refreshing..." : "Refresh"}</Button>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {plannedToday.length === 0 ? <p className="text-sm text-muted-foreground">No visits planned for today.</p> : null}
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
                  <CardHeader>
                    <CardTitle>Upcoming</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {plannedUpcoming.length === 0 ? <p className="text-sm text-muted-foreground">No upcoming visits.</p> : null}
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
            ) : null}

            {activeTab === "survey" ? (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Visit Header</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Customer Service Centre</label>
                        <Select value={headerForm.location_id} onChange={(event) => setHeaderForm((prev) => ({ ...prev, location_id: event.target.value }))}>
                          <option value="">Select location</option>
                          {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                        </Select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Date of Visit</label>
                        <Input type="date" value={headerForm.visit_date} onChange={(event) => setHeaderForm((prev) => ({ ...prev, visit_date: event.target.value }))} />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Time of Visit</label>
                        <Input type="time" value={headerForm.visit_time} onChange={(event) => setHeaderForm((prev) => ({ ...prev, visit_time: event.target.value }))} />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Purpose of Visit</label>
                        <Select value={headerForm.purpose_of_visit} onChange={(event) => setHeaderForm((prev) => ({ ...prev, purpose_of_visit: event.target.value }))}>
                          {purposeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                        </Select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Staff on Duty</label>
                        <Input value={headerForm.staff_on_duty} onChange={(event) => setHeaderForm((prev) => ({ ...prev, staff_on_duty: event.target.value }))} />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Shopper Name</label>
                        <Input value={headerForm.shopper_name} onChange={(event) => setHeaderForm((prev) => ({ ...prev, shopper_name: event.target.value }))} />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button type="button" onClick={createVisit} disabled={creatingVisit}>{creatingVisit ? "Creating..." : "Create / Load Visit"}</Button>
                      <Badge variant="secondary">Current Visit: {visitId || "Not selected"}</Badge>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
                  <Card className="hidden xl:block self-start sticky top-20">
                    <CardHeader>
                      <CardTitle className="text-sm">Sections</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {groupedQuestions.map(([category], index) => (
                        <Button key={category} type="button" variant={currentCategory === category ? "secondary" : "ghost"} className="h-auto w-full justify-start gap-3 px-3 py-2 text-left" onClick={() => scrollToCategory(category)}>
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border bg-background text-xs font-medium">{index + 1}</span>
                          <span className="whitespace-normal">{category}</span>
                        </Button>
                      ))}
                    </CardContent>
                  </Card>

                  <div className="space-y-6">
                    {groupedQuestions.map(([category, items]) => (
                      <Card key={category} id={categoryToId(category)}>
                        <CardHeader>
                          <CardTitle>{category}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {items.map((question, questionIndex) => {
                            const draft = responseDrafts[question.id] || {};
                            const questionLabel = displayQuestionNumber(question, questionIndex);
                            return (
                              <div key={question.id} className="rounded-lg border p-4 space-y-4">
                                <div className="flex items-start gap-3">
                                  <Badge>{questionLabel}</Badge>
                                  <div className="space-y-2 min-w-0 flex-1">
                                    <p className="font-medium leading-6">{question.question_text}</p>
                                    <QuestionField question={question} draft={draft} onUpdate={(field, value) => updateQuestionDraft(question.id, field, value)} />
                                  </div>
                                </div>
                                <div className="flex justify-end">
                                  <Button type="button" variant="outline" size="sm" onClick={() => saveQuestion(question)} disabled={savingQuestionId === question.id}>
                                    {savingQuestionId === question.id ? "Saving..." : "Save"}
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
                          <Button type="button" onClick={submitVisit} disabled={submitting || !visitId}>{submitting ? "Submitting..." : "Submit for Review"}</Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </motion.main>
      </div>
    </div>
    </>
  );
}
