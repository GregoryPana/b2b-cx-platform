import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Select } from "./components/ui/select";
import { Separator } from "./components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Textarea } from "./components/ui/textarea";
import { ensureMsalInitialized, loginRequest } from "./auth";
import { isTokenExpired } from "./utils/tokenExpiry";
import { AnimatePresence, motion } from "framer-motion";
import { gsap } from "gsap";
import { CalendarDays, ClipboardCheck, LogOut } from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const MYSTERY_ALLOWED_ROLES = new Set(["MYSTERY_ADMIN", "MYSTERY_SURVEYOR", "CX_SUPER_ADMIN"]);

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
  const [accessToken, setAccessToken] = useState("");
  const [activeTab, setActiveTab] = useState("planned");
  const [showMobileCategoryNav, setShowMobileCategoryNav] = useState(false);
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

    const run = async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        const data = await res.json();
        if (!res.ok) return;

        const roles = Array.isArray(data.roles) ? data.roles : [];
        setEntraRoles(roles);
        setUserId(String(data.sub || ""));
        setUserName(data.name || "");
        setUserEmail(data.preferred_username || "");
        setRole(roles.includes("MYSTERY_ADMIN") || roles.includes("CX_SUPER_ADMIN") ? "Admin" : "Representative");
      } catch {
        // keep fallback claims
      } finally {
        setRoleResolved(true);
      }
    };

    run();
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

  useEffect(() => {
    const ctx = gsap.context(() => {
      const targets = gsap.utils.toArray(".panel, .hero, .planned-card, .question-card, .category-panel");
      if (!targets.length) return;
      gsap.fromTo(
        targets,
        { autoAlpha: 0, y: 10 },
        { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.03, ease: "power2.out" }
      );
    });

    return () => ctx.revert();
  }, [activeTab, currentCategory, showMobileCategoryNav]);

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
    await fetch(`${API_BASE}/mystery-shopper/bootstrap`, { method: "POST", headers });

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
      const query = new URLSearchParams({ representative_id: userId }).toString();
      const res = await fetch(`${API_BASE}/mystery-shopper/visits/drafts?${query}`, { headers });
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
    const res = await fetch(`${API_BASE}/dashboard-visits/${targetVisitId}`, { headers });
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
        representative_id: Number(userId),
        created_by: Number(userId),
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
        ? `${API_BASE}/dashboard-visits/${visitId}/responses/${existing.response_id}`
        : `${API_BASE}/dashboard-visits/${visitId}/responses`;

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
    instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin });
  };

  if (!msalReady || !isAuthenticated || !accessToken || !roleResolved) {
    return (
      <div className="app-shell">
        <motion.main id="main-content" className="page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
          <a href="#main-content" className="skip-link">Skip to main content</a>
          <Card className="hero" role="status" aria-live="polite" aria-atomic="true">
            <CardContent className="p-0 pt-2">
              <CardTitle className="text-[clamp(1.85rem,2.6vw,2.4rem)]">Signing you in...</CardTitle>
              <p className="lead">Please wait while Microsoft Entra authentication completes.</p>
            </CardContent>
          </Card>
        </motion.main>
      </div>
    );
  }

  if (!hasMysteryAccess(entraRoles)) {
    return (
      <div className="app-shell">
        <motion.main id="main-content" className="page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
          <Card className="hero" role="alert" aria-live="polite">
            <CardContent className="p-0 pt-2">
              <CardTitle className="text-[clamp(1.65rem,2.3vw,2.1rem)]">No Mystery Shopper Access</CardTitle>
              <p className="lead">Your account is signed in, but it does not have a Mystery Shopper survey role.</p>
              <p className="mt-2 text-sm text-muted-foreground">Ask an administrator to assign `MYSTERY_ADMIN`, `MYSTERY_SURVEYOR`, or `CX_SUPER_ADMIN`.</p>
              <Button type="button" variant="outline" className="mt-4" onClick={handleLogout}>Logout</Button>
            </CardContent>
          </Card>
        </motion.main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="workspace-nav">
        <Card className="workspace-card">
          <CardContent className="workspace-content">
            <div className="workspace-brand">Mystery Shopper</div>
            <div className="workspace-menu">
              {sidebarPages.map((page) => (
                <Button
                  key={page.key}
                  type="button"
                  variant={activeTab === page.key ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab(page.key)}
                >
                  <span className="nav-tab-inner"><page.icon className="icon icon--sm" aria-hidden="true" />{page.label}</span>
                </Button>
              ))}
            </div>
            {activeTab === "survey" && groupedQuestions.length > 0 ? (
              <div className="workspace-jump">
                <h3 className="jump-nav-title">Jump to Category</h3>
                <div className="jump-nav-list category-list">
                  {groupedQuestions.map(([category], index) => (
                    <Button
                      key={category}
                      type="button"
                      variant={currentCategory === category ? "default" : "outline"}
                      size="sm"
                      className="category-item"
                      onClick={() => scrollToCategory(category)}
                    >
                      <span className="category-index">{index + 1}</span>
                      {category}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="workspace-meta">
              <span className="workspace-meta-label">Signed in</span>
              <strong>{userName || "Unknown user"}</strong>
              <span className="workspace-meta-email">{userEmail || "No email"}</span>
              <Button type="button" variant="outline" size="sm" onClick={handleLogout} aria-label="Log out"><span className="nav-tab-inner"><LogOut className="icon icon--sm" aria-hidden="true" />Logout</span></Button>
            </div>
          </CardContent>
        </Card>
      </aside>

      <motion.main id="main-content" className="page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <Card className="hero">
          <CardHeader className="p-0">
            <CardTitle className="text-[clamp(1.85rem,2.6vw,2.4rem)]">Customer Service Centre Assessment</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-2">
            <p className="lead">Survey execution workspace with clean question cards and mobile-first behavior.</p>
            <div className="status">
              <div>
                <span className="caption">Current Visit</span>
                <Badge variant="secondary">{visitId || "Not selected"}</Badge>
              </div>
              <div>
                <span className="caption">Status</span>
                <Badge variant={status === "Pending" ? "warning" : "secondary"}>{status}</Badge>
              </div>
              <div>
                <span className="caption">Progress</span>
                <Badge variant="secondary">{completedMandatory}/{totalMandatory || 0} required</Badge>
              </div>
              <div>
                <span className="caption">Locations</span>
                <Badge variant="secondary">{locations.length}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="panel">
          <CardContent className="p-0">
            <div className="grid identity-grid">
              <label>
                Name
                <Input value={userName || "-"} disabled />
              </label>
              <label>
                Email
                <Input value={userEmail || "-"} disabled />
              </label>
            </div>
          </CardContent>
        </Card>

        <Card className="panel">
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="tabs">
              <TabsList>
                <TabsTrigger value="planned"><span className="nav-tab-inner"><CalendarDays className="icon icon--sm" aria-hidden="true" />Today & Upcoming</span></TabsTrigger>
                <TabsTrigger value="survey"><span className="nav-tab-inner"><ClipboardCheck className="icon icon--sm" aria-hidden="true" />Survey</span></TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        {activeTab === "planned" ? (
          <Card className="panel">
            <CardContent className="p-0">
              <div className="panel-header section-toolbar">
                <h2>Draft Visits</h2>
                <Button type="button" variant="outline" size="sm" onClick={loadDrafts}>
                  {loadingDrafts ? "Refreshing..." : "Refresh"}
                </Button>
              </div>
              <div className="planned-list">
                <Card className="planned-group">
                  <CardContent className="p-3">
                    <h3 className="group-title">Today</h3>
                    {plannedToday.length === 0 ? <p className="caption">No visits planned for today.</p> : null}
                    {plannedToday.map((visit) => (
                      <Button key={visit.visit_id} type="button" variant="ghost" size="auto" className="planned-card" onClick={() => selectDraftVisit(visit)}>
                        <div>
                          <strong>{visit.location_name}</strong>
                          <p>{visit.visit_date} at {visit.visit_time}</p>
                        </div>
                        <div className="meta">
                          <span>{visit.purpose_of_visit}</span>
                          <span>{visit.mandatory_answered_count}/{visit.mandatory_total_count} required</span>
                        </div>
                      </Button>
                    ))}
                  </CardContent>
                </Card>

                <Card className="planned-group">
                  <CardContent className="p-3">
                    <h3 className="group-title">Upcoming</h3>
                    {plannedUpcoming.length === 0 ? <p className="caption">No upcoming visits.</p> : null}
                    {plannedUpcoming.map((visit) => (
                      <Button key={visit.visit_id} type="button" variant="ghost" size="auto" className="planned-card" onClick={() => selectDraftVisit(visit)}>
                        <div>
                          <strong>{visit.location_name}</strong>
                          <p>{visit.visit_date} at {visit.visit_time}</p>
                        </div>
                        <div className="meta">
                          <span>{visit.purpose_of_visit}</span>
                          <span>{visit.mandatory_answered_count}/{visit.mandatory_total_count} required</span>
                        </div>
                      </Button>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {activeTab === "survey" ? (
          <>
            <Card className="panel">
              <CardHeader className="p-0 pb-3"><CardTitle>Visit Header</CardTitle></CardHeader>
              <CardContent className="p-0">
              <div className="grid visit-header-grid">
                  <label>
                    Customer Service Centre
                    <Select value={headerForm.location_id} onChange={(event) => setHeaderForm((prev) => ({ ...prev, location_id: event.target.value }))}>
                      <option value="">Select location</option>
                      {locations.map((location) => (
                        <option key={location.id} value={location.id}>{location.name}</option>
                      ))}
                    </Select>
                  </label>
                  <label>
                    Date of Visit
                    <Input type="date" value={headerForm.visit_date} onChange={(event) => setHeaderForm((prev) => ({ ...prev, visit_date: event.target.value }))} />
                  </label>
                  <label>
                    Time of Visit
                    <Input type="time" value={headerForm.visit_time} onChange={(event) => setHeaderForm((prev) => ({ ...prev, visit_time: event.target.value }))} />
                  </label>
                  <label>
                    Purpose of Visit
                    <Select value={headerForm.purpose_of_visit} onChange={(event) => setHeaderForm((prev) => ({ ...prev, purpose_of_visit: event.target.value }))}>
                      {purposeOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </Select>
                  </label>
                  <label>
                    Staff on Duty
                    <Input value={headerForm.staff_on_duty} onChange={(event) => setHeaderForm((prev) => ({ ...prev, staff_on_duty: event.target.value }))} />
                  </label>
                  <label>
                    Shopper Name
                    <Input value={headerForm.shopper_name} onChange={(event) => setHeaderForm((prev) => ({ ...prev, shopper_name: event.target.value }))} />
                  </label>
                </div>
                <div className="actions action-toolbar">
                  <Button type="button" onClick={createVisit} disabled={creatingVisit}>{creatingVisit ? "Creating..." : "Create / Load Visit"}</Button>
                  <Badge variant="secondary">Current Visit: {visitId || "Not selected"}</Badge>
                </div>
              </CardContent>
            </Card>

            <div className="survey-content">
                {groupedQuestions.map(([category, items]) => (
                  <Card key={category} className="panel" id={categoryToId(category)}>
                    <CardHeader className="p-0 pb-2"><CardTitle>{category}</CardTitle></CardHeader>
                    <CardContent className="p-0">
                      <Separator className="mb-3" />
                      <div className="question-list">
                        {items.map((question, questionIndex) => {
                          const draft = responseDrafts[question.id] || {};
                          const questionLabel = displayQuestionNumber(question, questionIndex);
                          return (
                            <Card key={question.id} className="question-card">
                              <CardContent className="p-3">
                                <div className="question-head">
                                  <Badge variant="default" className="question-number">{questionLabel}</Badge>
                                  <strong>{question.question_text}</strong>
                                </div>
                                <QuestionField question={question} draft={draft} onUpdate={(field, value) => updateQuestionDraft(question.id, field, value)} />
                                <div className="question-actions">
                                  <Button type="button" variant="outline" size="sm" onClick={() => saveQuestion(question)} disabled={savingQuestionId === question.id}>
                                    {savingQuestionId === question.id ? "Saving..." : "Save"}
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                <Card className="panel submit-panel">
                  <CardContent className="p-0">
                    <div className="actions action-toolbar">
                      <Button type="button" onClick={submitVisit} disabled={submitting || !visitId}>{submitting ? "Submitting..." : "Submit for Review"}</Button>
                      <Badge variant="secondary">Mandatory completion: {completedMandatory}/{totalMandatory || 0}</Badge>
                    </div>
                  </CardContent>
                </Card>
            </div>
          </>
        ) : null}

        <AnimatePresence>
          {message ? (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
              <Card className="message panel">
                <CardContent className="p-0">
                  <Badge variant="warning">{message}</Badge>
                </CardContent>
              </Card>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.main>
    </div>
  );
}
