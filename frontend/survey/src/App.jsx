import { useEffect, useRef, useState } from "react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { RadioGroup, RadioGroupItem } from "./components/ui/radio-group";
import { Select } from "./components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Textarea } from "./components/ui/textarea";
import { ensureMsalInitialized, loginRequest } from "./auth";
import { AnimatePresence, motion } from "framer-motion";
import { gsap } from "gsap";
import { CalendarDays, ClipboardCheck, LogOut } from "lucide-react";


const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

const CACHE_BUST = `?_cb=${Date.now()}`;

const QUESTION_CATEGORY_ORDER = [

  "Category 1: Relationship Strength",

  "Category 2: Service & Operational Performance",

  "Category 3: Commercial & Billing",

  "Category 4: Competitive & Portfolio Intelligence",

  "Category 5: Growth & Expansion",

  "Category 6: Advocacy"

];

const Q16_KEY = "q16_other_provider_products";

const Q17_KEY = "q17_competitor_products_services";

const NOTICE_STYLE = {

  success: "border-emerald-400/60 bg-emerald-900/35 text-emerald-100",

  error: "border-rose-400/60 bg-rose-900/35 text-rose-100",

  info: "border-sky-400/60 bg-sky-900/35 text-sky-100"

};



export default function App() {
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [userId, setUserId] = useState("4");
  const [role, setRole] = useState("Representative");
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [activeTab, setActiveTab] = useState("planned");

  const [visitId, setVisitId] = useState("");

  const [status, setStatus] = useState("Draft");

  const [message, setMessage] = useState("");

  const [businesses, setBusinesses] = useState([]);

  const [businessError, setBusinessError] = useState("");

  const [businessMode, setBusinessMode] = useState("existing");

  const [newBusinessName, setNewBusinessName] = useState("");

  const [visitSource, setVisitSource] = useState("new");

  const [draftVisits, setDraftVisits] = useState([]);

  const [selectedDraftId, setSelectedDraftId] = useState("");

  const [selectedDraftName, setSelectedDraftName] = useState("");

  const [questions, setQuestions] = useState([]);

  const [questionError, setQuestionError] = useState("");

  const [responsesByQuestion, setResponsesByQuestion] = useState({});

  const [responseDrafts, setResponseDrafts] = useState({});

  const [savingQuestionId, setSavingQuestionId] = useState(null);

  const [currentCategory, setCurrentCategory] = useState("Category 1: Relationship Strength");

  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);

  const [isCreatingVisit, setIsCreatingVisit] = useState(false);

  const [isSubmittingVisit, setIsSubmittingVisit] = useState(false);

  const [noticeBySection, setNoticeBySection] = useState({

    planned: null,

    create: null,

    response: null,

    submit: null

  });

  const [toast, setToast] = useState(null);

  const [showQuestionsTopFab, setShowQuestionsTopFab] = useState(false);

  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1440);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [showDesktopJumpNav, setShowDesktopJumpNav] = useState(false);
  const [msalReady, setMsalReady] = useState(false);
  const heroSectionRef = useRef(null);
  const questionsSectionRef = useRef(null);
  const draftRequestRef = useRef(null);


  const [visitForm, setVisitForm] = useState({
    business_id: "1",
    representative_id: "4",
    visit_date: "",
    visit_type: "Planned"
  });

  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        await ensureMsalInitialized();
        if (active) setMsalReady(true);
      } catch {
        if (active) setError("Authentication initialization failed.");
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
    setRole(roles.includes("B2B_ADMIN") || roles.includes("CX_SUPER_ADMIN") ? "Admin" : "Representative");
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
        setUserId(String(data.sub || ""));
        setUserName(data.name || "");
        setUserEmail(data.preferred_username || "");
        setRole(roles.includes("B2B_ADMIN") || roles.includes("CX_SUPER_ADMIN") ? "Admin" : "Representative");
      } catch {
        // keep fallback claims
      }
    };

    run();
  }, [accessToken]);

  const headers = {
    "Content-Type": "application/json",
    Authorization: accessToken ? `Bearer ${accessToken}` : "",
    "X-User-Id": userId,
    "X-User-Role": role
  };


  const todayString = (() => {

    const now = new Date();

    const yyyy = now.getFullYear();

    const mm = String(now.getMonth() + 1).padStart(2, "0");

    const dd = String(now.getDate()).padStart(2, "0");

    return `${yyyy}-${mm}-${dd}`;

  })();



  const setSectionNotice = (section, type, text) => {

    setNoticeBySection((prev) => ({

      ...prev,

      [section]: {

        type,

        text,

        id: Date.now()

      }

    }));

  };



  const notify = (type, text) => {

    setToast({

      type,

      text,

      id: Date.now()

    });

  };



  useEffect(() => {

    if (!toast) return;

    const timer = window.setTimeout(() => setToast(null), 3200);

    return () => window.clearTimeout(timer);

  }, [toast]);



  useEffect(() => {

    const handleScroll = () => {

      const section = questionsSectionRef.current;

      if (!section) {

        setShowQuestionsTopFab(false);

        return;

      }



      const rect = section.getBoundingClientRect();

      const passedQuestions = rect.bottom < window.innerHeight * 0.45;

      setShowQuestionsTopFab(passedQuestions);

    };



    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });

    window.addEventListener("resize", handleScroll);



    return () => {

      window.removeEventListener("scroll", handleScroll);

      window.removeEventListener("resize", handleScroll);

    };

  }, [questions.length]);



  // Mobile and tablet detection and nav handling

  useEffect(() => {
    const checkViewport = () => {
      const width = window.innerWidth;
      setViewportWidth(width);
      setIsMobile(width <= 768);
      setIsTablet(width > 768 && width <= 1024);
    };
    

    checkViewport();

    window.addEventListener('resize', checkViewport);

    

    return () => window.removeEventListener('resize', checkViewport);

  }, []);

  useEffect(() => {
    const handleDesktopNavVisibility = () => {
      const hero = heroSectionRef.current;
      if (!hero) {
        setShowDesktopJumpNav(false);
        return;
      }
      const heroBottom = hero.getBoundingClientRect().bottom;
      setShowDesktopJumpNav(heroBottom <= 72);
    };

    handleDesktopNavVisibility();
    window.addEventListener("scroll", handleDesktopNavVisibility, { passive: true });
    window.addEventListener("resize", handleDesktopNavVisibility);

    return () => {
      window.removeEventListener("scroll", handleDesktopNavVisibility);
      window.removeEventListener("resize", handleDesktopNavVisibility);
    };
  }, []);


  // Close mobile nav when clicking outside or when starting to answer questions

  useEffect(() => {

    const handleClickOutside = (event) => {

      if (showMobileNav && !event.target.closest('nav') && !event.target.closest('.mobile-nav-toggle')) {

        setShowMobileNav(false);

      }

    };



    if (isMobile) {

      document.addEventListener('click', handleClickOutside);

      return () => document.removeEventListener('click', handleClickOutside);

    }

  }, [showMobileNav, isMobile]);



  // Auto-close mobile nav when user starts interacting with questions

  useEffect(() => {

    if (isMobile && showMobileNav) {

      // Close nav after 3 seconds of inactivity or when user starts answering

      const inactivityTimer = setTimeout(() => {

        setShowMobileNav(false);

      }, 3000);

      

      const handleUserInteraction = () => {

        clearTimeout(inactivityTimer);

        if (showMobileNav) {

          setShowMobileNav(false);

        }

      };

      

      // Close nav when user clicks on any input or button

      const interactiveElements = document.querySelectorAll('input, button, select, textarea, .question-card');

      interactiveElements.forEach(element => {

        element.addEventListener('focus', handleUserInteraction);

        element.addEventListener('click', handleUserInteraction);

      });

      

      return () => {

        clearTimeout(inactivityTimer);

        interactiveElements.forEach(element => {

          element.removeEventListener('focus', handleUserInteraction);

          element.removeEventListener('click', handleUserInteraction);

        });

      };

    };

  }, [showMobileNav, isMobile]);



  // Prevent body scroll when mobile nav is open

  useEffect(() => {

    if (isMobile) {

      if (showMobileNav) {

        document.body.classList.add('mobile-nav-open');

      } else {

        document.body.classList.remove('mobile-nav-open');

      }

    }

  }, [showMobileNav, isMobile]);



  const scrollToQuestionsTop = () => {

    questionsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  };



  useEffect(() => {
    if (!accessToken) return;
    const loadBusinesses = async () => {
      setBusinessError("");

      try {

        const res = await fetch(`${API_BASE}/survey-businesses`, { headers });

        const data = await res.json();

        if (!res.ok) {

          setBusinessError(data.detail || "Failed to load businesses");

          return;

        }

        const priorityRank = { high: 0, medium: 1, low: 2 };

        const sorted = [...data].sort((a, b) => {

          const priorityDiff = (priorityRank[a.priority_level] ?? 3) - (priorityRank[b.priority_level] ?? 3);

          if (priorityDiff !== 0) return priorityDiff;

          return (a.name || "").localeCompare(b.name || "");

        });

        setBusinesses(sorted);

        if (sorted.length > 0) {

          setVisitForm((prev) => ({

            ...prev,

            business_id: String(sorted[0].id)

          }));

        }

      } catch {

        setBusinessError("Failed to load businesses");

      }

    };



    loadBusinesses();
  }, [accessToken, userId, role]);


  useEffect(() => {
    if (!accessToken) return;
    const loadQuestions = async () => {
      setQuestionError("");

      try {

        const res = await fetch(`${API_BASE}/questions`, { headers });

        const data = await res.json();

        if (!res.ok) {

          setQuestionError(data.detail || "Failed to load questions");

          return;

        }

        setQuestions(data);

        setResponseDrafts((prev) => {

          const next = { ...prev };

          data.forEach((question) => {

            if (!next[question.id]) {

              next[question.id] = {

                score: "",

                answer_text: "",

                verbatim: "",

                actions: []

              };

            }

          });

          return next;

        });

      } catch {

        setQuestionError("Failed to load questions");

      }

    };



    loadQuestions();
  }, [accessToken, userId, role]);


  const loadDrafts = async ({ silent = false } = {}) => {
    if (draftRequestRef.current) {
      draftRequestRef.current.abort();
      draftRequestRef.current = null;
    }

    setIsLoadingDrafts(true);

    setBusinessError("");

    try {

      const controller = new AbortController();
      draftRequestRef.current = controller;
      const timeoutId = window.setTimeout(() => controller.abort(), 15000);

      const res = await fetch(`${API_BASE}/dashboard-visits/drafts${CACHE_BUST}`, {
        headers,
        signal: controller.signal,
      });

      window.clearTimeout(timeoutId);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {

        const errorText = data.detail || "Failed to load draft visits";

        setBusinessError(errorText);

        setSectionNotice("planned", "error", errorText);

        if (!silent) {

          notify("error", errorText);

        }

        return;

      }

      const normalizedDrafts = (Array.isArray(data) ? data : []).map((draft) => ({

        ...draft,

        visit_id: draft.visit_id ?? draft.id

      }));

      setDraftVisits(normalizedDrafts);

      if (!silent) {

        const infoText = normalizedDrafts.length

          ? `Loaded ${normalizedDrafts.length} draft visit${normalizedDrafts.length === 1 ? "" : "s"}.`

          : "No draft visits available.";

        setSectionNotice("planned", "info", infoText);

      }

    } catch (error) {

      const errorText = error?.name === "AbortError"
        ? "Draft visits request timed out. Please retry."
        : "Failed to load draft visits";

      setBusinessError(errorText);

      setSectionNotice("planned", "error", errorText);

      if (!silent) {

        notify("error", errorText);

      }

    } finally {

      draftRequestRef.current = null;

      setIsLoadingDrafts(false);

    }
  };

  useEffect(() => {
    if (!accessToken) return;
    loadDrafts({ silent: true });
  }, [accessToken, userId, role]);

  useEffect(() => {
    return () => {
      if (draftRequestRef.current) {
        draftRequestRef.current.abort();
        draftRequestRef.current = null;
      }
    };
  }, []);

  const loadVisitResponses = async (targetVisitId) => {
    if (!targetVisitId) return;



    try {

      const res = await fetch(`${API_BASE}/dashboard-visits/${targetVisitId}${CACHE_BUST}`, { headers });

      const data = await res.json();

      if (!res.ok) {

        return;

      }



      const nextResponses = {};

      const nextDrafts = {};

      (data.responses || []).forEach((response) => {

        nextResponses[response.question_id] = response;

        nextDrafts[response.question_id] = {

          score: String(response.score ?? ""),

          answer_text: response.answer_text || "",

          verbatim: response.verbatim || "",

          actions: (response.actions || []).map((action) => ({

            action_required: action.action_required || "",

            action_owner: action.action_owner || "",

            action_timeframe: action.action_timeframe || "",

            action_support_needed: action.action_support_needed || ""

          }))

        };

      });



      setResponsesByQuestion(nextResponses);

      setResponseDrafts((prev) => ({

        ...prev,

        ...nextDrafts

      }));

      // Ensure UI reflects saved state immediately after load

      setResponseDrafts((prev) => ({ ...prev }));

    } catch {

      // no-op: non-blocking convenience load

    }

  };



  useEffect(() => {
    if (!accessToken) return;
    loadVisitResponses(visitId);
  }, [accessToken, visitId, userId, role]);


  useEffect(() => {

    if (visitSource === "new") {

      setSelectedDraftId("");

      setSelectedDraftName("");

    }

  }, [visitSource]);



  const priorityRank = { high: 0, medium: 1, low: 2 };

  const sortPlanned = (items) =>

    [...items].sort((a, b) => {

      const priorityDiff = (priorityRank[a.business_priority] ?? 3) - (priorityRank[b.business_priority] ?? 3);

      if (priorityDiff !== 0) return priorityDiff;

      const dateDiff = (a.visit_date || "").localeCompare(b.visit_date || "");

      if (dateDiff !== 0) return dateDiff;

      return (a.business_name || "").localeCompare(b.business_name || "");

    });



  const plannedToday = sortPlanned(

    draftVisits.filter((visit) => (visit.visit_date || "") === todayString)

  );

  const plannedUpcoming = sortPlanned(

    draftVisits.filter((visit) => (visit.visit_date || "") > todayString)

  );



  const resolveBusinessName = (draft) => {

    if (draft.business_name) return draft.business_name;

    const match = businesses.find((business) => business.id === draft.business_id);

    return match ? match.name : "Business";

  };



  const getDraftProgressLabel = (draft) => {

    const answered = draft.mandatory_answered_count ?? 0;

    const total = draft.mandatory_total_count ?? 0;

    if (draft.is_completed) {

      return {

        text: total > 0 ? `Ready to submit (${answered}/${total})` : "Ready to submit",

        className: "progress-complete"

      };

    }

    if (draft.is_started) {

      return {

        text: total > 0 ? `In progress (${answered}/${total})` : "In progress",

        className: "progress-started"

      };

    }

    return {

      text: total > 0 ? `Not started (0/${total})` : "Not started",

      className: "progress-not-started"

    };

  };



  const handleSelectPlannedVisit = (draft) => {

    const selectedVisitId = draft.visit_id ?? draft.id;

    setSelectedDraftId(selectedVisitId);

    setSelectedDraftName(resolveBusinessName(draft));

    setVisitSource("planned");

    setVisitForm((prev) => ({

      ...prev,

      business_id: String(draft.business_id || ""),

      visit_date: draft.visit_date || "",

      visit_type: "Planned"

    }));

    setVisitId(selectedVisitId);

    setStatus(draft.status || "Draft");

    setActiveTab("survey");

    setSectionNotice("planned", "success", "Planned visit selected. Continue in Survey tab.");

    notify("success", "Planned visit selected.");

  };



  const updateQuestionDraft = (questionId, field, value) => {

    setResponseDrafts((prev) => ({

      ...prev,

      [questionId]: {

        ...(prev[questionId] || {

          score: "",

          answer_text: "",

          verbatim: "",

          actions: []

        }),

        [field]: value

      }

    }));

  };



  const addActionItem = (questionId) => {

    setResponseDrafts((prev) => {

      const current = prev[questionId] || { score: "", answer_text: "", verbatim: "", actions: [] };

      return {

        ...prev,

        [questionId]: {

          ...current,

          actions: [

            ...(current.actions || []),

            {

              action_required: "",

              action_owner: "",

              action_timeframe: "",

              action_support_needed: ""

            }

          ]

        }

      };

    });

  };



  const updateActionItem = (questionId, index, field, value) => {

    setResponseDrafts((prev) => {

      const current = prev[questionId] || { score: "", answer_text: "", verbatim: "", actions: [] };

      const updatedActions = [...(current.actions || [])];

      if (!updatedActions[index]) return prev;

      updatedActions[index] = {

        ...updatedActions[index],

        [field]: value

      };

      return {

        ...prev,

        [questionId]: {

          ...current,

          actions: updatedActions

        }

      };

    });

  };



  const removeActionItem = (questionId, index) => {

    setResponseDrafts((prev) => {

      const current = prev[questionId] || { score: "", answer_text: "", verbatim: "", actions: [] };

      return {

        ...prev,

        [questionId]: {

          ...current,

          actions: (current.actions || []).filter((_, actionIndex) => actionIndex !== index)

        }

      };

    });

  };



  const createBusinessIfNeeded = async () => {
    if (businessMode !== "new") return null;


    const name = newBusinessName.trim();

    if (!name) {

      setMessage("Enter a business name or choose from the list.");

      return null;

    }



    let res;
    let data;
    try {
      res = await fetch(`${API_BASE}/api/b2b/businesses`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name, priority_level: "medium", active: true })
      });
      data = await res.json();
    } catch {
      setMessage("Failed to create business. Check backend connection and CORS settings.");
      return null;
    }

    if (!res.ok) {
      setMessage(data.detail || "Failed to create business");
      return null;
    }


    setBusinesses((prev) => [data, ...prev]);

    setVisitForm((prev) => ({

      ...prev,

      business_id: String(data.id)

    }));

    setNewBusinessName("");

    return data.id;

  };



  const handleCreateVisit = async () => {

    setIsCreatingVisit(true);

    setMessage("");

    try {

      if (visitSource === "planned") {

        if (!selectedDraftId) {

          const errorText = "Select a planned visit first.";

          setMessage(errorText);

          setSectionNotice("create", "error", errorText);

          notify("error", errorText);

          return;

        }



        const res = await fetch(`${API_BASE}/dashboard-visits/${selectedDraftId}/draft${CACHE_BUST}`, {

          method: "PUT",

          headers,

          body: JSON.stringify({

            representative_id: Number(userId),

            visit_date: visitForm.visit_date,

            visit_type: visitForm.visit_type

          })

        });

        const data = await res.json();

        if (!res.ok) {

          const errorText = data.detail || "Failed to update planned visit";

          setMessage(errorText);

          setSectionNotice("create", "error", errorText);

          notify("error", errorText);

          return;

        }



        setVisitId(data.visit_id);

        setStatus(data.status || "Draft");

        setMessage("Planned visit updated.");

        setSectionNotice("create", "success", "Planned visit updated and ready for responses.");

        notify("success", "Planned visit updated.");

        await loadDrafts({ silent: true });

        await loadVisitResponses(data.visit_id);

        return;

      }



      const createdBusinessId = await createBusinessIfNeeded();

      if (businessMode === "new" && !createdBusinessId) {

        setSectionNotice("create", "error", "Enter a business name before creating a visit.");

        return;

      }

      const payload = {

        business_id: Number(createdBusinessId || visitForm.business_id),

        representative_id: Number(visitForm.representative_id),

        visit_date: visitForm.visit_date,

        visit_type: visitForm.visit_type,

        meeting_attendees: []

      };



      const res = await fetch(`${API_BASE}/dashboard-visits${CACHE_BUST}`, {

        method: "POST",

        headers,

        body: JSON.stringify(payload)

      });



      const data = await res.json();

      if (!res.ok) {

        const errorText = data.detail || "Failed to create visit";

        setMessage(errorText);

        setSectionNotice("create", "error", errorText);

        notify("error", errorText);

        return;

      }



      setVisitId(data.visit_id);

      setStatus(data.status || "Draft");

      setMessage("Visit created.");

      setSectionNotice("create", "success", `Visit ${data.visit_id.slice(0, 8)} created.`);

      notify("success", "Visit created.");

      await loadVisitResponses(data.visit_id);

    } finally {

      setIsCreatingVisit(false);

    }

  };



  const handleSaveQuestionResponse = async (question) => {

    if (!visitId) {

      const errorText = "Create a visit first.";

      setMessage(errorText);

      setSectionNotice("response", "error", errorText);

      notify("error", errorText);

      return;

    }



    const responseForm = responseDrafts[question.id] || {};

    const scoreNum = Number(responseForm.score);



    if (question.input_type === "score") {

      if (

        responseForm.score === "" ||

        Number.isNaN(scoreNum) ||

        (question.score_min !== null && question.score_min !== undefined && scoreNum < question.score_min) ||

        (question.score_max !== null && question.score_max !== undefined && scoreNum > question.score_max)

      ) {

        const min = question.score_min ?? 0;

        const max = question.score_max ?? 10;

        const errorText = `Enter a valid score (${min}-${max}) for ${question.category}.`;

        setSectionNotice("response", "error", errorText);

        notify("error", errorText);

        return;

      }

    }



    if (question.input_type === "text" && question.is_mandatory && !responseForm.answer_text?.trim()) {

      const errorText = `Answer is required for "${question.question_text}".`;

      setSectionNotice("response", "error", errorText);

      notify("error", errorText);

      return;

    }



    if (question.input_type === "yes_no" && !["Y", "N"].includes(responseForm.answer_text || "")) {

      const errorText = `Select Yes or No for "${question.question_text}".`;

      setSectionNotice("response", "error", errorText);

      notify("error", errorText);

      return;

    }



    if (

      question.input_type === "always_sometimes_never" &&

      !["Always", "Sometimes", "Never"].includes(responseForm.answer_text || "")

    ) {

      const errorText = `Select Always, Sometimes, or Never for "${question.question_text}".`;

      setSectionNotice("response", "error", errorText);

      notify("error", errorText);

      return;

    }



    const normalizedActions = (responseForm.actions || [])

      .map((action) => ({

        action_required: action.action_required?.trim() || "",

        action_owner: action.action_owner?.trim() || "",

        action_timeframe: action.action_timeframe || "",

        action_support_needed: action.action_support_needed?.trim() || ""

      }))

      .filter(

        (action) =>

          action.action_required ||

          action.action_owner ||

          action.action_timeframe ||

          action.action_support_needed

      );



    const hasInvalidAction = normalizedActions.some(

      (action) => !action.action_required || !action.action_owner || !action.action_timeframe

    );



    if (hasInvalidAction) {

      const errorText = "Each action requires Action Required, Lead Owner, and Proposed Action Time.";

      setSectionNotice("response", "error", errorText);

      notify("error", errorText);

      return;

    }



    setSavingQuestionId(question.id);

    setMessage("");

    try {

      const payload = {

        question_id: Number(question.id),

        score: question.input_type === "score" ? scoreNum : null,

        answer_text:

          question.input_type === "score"

            ? null

            : question.input_type === "yes_no"

            ? responseForm.answer_text || null

            : question.input_type === "always_sometimes_never"

            ? responseForm.answer_text || null

            : responseForm.answer_text?.trim() || null,

        verbatim: responseForm.verbatim?.trim() || null,

        actions: normalizedActions

      };



      const existingResponse = responsesByQuestion[question.id];

      const endpoint = existingResponse

        ? `${API_BASE}/dashboard-visits/${visitId}/responses/${existingResponse.response_id}${CACHE_BUST}`

        : `${API_BASE}/dashboard-visits/${visitId}/responses${CACHE_BUST}`;

      const method = existingResponse ? "PUT" : "POST";



      const res = await fetch(endpoint, {

        method,

        headers,

        body: JSON.stringify(payload)

      });

      const data = await res.json();

      if (!res.ok) {

        const errorText = data.detail || "Failed to add response";

        setMessage(errorText);

        setSectionNotice("response", "error", errorText);

        notify("error", errorText);

        return;

      }

      const successText = existingResponse

        ? `Response updated for ${question.category}.`

        : `Response saved for ${question.category}.`;

      setMessage(successText);

      setSectionNotice("response", "success", successText);

      notify("success", successText);

      await loadVisitResponses(visitId);

    } catch {

      const errorText = "Failed to add response";

      setMessage(errorText);

      setSectionNotice("response", "error", errorText);

      notify("error", errorText);

    } finally {

      setSavingQuestionId(null);

    }

  };



  const getVisibleQuestions = () => {

    const q16Question = questions.find((question) => question.question_key === Q16_KEY);

    const q16Answer = q16Question

      ? responseDrafts[q16Question.id]?.answer_text ||

        responsesByQuestion[q16Question.id]?.answer_text ||

        ""

      : "";

    const q16IsYes = q16Answer === "Y";



    return questions.filter((question) => question.question_key !== Q17_KEY || q16IsYes);

  };



  const handleSubmitVisit = async () => {

    if (!visitId) {

      const errorText = "Create a visit first.";

      setMessage(errorText);

      setSectionNotice("submit", "error", errorText);

      notify("error", errorText);

      return;

    }



    const mandatoryQuestions = getVisibleQuestions().filter((question) => question.is_mandatory);

    const unansweredMandatory = mandatoryQuestions.filter(

      (question) => !responsesByQuestion[question.id]

    );

    if (mandatoryQuestions.length > 0 && unansweredMandatory.length > 0) {

      const errorText = `Complete all required questions before submit (${unansweredMandatory.length} remaining).`;

      setSectionNotice("submit", "error", errorText);

      setSectionNotice("response", "error", errorText);

      notify("error", errorText);

      return;

    }



    setIsSubmittingVisit(true);

    try {

      const res = await fetch(`${API_BASE}/dashboard-visits/${visitId}/submit${CACHE_BUST}`, {

        method: "PUT",

        headers,

        body: JSON.stringify({ submit_notes: null })

      });

      const data = await res.json();

      if (!res.ok) {

        const errorText = data.detail || "Failed to submit visit";

        setMessage(errorText);

        setSectionNotice("submit", "error", errorText);

        notify("error", errorText);

        return;

      }

      setStatus(data.status || "Pending");

      const successText = "Visit submitted for review.";

      setMessage(successText);

      setSectionNotice("submit", "success", successText);

      notify("success", successText);

    } catch {

      const errorText = "Failed to submit visit";

      setMessage(errorText);

      setSectionNotice("submit", "error", errorText);

      notify("error", errorText);

    } finally {

      setIsSubmittingVisit(false);

    }

  };



  const visibleQuestions = getVisibleQuestions();



  const groupedQuestions = visibleQuestions.reduce((acc, question) => {

    if (!acc[question.category]) {

      acc[question.category] = [];

    }

    acc[question.category].push(question);

    return acc;

  }, {});



  const orderedCategories = Object.keys(groupedQuestions).sort((left, right) => {

    const leftIndex = QUESTION_CATEGORY_ORDER.indexOf(left);

    const rightIndex = QUESTION_CATEGORY_ORDER.indexOf(right);

    if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right);

    if (leftIndex === -1) return 1;

    if (rightIndex === -1) return -1;

    return leftIndex - rightIndex;

  });



  const mandatoryQuestions = visibleQuestions.filter((question) => question.is_mandatory);
  const completedMandatoryCount = mandatoryQuestions.filter(
    (question) => responsesByQuestion[question.id]
  ).length;

  const categoryToId = (category) => `category-${String(category).replace(/[^a-zA-Z0-9]/g, "-")}`;
  const isCompactDesktop = !isMobile && !isTablet && viewportWidth < 1280;
  const useUnifiedSidebar = true;

  const handleLogout = () => {
    instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin });
  };

  const jumpToCategory = (category) => {
    setCurrentCategory(category);
    setShowMobileNav(false);
    const id = categoryToId(category);
    window.setTimeout(() => {
      const el = document.getElementById(id);
      if (!el) return;
      const offset = Math.max(96, Math.min(Math.round(window.innerHeight * 0.35), 160));
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }, 60);
  };

  useEffect(() => {
    const ctx = gsap.context(() => {
      const targets = gsap.utils.toArray(".panel, .hero, .planned-card, .question-card, .question-group");
      if (!targets.length) return;
      gsap.fromTo(
        targets,
        { autoAlpha: 0, y: 10 },
        { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.03, ease: "power2.out" }
      );
    });

    return () => ctx.revert();
  }, [activeTab, currentCategory, showMobileNav]);

  if (!msalReady || !isAuthenticated || !accessToken) {
    return (
      <motion.main id="main-content" className="page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <section className="hero" role="status" aria-live="polite" aria-atomic="true">
          <h1>Signing you in...</h1>
          <p className="lead">Please wait while Microsoft Entra authentication completes.</p>
        </section>
      </motion.main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="workspace-nav">
        <section className="workspace-card panel">
          <div className="workspace-content">
            <div className="workspace-brand">B2B Survey Platform</div>
            <div className="workspace-menu">
              <Button type="button" variant={activeTab === "planned" ? "default" : "ghost"} size="sm" onClick={() => setActiveTab("planned")}>
                <span className="nav-tab-inner"><CalendarDays className="icon icon--sm" aria-hidden="true" />Planned Visits</span>
              </Button>
              <Button type="button" variant={activeTab === "survey" ? "default" : "ghost"} size="sm" onClick={() => setActiveTab("survey")}>
                <span className="nav-tab-inner"><ClipboardCheck className="icon icon--sm" aria-hidden="true" />Survey</span>
              </Button>
            </div>
            <div className="workspace-jump">
              <h3 className="jump-nav-title">Jump to Category</h3>
              <div className="jump-nav-list category-list">
                {orderedCategories.map((category) => (
                  <Button
                    key={category}
                    type="button"
                    onClick={() => jumpToCategory(category)}
                    className={`jump-nav-item category-item ${currentCategory === category ? "active" : ""}`}
                    variant="ghost"
                    size="auto"
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </div>
            <div className="workspace-meta">
              <span className="workspace-meta-label">Signed in</span>
              <strong>{userName || "Unknown user"}</strong>
              <span className="workspace-meta-email">{userEmail || "No email"}</span>
              <Button type="button" variant="outline" size="sm" onClick={handleLogout} aria-label="Log out">
                <span className="nav-tab-inner"><LogOut className="icon icon--sm" aria-hidden="true" />Logout</span>
              </Button>
            </div>
          </div>
        </section>
      </aside>

    <motion.main id="main-content" className="page workspace-main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
      <a href="#main-content" className="skip-link">Skip to main content</a>

      <AnimatePresence>
        {toast ? (
          <motion.div className="pointer-events-none fixed right-4 top-4 z-50" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <div
              className={`rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg backdrop-blur ${
                NOTICE_STYLE[toast.type] || NOTICE_STYLE.info
              }`}
            >
              {toast.text}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <section ref={heroSectionRef} className="hero">
        <p className="eyebrow">Survey Console</p>

        <h1>B2B Customer Experience Visit</h1>

        <p className="lead">

          Structured visit assessments with governance, action tracking, and clear status transitions.

        </p>

      </section>



      {/* Dynamic Navigation */}

      {!useUnifiedSidebar && (isMobile ? (

        /* Mobile: Bottom Tab Navigation */

        <>

          <nav className={`category-nav mobile-jump-nav ${showMobileNav ? 'open' : 'closed'}`}>

            <Button
              type="button"
              className="mobile-nav-close"
              onClick={() => setShowMobileNav(false)}
              aria-label="Close category navigation"
              variant="ghost"
              size="auto"
            >
              <span className="mobile-nav-close-icon" aria-hidden="true">X</span>
            </Button>
            <h3 className="jump-nav-title">Jump to Category</h3>
            <div className="jump-nav-list category-list">
              {orderedCategories.map((category, index) => (

                <Button
                  key={category}
                  type="button"
                  onClick={() => {
                    setCurrentCategory(category);

                    setShowMobileNav(false);

                    setTimeout(() => {

                      const categoryId = categoryToId(category);

                      const categoryElement = document.getElementById(categoryId);



                      if (categoryElement) {

                        const elementRect = categoryElement.getBoundingClientRect();

                        const viewportHeight = window.innerHeight;

                        const minOffset = 120;

                        const maxOffset = Math.round(viewportHeight * 0.35);

                        const desiredOffset = 140;

                        const offset = Math.max(minOffset, Math.min(maxOffset, desiredOffset));



                        window.scrollTo({

                          top: elementRect.top + window.scrollY - offset,

                          behavior: "smooth"

                        });

                      }

                    }, 140);
                  }}
                  className={`jump-nav-item category-item ${currentCategory === category ? "active" : ""}`}
                  variant="ghost"
                  size="auto"
                >
                  {category}
                </Button>
              ))}
            </div>
          </nav>
          

          {/* Mobile Navigation Toggle - Bottom Tab */}

          {orderedCategories.length > 0 && (

            <Button
              type="button"
              className={`mobile-nav-toggle mobile-category-toggle ${showMobileNav ? 'active' : ''}`}
              onClick={() => setShowMobileNav(!showMobileNav)}
              variant="ghost"
            >
              {showMobileNav ? 'Close Categories' : 'Jump to Category'}
            </Button>
          )}

        </>

      ) : isTablet ? (

        /* Tablet: Collapsible Sidebar */

        <nav className={`category-nav tablet-jump-nav ${showMobileNav ? 'open' : ''}`}>

          <Button
            type="button"
            className="tablet-nav-toggle"
            onClick={() => setShowMobileNav(!showMobileNav)}
            variant="ghost"
            size="sm"
            aria-label={showMobileNav ? "Close category navigation" : "Open category navigation"}
          >
            {showMobileNav ? "Close" : "Menu"}
          </Button>
          <h3 className="jump-nav-title">Jump to Category</h3>
          <div className="jump-nav-list category-list">
            {orderedCategories.map((category, index) => (

              <Button
                key={category}
                type="button"
                onClick={() => {
                  setCurrentCategory(category);

                  setTimeout(() => {

                    const categoryId = categoryToId(category);

                    const categoryElement = document.getElementById(categoryId);



                    if (categoryElement) {

                      const elementRect = categoryElement.getBoundingClientRect();

                      const viewportHeight = window.innerHeight;

                      const minOffset = 120;

                      const maxOffset = Math.round(viewportHeight * 0.35);

                      const desiredOffset = 160;

                      const offset = Math.max(minOffset, Math.min(maxOffset, desiredOffset));



                      window.scrollTo({

                        top: elementRect.top + window.scrollY - offset,

                        behavior: "smooth"

                      });

                    }

                  }, 50);

                }}

                className={`jump-nav-item category-item ${currentCategory === category ? "active" : ""}`}
                variant="ghost"
                size="auto"
              >
                {category}
              </Button>
            ))}
          </div>
        </nav>
      ) : (
        /* Desktop: Always Visible Sidebar */
        <>
          {/* Desktop Navigation Toggle - Optional for compact desktop */}
          {showDesktopJumpNav && isCompactDesktop && (
            <Button
              type="button"
              className="desktop-nav-toggle"
              onClick={() => setShowMobileNav(!showMobileNav)}
              variant="ghost"
              size="sm"
              aria-label={showMobileNav ? "Close jump navigation" : "Open jump navigation"}
            >
              {showMobileNav ? "Close" : "Menu"}
            </Button>
          )}
          
          {showDesktopJumpNav ? (
            <nav className={`category-nav desktop-jump-nav ${isCompactDesktop && !showMobileNav ? 'collapsed' : ''}`}>
            <h3 className="jump-nav-title">Jump to Category</h3>
            <div className="jump-nav-list category-list">
              {orderedCategories.map((category, index) => (
                <Button
                  key={category}
                  type="button"
                  onClick={() => {
                    setCurrentCategory(category);

                    setTimeout(() => {

                      const categoryId = categoryToId(category);

                      const categoryElement = document.getElementById(categoryId);



                      if (categoryElement) {

                        const elementRect = categoryElement.getBoundingClientRect();

                        const viewportHeight = window.innerHeight;

                        const minOffset = 120;

                        const maxOffset = Math.round(viewportHeight * 0.35);

                        const desiredOffset = 180;

                        const offset = Math.max(minOffset, Math.min(maxOffset, desiredOffset));



                        window.scrollTo({

                          top: elementRect.top + window.scrollY - offset,

                          behavior: "smooth"

                        });

                      }

                    }, 50);

                  }}

                  className={`jump-nav-item category-item ${currentCategory === category ? "active" : ""}`}
                  variant="ghost"
                  size="auto"
                >
                  {category}
                </Button>
              ))}
            </div>
            </nav>
          ) : null}
        </>
      ))}


      {/* Main Content Wrapper - Responsive based on viewport */}

      <div
        className={useUnifiedSidebar ? "" : `ml-72 ${isTablet && showMobileNav ? 'tablet-nav-open' : ''} ${
          (!showDesktopJumpNav || (isCompactDesktop && !showMobileNav)) ? 'desktop-nav-collapsed' : ''
        }`}
      >
        <section ref={questionsSectionRef} className="panel">
        <h2>Identity</h2>
        <div className="grid">
          <label>
            Name
            <Input value={userName || "-"} disabled />
          </label>
          <label>
            Email
            <Input value={userEmail || "-"} disabled />
          </label>
        </div>
      </section>


      <section className="panel">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="tabs">
          <TabsList role="tablist" aria-label="Survey sections">
            <TabsTrigger value="planned" role="tab" aria-selected={activeTab === "planned"}><span className="nav-tab-inner"><CalendarDays className="icon icon--sm" aria-hidden="true" />Planned Visits</span></TabsTrigger>
            <TabsTrigger value="survey" role="tab" aria-selected={activeTab === "survey"}><span className="nav-tab-inner"><ClipboardCheck className="icon icon--sm" aria-hidden="true" />Survey</span></TabsTrigger>
          </TabsList>
        </Tabs>
      </section>


      {activeTab === "planned" ? (

        <section className="panel">

          <div className="panel-header section-toolbar">

            <h2>Upcoming & Today</h2>

            <div className="action-toolbar">

              <Button
                type="button"
                className="ghost transition duration-200 hover:-translate-y-0.5 disabled:opacity-60"
                onClick={() => loadDrafts()}
                disabled={isLoadingDrafts}
                variant="outline"
                size="sm"
              >
                {isLoadingDrafts ? "Refreshing..." : "Refresh"}
              </Button>
              <Button type="button" className="ghost" onClick={() => setActiveTab("survey")} variant="outline" size="sm">
                Start Survey
              </Button>
            </div>

          </div>

          {noticeBySection.planned ? (

            <div

              className={`section-notice mt-3 rounded-xl border px-3 py-2 text-sm ${

                NOTICE_STYLE[noticeBySection.planned.type] || NOTICE_STYLE.info

              }`}

              role="status"

              aria-live="polite"

            >

              {noticeBySection.planned.text}

            </div>

          ) : null}

          {plannedToday.length === 0 && plannedUpcoming.length === 0 ? (

            <p className="message">No planned visits for today or later.</p>

          ) : (

            <div className="planned-list">

              {plannedToday.length > 0 ? (

                <div className="planned-group">

                  <span className="group-label">Today</span>

                  {plannedToday.map((draft) => {

                    const progress = getDraftProgressLabel(draft);

                    return (

                      <Button
                        type="button"
                        key={draft.visit_id}
                        className="planned-card"
                        onClick={() => handleSelectPlannedVisit(draft)}
                        variant="ghost"
                        size="auto"
                      >
                        <div>

                          <strong>{resolveBusinessName(draft)}</strong>

                          <div className="planned-badges">

                            <span className={`pill priority-${draft.business_priority || "medium"}`}>

                              {draft.business_priority

                                ? `${draft.business_priority} priority`

                                : "standard priority"}

                            </span>

                            <span className={`pill type-${(draft.visit_type || "Planned").toLowerCase()}`}>

                              {draft.visit_type || "Planned"}

                            </span>

                            <span className="pill outline">

                              {draft.created_by_role &&

                              (draft.created_by_role === "Manager" || draft.created_by_role === "Admin")

                                ? "Manager Plan"

                                : "Rep Draft"}

                            </span>

                            <span className={`pill ${progress.className}`}>{progress.text}</span>

                          </div>

                          <p>Visit ID: {draft.visit_id.slice(0, 8)}</p>

                        </div>

                        <div className="planned-meta">

                          <span>{draft.visit_date}</span>

                          <span>Representative #{draft.representative_id}</span>

                        </div>

                      </Button>
                    );

                  })}

                </div>

              ) : null}

              {plannedUpcoming.length > 0 ? (

                <div className="planned-group">

                  <span className="group-label">Upcoming</span>

                  {plannedUpcoming.map((draft) => {

                    const progress = getDraftProgressLabel(draft);

                    return (

                      <Button
                        type="button"
                        key={draft.visit_id}
                        className="planned-card"
                        onClick={() => handleSelectPlannedVisit(draft)}
                        variant="ghost"
                        size="auto"
                      >
                        <div>

                          <strong>{resolveBusinessName(draft)}</strong>

                          <div className="planned-badges">

                            <span className={`pill priority-${draft.business_priority || "medium"}`}>

                              {draft.business_priority

                                ? `${draft.business_priority} priority`

                                : "standard priority"}

                            </span>

                            <span className={`pill type-${(draft.visit_type || "Planned").toLowerCase()}`}>

                              {draft.visit_type || "Planned"}

                            </span>

                            <span className="pill outline">

                              {draft.created_by_role &&

                              (draft.created_by_role === "Manager" || draft.created_by_role === "Admin")

                                ? "Manager Plan"

                                : "Rep Draft"}

                            </span>

                            <span className={`pill ${progress.className}`}>{progress.text}</span>

                          </div>

                          <p>Visit ID: {draft.visit_id.slice(0, 8)}</p>

                        </div>

                        <div className="planned-meta">

                          <span>{draft.visit_date}</span>

                          <span>Representative #{draft.representative_id}</span>

                        </div>

                      </Button>
                    );

                  })}

                </div>

              ) : null}

            </div>

          )}

        </section>

      ) : null}



      {activeTab === "survey" ? (

        <section className="panel">

          <h2>Survey Visit</h2>

          <div className="grid">

            <label>

              Visit Source

              <Select
                value={visitSource}
                onChange={(e) => setVisitSource(e.target.value)}
              >
                <option value="new">New visit</option>
                <option value="planned">Planned visit</option>
              </Select>
            </label>

            {visitSource === "planned" ? (

              <label>

                Planned Visits

                <Select
                  value={selectedDraftId}
                  onChange={(e) => {
                    const draft = draftVisits.find((item) => item.visit_id === e.target.value);

                    setSelectedDraftId(e.target.value);

                    if (draft) {

                      setVisitForm((prev) => ({

                        ...prev,

                        business_id: String(draft.business_id || ""),

                        visit_date: draft.visit_date || "",

                        visit_type: "Planned"

                      }));

                      setSelectedDraftName(draft.business_name || "");

                      setVisitId(draft.visit_id);

                      setStatus(draft.status || "Draft");

                    }

                  }}

                >
                  <option value="">Select a planned visit</option>
                  {draftVisits.map((draft) => {

                    const progress = getDraftProgressLabel(draft);

                    return (

                      <option key={draft.visit_id} value={draft.visit_id}>

                        {draft.business_name} ({draft.business_priority || "medium"}) · {draft.visit_date} · {progress.text}

                      </option>

                    );

                  })}

                </Select>
              </label>
            ) : (
              <label>
                Business Source
                <Select
                  value={businessMode}
                  onChange={(e) => setBusinessMode(e.target.value)}
                >
                  <option value="existing">Choose existing</option>
                  <option value="new">Add new business</option>
                </Select>
              </label>
            )}
            {visitSource === "planned" ? (
              <label>
                Business
                <Input value={selectedDraftName || "Selected business"} disabled />
              </label>
            ) : businessMode === "existing" ? (
              <label>
                Business
                <Select
                  value={visitForm.business_id}
                  onChange={(e) => setVisitForm({ ...visitForm, business_id: e.target.value })}
                >
                  {businesses.length === 0 ? (

                    <option value="">No businesses</option>

                  ) : (

                    businesses.map((business) => (

                      <option key={business.id} value={business.id}>

                        {business.name} ({business.priority_level || "medium"})

                      </option>

                    ))

                  )}

                </Select>
              </label>
            ) : (
              <label>
                New Business Name
                <Input
                  value={newBusinessName}
                  onChange={(e) => setNewBusinessName(e.target.value)}
                  placeholder="Enter business name"
                />
              </label>
            )}
            <label>
              Representative ID
              <Input
                value={visitForm.representative_id}
                onChange={(e) =>
                  setVisitForm({ ...visitForm, representative_id: e.target.value })
                }
              />
            </label>
            <label>
              Visit Date
              <Input
                type="date"
                value={visitForm.visit_date}
                onChange={(e) => setVisitForm({ ...visitForm, visit_date: e.target.value })}
              />
            </label>
            <label>
              Visit Type
              <Select
                value={visitForm.visit_type}
                onChange={(e) => setVisitForm({ ...visitForm, visit_type: e.target.value })}
                disabled={visitSource === "planned"}
              >
                <option>Planned</option>
                <option>Priority</option>
                <option>Substitution</option>
              </Select>
            </label>
          </div>
          <Button
            type="button"
            onClick={handleCreateVisit}
            disabled={isCreatingVisit}
            className="transition duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCreatingVisit

              ? "Saving..."

              : visitSource === "planned"

              ? "Update Planned Visit"

              : "Create Draft Visit"}

          </Button>
          {noticeBySection.create ? (

            <div

              className={`section-notice mt-3 rounded-xl border px-3 py-2 text-sm ${

                NOTICE_STYLE[noticeBySection.create.type] || NOTICE_STYLE.info

              }`}

              role="status"

              aria-live="polite"

            >

              {noticeBySection.create.text}

            </div>

          ) : null}

          {businessError ? <p className="message">{businessError}</p> : null}

        </section>

      ) : null}



      <section className="panel">

        <div className="panel-header section-toolbar">

          <h2>Required Questions by Category</h2>

          <span className="pill muted">

            Required completed: {completedMandatoryCount}/{mandatoryQuestions.length}

          </span>

        </div>

        {questionError ? <p className="message">{questionError}</p> : null}

        {orderedCategories.length === 0 ? (

          <p className="message">No questions configured yet.</p>

        ) : (

          <div className="question-groups">

            {orderedCategories.map((category) => (

              <section key={category} id={categoryToId(category)} className="question-group">

                <div className="question-group-header">

                  <h3>{category}</h3>

                  <span className="category-chip">

                    {groupedQuestions[category].length} question

                    {groupedQuestions[category].length === 1 ? "" : "s"}

                  </span>

                </div>

                <div className="question-list">

                  {groupedQuestions[category].map((question) => {

                    const draft = responseDrafts[question.id] || {};

                    const existingResponse = responsesByQuestion[question.id];

                    const isSavingThisQuestion = savingQuestionId === question.id;

                    return (

                      <article key={question.id} className="question-card">

                        <div className="question-head">

                          <strong>

                            Q{question.order_index}. {question.question_text}

                          </strong>

                          <div className="question-tags">

                            {question.is_mandatory ? <span className="pill">Required</span> : null}

                            {question.is_nps ? <span className="pill type-planned">NPS</span> : null}

                            {existingResponse ? <span className="pill priority-low">Saved</span> : null}

                          </div>

                        </div>

                        {question.helper_text ? <p className="caption">{question.helper_text}</p> : null}

                        <div className="grid">

                          {question.input_type === "score" ? (

                            <>

                              <label>

                                Score ({question.score_min ?? 0}-{question.score_max ?? 10})

                                <Input
                                  type="number"
                                  min={question.score_min ?? 0}

                                  max={question.score_max ?? 10}

                                  value={draft.score || ""}

                                  onChange={(event) =>

                                    updateQuestionDraft(question.id, "score", event.target.value)

                                  }

                                />

                              </label>

                              <label className="full">

                                Verbatim / Evidence (Optional)

                                <Textarea
                                  value={draft.verbatim || ""}
                                  onChange={(event) =>

                                    updateQuestionDraft(question.id, "verbatim", event.target.value)

                                  }

                                />

                              </label>

                              <div className="full action-list-head">

                                <strong>Actions (optional)</strong>

                                <Button
                                  type="button"
                                  className="ghost"
                                  onClick={() => addActionItem(question.id)}
                                  variant="outline"
                                  size="sm"
                                >
                                  Add Action
                                </Button>
                              </div>

                              {(draft.actions || []).map((action, actionIndex) => (

                                <div key={`${question.id}-${actionIndex}`} className="full action-card">

                                  <div className="grid">

                                    <label className="full">

                                      Action Required

                                      <Input
                                        value={action.action_required || ""}
                                        onChange={(event) =>

                                          updateActionItem(

                                            question.id,

                                            actionIndex,

                                            "action_required",

                                            event.target.value

                                          )

                                        }

                                      />

                                    </label>

                                    <label>

                                      Lead Owner

                                      <Input
                                        value={action.action_owner || ""}
                                        onChange={(event) =>

                                          updateActionItem(

                                            question.id,

                                            actionIndex,

                                            "action_owner",

                                            event.target.value

                                          )

                                        }

                                      />

                                    </label>

                                    <label>

                                      Proposed Action Time

                                      <Select
                                        value={action.action_timeframe || ""}
                                        onChange={(event) =>

                                          updateActionItem(

                                            question.id,

                                            actionIndex,

                                            "action_timeframe",

                                            event.target.value

                                          )

                                        }

                                      >

                                        <option value="">Select timeframe</option>

                                        <option value="lt_1_month">&lt; 1 month</option>

                                        <option value="lt_3_months">&lt; 3 months</option>

                                        <option value="gt_3_months">&gt; 3 months</option>

                                      </Select>
                                    </label>

                                    <label className="full">

                                      Support Needed (department or person)

                                      <Input
                                        value={action.action_support_needed || ""}
                                        onChange={(event) =>

                                          updateActionItem(

                                            question.id,

                                            actionIndex,

                                            "action_support_needed",

                                            event.target.value

                                          )

                                        }

                                      />

                                    </label>

                                  </div>

                                  <Button
                                    type="button"
                                    className="danger action-remove"
                                    onClick={() => removeActionItem(question.id, actionIndex)}
                                    variant="destructive"
                                    size="sm"
                                  >
                                    Remove Action
                                  </Button>
                                </div>

                              ))}

                            </>

                          ) : question.input_type === "yes_no" ? (

                            <>

                              <label className="full">

                                Answer

                                <RadioGroup className="yes-no-group">
                                  <label className="yes-no-option">
                                    <RadioGroupItem
                                      name={`q-${question.id}-yesno`}
                                      checked={draft.answer_text === "Y"}
                                      onChange={() => updateQuestionDraft(question.id, "answer_text", "Y")}
                                    />
                                    Yes
                                  </label>
                                  <label className="yes-no-option">
                                    <RadioGroupItem
                                      name={`q-${question.id}-yesno`}
                                      checked={draft.answer_text === "N"}
                                      onChange={() => updateQuestionDraft(question.id, "answer_text", "N")}
                                    />
                                    No
                                  </label>
                                </RadioGroup>
                              </label>

                              {question.question_key === Q16_KEY && draft.answer_text === "Y" ? (

                                <label className="full">

                                  If Yes, specify providers (optional)

                                  <Textarea
                                    value={draft.verbatim || ""}
                                    onChange={(event) =>

                                      updateQuestionDraft(question.id, "verbatim", event.target.value)

                                    }

                                  />

                                </label>

                              ) : null}

                              <div className="full action-list-head">

                                <strong>Actions (optional)</strong>

                                <Button
                                  type="button"
                                  className="ghost"
                                  onClick={() => addActionItem(question.id)}
                                  variant="outline"
                                  size="sm"
                                >
                                  Add Action
                                </Button>
                              </div>

                              {(draft.actions || []).map((action, actionIndex) => (

                                <div key={`${question.id}-${actionIndex}`} className="full action-card">

                                  <div className="grid">

                                    <label className="full">

                                      Action Required

                                      <Input
                                        value={action.action_required || ""}
                                        onChange={(event) =>

                                          updateActionItem(

                                            question.id,

                                            actionIndex,

                                            "action_required",

                                            event.target.value

                                          )

                                        }

                                      />

                                    </label>

                                    <label>

                                      Lead Owner

                                      <Input
                                        value={action.action_owner || ""}
                                        onChange={(event) =>

                                          updateActionItem(

                                            question.id,

                                            actionIndex,

                                            "action_owner",

                                            event.target.value

                                          )

                                        }

                                      />

                                    </label>

                                    <label>

                                      Proposed Action Time

                                      <Select
                                        value={action.action_timeframe || ""}
                                        onChange={(event) =>

                                          updateActionItem(

                                            question.id,

                                            actionIndex,

                                            "action_timeframe",

                                            event.target.value

                                          )

                                        }

                                      >

                                        <option value="">Select timeframe</option>

                                        <option value="lt_1_month">&lt; 1 month</option>

                                        <option value="lt_3_months">&lt; 3 months</option>

                                        <option value="gt_3_months">&gt; 3 months</option>

                                      </Select>
                                    </label>

                                    <label className="full">

                                      Support Needed (department or person)

                                      <Input
                                        value={action.action_support_needed || ""}
                                        onChange={(event) =>

                                          updateActionItem(

                                            question.id,

                                            actionIndex,

                                            "action_support_needed",

                                            event.target.value

                                          )

                                        }

                                      />

                                    </label>

                                  </div>

                                  <Button
                                    type="button"
                                    className="danger action-remove"
                                    onClick={() => removeActionItem(question.id, actionIndex)}
                                    variant="destructive"
                                    size="sm"
                                  >
                                    Remove Action
                                  </Button>
                                </div>

                              ))}

                            </>

                          ) : question.input_type === "always_sometimes_never" ? (

                            <>

                              <label className="full">

                                Answer

                                <RadioGroup className="yes-no-group">
                                  <label className="yes-no-option">
                                    <RadioGroupItem
                                      name={`q-${question.id}-asn`}
                                      checked={draft.answer_text === "Always"}
                                      onChange={() =>
                                        updateQuestionDraft(question.id, "answer_text", "Always")
                                      }
                                    />
                                    Always
                                  </label>
                                  <label className="yes-no-option">
                                    <RadioGroupItem
                                      name={`q-${question.id}-asn`}
                                      checked={draft.answer_text === "Sometimes"}
                                      onChange={() =>
                                        updateQuestionDraft(question.id, "answer_text", "Sometimes")
                                      }
                                    />
                                    Sometimes
                                  </label>
                                  <label className="yes-no-option">
                                    <RadioGroupItem
                                      name={`q-${question.id}-asn`}
                                      checked={draft.answer_text === "Never"}
                                      onChange={() =>
                                        updateQuestionDraft(question.id, "answer_text", "Never")
                                      }
                                    />
                                    Never
                                  </label>
                                </RadioGroup>
                              </label>

                              <label className="full">

                                Verbatim / Evidence (Optional)

                                <Textarea
                                  value={draft.verbatim || ""}
                                  onChange={(event) =>

                                    updateQuestionDraft(question.id, "verbatim", event.target.value)

                                  }

                                />

                              </label>

                              <div className="full action-list-head">

                                <strong>Actions (optional)</strong>

                                <Button
                                  type="button"
                                  className="ghost"
                                  onClick={() => addActionItem(question.id)}
                                  variant="outline"
                                  size="sm"
                                >
                                  Add Action
                                </Button>
                              </div>

                              {(draft.actions || []).map((action, actionIndex) => (

                                <div key={`${question.id}-${actionIndex}`} className="full action-card">

                                  <div className="grid">

                                    <label className="full">

                                      Action Required

                                      <Input
                                        value={action.action_required || ""}
                                        onChange={(event) =>

                                          updateActionItem(

                                            question.id,

                                            actionIndex,

                                            "action_required",

                                            event.target.value

                                          )

                                        }

                                      />

                                    </label>

                                    <label>

                                      Lead Owner

                                      <Input
                                        value={action.action_owner || ""}
                                        onChange={(event) =>

                                          updateActionItem(

                                            question.id,

                                            actionIndex,

                                            "action_owner",

                                            event.target.value

                                          )

                                        }

                                      />

                                    </label>

                                    <label>

                                      Proposed Action Time

                                      <Select
                                        value={action.action_timeframe || ""}
                                        onChange={(event) =>

                                          updateActionItem(

                                            question.id,

                                            actionIndex,

                                            "action_timeframe",

                                            event.target.value

                                          )

                                        }

                                      >

                                        <option value="">Select timeframe</option>

                                        <option value="lt_1_month">&lt; 1 month</option>

                                        <option value="lt_3_months">&lt; 3 months</option>

                                        <option value="gt_3_months">&gt; 3 months</option>

                                      </Select>
                                    </label>

                                    <label className="full">

                                      Support Needed (department or person)

                                      <Input
                                        value={action.action_support_needed || ""}
                                        onChange={(event) =>

                                          updateActionItem(

                                            question.id,

                                            actionIndex,

                                            "action_support_needed",

                                            event.target.value

                                          )

                                        }

                                      />

                                    </label>

                                  </div>

                                  <Button
                                    type="button"
                                    className="danger action-remove"
                                    onClick={() => removeActionItem(question.id, actionIndex)}
                                    variant="destructive"
                                    size="sm"
                                  >
                                    Remove Action
                                  </Button>
                                </div>

                              ))}

                            </>

                          ) : (

                            <>

                              <label className="full">

                                Answer

                                <Textarea
                                  value={draft.answer_text || ""}
                                  onChange={(event) =>

                                    updateQuestionDraft(question.id, "answer_text", event.target.value)

                                  }

                                />

                              </label>

                              <div className="full action-list-head">

                                <strong>Actions (optional)</strong>

                                <Button
                                  type="button"
                                  className="ghost"
                                  onClick={() => addActionItem(question.id)}
                                  variant="outline"
                                  size="sm"
                                >
                                  Add Action
                                </Button>
                              </div>

                              {(draft.actions || []).map((action, actionIndex) => (

                                <div key={`${question.id}-${actionIndex}`} className="full action-card">

                                  <div className="grid">

                                    <label className="full">

                                      Action Required

                                      <Input
                                        value={action.action_required || ""}
                                        onChange={(event) =>

                                          updateActionItem(

                                            question.id,

                                            actionIndex,

                                            "action_required",

                                            event.target.value

                                          )

                                        }

                                      />

                                    </label>

                                    <label>

                                      Lead Owner

                                      <Input
                                        value={action.action_owner || ""}
                                        onChange={(event) =>

                                          updateActionItem(

                                            question.id,

                                            actionIndex,

                                            "action_owner",

                                            event.target.value

                                          )

                                        }

                                      />

                                    </label>

                                    <label>

                                      Proposed Action Time

                                      <Select
                                        value={action.action_timeframe || ""}
                                        onChange={(event) =>

                                          updateActionItem(

                                            question.id,

                                            actionIndex,

                                            "action_timeframe",

                                            event.target.value

                                          )

                                        }

                                      >

                                        <option value="">Select timeframe</option>

                                        <option value="lt_1_month">&lt; 1 month</option>

                                        <option value="lt_3_months">&lt; 3 months</option>

                                        <option value="gt_3_months">&gt; 3 months</option>

                                      </Select>
                                    </label>

                                    <label className="full">

                                      Support Needed (department or person)

                                      <Input
                                        value={action.action_support_needed || ""}
                                        onChange={(event) =>

                                          updateActionItem(

                                            question.id,

                                            actionIndex,

                                            "action_support_needed",

                                            event.target.value

                                          )

                                        }

                                      />

                                    </label>

                                  </div>

                                  <Button
                                    type="button"
                                    className="danger action-remove"
                                    onClick={() => removeActionItem(question.id, actionIndex)}
                                    variant="destructive"
                                    size="sm"
                                  >
                                    Remove Action
                                  </Button>
                                </div>

                              ))}

                            </>

                          )}

                        </div>

                        <Button
                          type="button"
                          onClick={() => handleSaveQuestionResponse(question)}
                          disabled={isSavingThisQuestion}
                          className="transition duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isSavingThisQuestion

                            ? "Saving..."

                            : existingResponse

                            ? "Update Response"

                            : "Save Response"}

                        </Button>
                      </article>

                    );

                  })}

                </div>

              </section>

            ))}

          </div>

        )}

        {noticeBySection.response ? (

          <div

            className={`section-notice mt-3 rounded-xl border px-3 py-2 text-sm ${

              NOTICE_STYLE[noticeBySection.response.type] || NOTICE_STYLE.info

            }`}

            role="status"

            aria-live="polite"

          >

            {noticeBySection.response.text}

          </div>

        ) : null}

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

          <Button
            type="button"
            onClick={handleSubmitVisit}
            disabled={isSubmittingVisit}
            className="transition duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmittingVisit ? "Submitting..." : "Submit for Review"}
          </Button>
        </div>

      </section>



      {noticeBySection.submit ? (

        <div

          className={`section-notice mt-3 rounded-xl border px-3 py-2 text-sm ${

            NOTICE_STYLE[noticeBySection.submit.type] || NOTICE_STYLE.info

          }`}

          role="status"

          aria-live="polite"

        >

          {noticeBySection.submit.text}

        </div>

      ) : null}



      {message ? <p className="message">{message}</p> : null}



      {showQuestionsTopFab ? (

        <Button type="button" className="scroll-top-fab" onClick={scrollToQuestionsTop}>
          Questions Top
        </Button>
      ) : null}

      </div>

    </motion.main>
    </div>

  );

}

