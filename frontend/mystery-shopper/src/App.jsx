import { useCallback, useEffect, useMemo, useState } from "react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { AUTH_MODE, isMysteryPublicAuthMode } from "./authMode";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { ensureMsalInitialized, loginRequest } from "./auth";
import { isTokenExpired } from "./utils/tokenExpiry";
import LoginScreen from "./mysteryAuth/LoginScreen";
import EnrollScreen from "./mysteryAuth/EnrollScreen";
import RecoveryScreen from "./mysteryAuth/RecoveryScreen";
import { useMysteryAuth } from "./mysteryAuth/MysteryAuthContext";
import SurveyWorkspace from "./SurveyWorkspace";

const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const MYSTERY_ALLOWED_ROLES = new Set(["MYSTERY_ADMIN", "MYSTERY_SURVEYOR", "CX_SUPER_ADMIN"]);
const surveyBasePath = (import.meta.env.VITE_BASE_PATH || "/").replace(/\/+$/, "") || "/";
const surveyPostLogoutUri = new URL(surveyBasePath === "/" ? "/" : `${surveyBasePath}/`, window.location.origin).toString();
const LOGOUT_FLAG_KEY = "cx.logoutRequested";

async function fetchJsonSafe(url, options = {}, timeout = 30000) {
  const controller = timeout > 0 ? new AbortController() : null;
  const timeoutId = timeout > 0 ? window.setTimeout(() => controller.abort(), timeout) : null;
  try {
    const response = await fetch(url, { ...options, ...(controller ? { signal: controller.signal } : {}) });
    const text = await response.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      // ignore parse error
    }
    return { res: response, data };
  } catch (error) {
    if (error?.name === "AbortError") {
      return { res: { ok: false, status: 408 }, data: { detail: "Request timed out", aborted: true } };
    }
    return { res: { ok: false, status: 500 }, data: { detail: error?.message || "Request failed" } };
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
}

function hasMysteryAccess(roles) {
  return Array.isArray(roles) && roles.some((role) => MYSTERY_ALLOWED_ROLES.has(role));
}

// ---------------------------------------------------------------------------
// Entra (MSAL) app — used when AUTH_MODE !== "mystery_public"
// ---------------------------------------------------------------------------
function EntraMysteryApp() {
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
  const [logoutRequested, setLogoutRequested] = useState(() => {
    try { return sessionStorage.getItem(LOGOUT_FLAG_KEY) === "true"; } catch { return false; }
  });
  const [accessToken, setAccessToken] = useState("");
  const [msalReady, setMsalReady] = useState(false);

  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        await ensureMsalInitialized();
        if (active) setMsalReady(true);
      } catch {
        if (active) setAuthProfileError("Authentication initialization failed.");
      }
    };
    init();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!msalReady) return;
    if (logoutRequested) return;
    if (!isAuthenticated && inProgress === "none") {
      instance.loginRedirect(loginRequest);
    }
  }, [instance, inProgress, isAuthenticated, logoutRequested, msalReady]);

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
        const result = await instance.acquireTokenSilent({ ...loginRequest, account });
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

  // Build apiFetch for Entra mode — sends Bearer token, credentials included
  const apiFetch = useCallback(async (url, options = {}) => {
    const headers = {
      "Content-Type": "application/json",
      Authorization: accessToken ? `Bearer ${accessToken}` : "",
      "X-User-Id": userId,
      "X-Role": role,
      ...(options.headers || {}),
    };
    return fetchJsonSafe(url, { ...options, headers, credentials: "include" });
  }, [accessToken, userId, role]);

  const userInfo = useMemo(() => ({
    name: userName,
    email: userEmail,
    userId,
    role,
  }), [userName, userEmail, userId, role]);

  const handleLogout = useCallback(() => {
    try { sessionStorage.setItem(LOGOUT_FLAG_KEY, "true"); } catch { /* ignore */ }
    setLogoutRequested(true);
    instance.logoutRedirect({ postLogoutRedirectUri: surveyPostLogoutUri });
  }, [instance]);

  const handleSignInAgain = useCallback(() => {
    try { sessionStorage.removeItem(LOGOUT_FLAG_KEY); } catch { /* ignore */ }
    setLogoutRequested(false);
    instance.loginRedirect(loginRequest);
  }, [instance]);

  // --- Auth gate screens ---
  if (!msalReady) {
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

  if (logoutRequested && !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <Card className="max-w-lg p-6" role="status" aria-live="polite">
          <CardContent className="space-y-3 pt-6">
            <CardTitle className="text-2xl">You have signed out</CardTitle>
            <p className="text-sm text-muted-foreground">You're all set. You can close this tab, or sign in again whenever you're ready.</p>
            <Button type="button" onClick={handleSignInAgain}>Sign in again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated || !accessToken || !roleResolved) {
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
            <p className="text-sm text-muted-foreground">You're signed in, but this account does not currently have access to the Mystery Shopper survey. Please ask an administrator to grant access and then try again.</p>
            <Button type="button" variant="outline" onClick={handleLogout}>Logout</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <SurveyWorkspace apiFetch={apiFetch} userInfo={userInfo} onLogout={handleLogout} />;
}

// ---------------------------------------------------------------------------
// Public Mystery (Password + TOTP) app — used when AUTH_MODE === "mystery_public"
// ---------------------------------------------------------------------------
function MysteryPublicApp() {
  const { isAuthenticated, loading, error, login, submitMfa, logout, mfaPending, startEnrollment, confirmEnrollment, useRecoveryCode, user } = useMysteryAuth();
  const [screen, setScreen] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("enroll") ? "enroll" : "login";
  });
  const enrollmentToken = useMemo(() => new URLSearchParams(window.location.search).get("enroll") || "", []);

  // Build apiFetch for mystery_public mode — uses httponly session cookie
  const apiFetch = useCallback(async (url, options = {}) => {
    return fetchJsonSafe(url, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
  }, []);

  const userInfo = useMemo(() => ({
    name: user?.name || "Mystery User",
    email: user?.preferred_username || "",
    userId: user?.sub || "",
    role: "Representative",
  }), [user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <Card className="max-w-lg p-6" role="status" aria-live="polite" aria-atomic="true">
          <CardContent className="space-y-3 pt-6">
            <CardTitle className="text-2xl">Loading public Mystery Shopper access...</CardTitle>
            <p className="text-sm text-muted-foreground">Checking whether you already have an active session.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (screen === "enroll" && enrollmentToken) {
    return (
      <EnrollScreen
        enrollmentToken={enrollmentToken}
        startEnrollment={startEnrollment}
        confirmEnrollment={confirmEnrollment}
        error={error}
        onBackToLogin={() => { window.history.replaceState({}, "", window.location.pathname); setScreen("login"); }}
      />
    );
  }

  if (screen === "recovery") {
    return (
      <RecoveryScreen
        error={error}
        useRecoveryCode={useRecoveryCode}
        onRecovered={(payload) => {
          if (payload?.enrollment_token) {
            window.history.replaceState({}, "", `?enroll=${encodeURIComponent(payload.enrollment_token)}`);
            window.location.reload();
          }
        }}
        onBackToLogin={() => setScreen("login")}
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginScreen
        login={login}
        submitMfa={submitMfa}
        loading={loading}
        error={error}
        mfaPending={mfaPending}
        onShowRecovery={() => setScreen("recovery")}
      />
    );
  }

  // Authenticated — render the real survey workspace
  return <SurveyWorkspace apiFetch={apiFetch} userInfo={userInfo} onLogout={logout} />;
}

// ---------------------------------------------------------------------------
// Root — selects auth mode
// ---------------------------------------------------------------------------
export default function App() {
  return isMysteryPublicAuthMode ? <MysteryPublicApp /> : <EntraMysteryApp />;
}
