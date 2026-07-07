import { useEffect, useMemo, useState } from "react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import MainLayout from "./components/layout/MainLayout";
import SurveyWorkspacePage from "./features/survey/SurveyWorkspacePage";
import UserGuidePage from "./features/user-guide/UserGuidePage";
import { Card, CardContent } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { ensureMsalInitialized, loginRequest } from "./auth";
import SigningInScreen from "./components/SigningInScreen";

const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const surveyBasePath = (import.meta.env.VITE_BASE_PATH || "/").replace(/\/+$/, "") || "/";
const surveyPostLogoutUri = new URL(surveyBasePath === "/" ? "/" : `${surveyBasePath}/`, window.location.origin).toString();
const B2B_ALLOWED_ROLES = new Set(["B2B_ADMIN", "B2B_SURVEYOR", "CX_SUPER_ADMIN"]);
const LOGOUT_FLAG_KEY = "cx.logoutRequested";

function readJwtExpiry(accessToken: string) {
  try {
    const payloadPart = String(accessToken || "").split(".")[1] || "";
    if (!payloadPart) return null;
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

function hasB2BAccess(roles: string[]) {
  return Array.isArray(roles) && roles.some((role) => B2B_ALLOWED_ROLES.has(role));
}

export default function App() {
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [msalReady, setMsalReady] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [userId, setUserId] = useState("4");
  const [role, setRole] = useState("Representative");
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [statusText, setStatusText] = useState("Draft workflow available");
  const [entraRoles, setEntraRoles] = useState<string[]>([]);
  const [roleResolved, setRoleResolved] = useState(false);
  const [authProfileError, setAuthProfileError] = useState("");
  const [logoutRequested, setLogoutRequested] = useState(() => {
    try {
      return sessionStorage.getItem(LOGOUT_FLAG_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let active = true;
    ensureMsalInitialized().then(() => {
      if (active) setMsalReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!msalReady) return;
    if (logoutRequested) return;
    if (!isAuthenticated && inProgress === "none") {
      instance.loginRedirect(loginRequest);
    }
  }, [inProgress, instance, isAuthenticated, logoutRequested, msalReady]);

  useEffect(() => {
    if (!msalReady || !accounts[0]) return;
    const account = accounts[0];
    const claims = account.idTokenClaims || {};
    const claimsRoles = Array.isArray(claims.roles) ? claims.roles : [];
    setEntraRoles(claimsRoles);
    setRole(claimsRoles.includes("B2B_ADMIN") || claimsRoles.includes("CX_SUPER_ADMIN") ? "Admin" : "Representative");
    setUserId(String(claims.sub || claims.oid || "4"));
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
  }, [accessToken, role, userEmail, userId, userName]);

  useEffect(() => {
    if (!msalReady || !accounts[0] || !accessToken) return;

    const expiry = readJwtExpiry(accessToken);
    if (!expiry) return;

    const nowSeconds = Math.floor(Date.now() / 1000);
    const refreshLeadSeconds = 120;
    const delayMs = Math.max(1000, (expiry - nowSeconds - refreshLeadSeconds) * 1000);

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      try {
        const result = await instance.acquireTokenSilent({ ...loginRequest, account: accounts[0], forceRefresh: true });
        if (result?.accessToken) {
          setAccessToken(result.accessToken);
        }
      } catch (error) {
        if (error instanceof InteractionRequiredAuthError) {
          instance.acquireTokenRedirect(loginRequest);
        }
      }
    }, delayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [msalReady, accounts, accessToken, instance]);

  useEffect(() => {
    if (!msalReady || !isAuthenticated || !accounts[0]) return;
    const interval = window.setInterval(() => {
      const expiry = readJwtExpiry(accessToken);
      if (!expiry) return;
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (nowSeconds >= expiry - 60) {
        instance.acquireTokenSilent({ ...loginRequest, account: accounts[0], forceRefresh: true })
          .then((result) => {
            if (result?.accessToken) setAccessToken(result.accessToken);
          })
          .catch((error) => {
            if (error instanceof InteractionRequiredAuthError) {
              instance.acquireTokenRedirect(loginRequest);
            }
          });
      }
    }, 60000);
    return () => window.clearInterval(interval);
  }, [msalReady, isAuthenticated, accounts, accessToken, instance]);

  const headers = useMemo(() => {
    return {
      "Content-Type": "application/json",
      Authorization: accessToken ? `Bearer ${accessToken}` : "",
      "X-User-Id": userId,
      "X-User-Role": role,
    };
  }, [accessToken, role, userId]);

  const handleLogout = () => {
    try {
      sessionStorage.setItem(LOGOUT_FLAG_KEY, "true");
    } catch {
      // Ignore sessionStorage errors
    }
    setLogoutRequested(true);
    instance.logoutRedirect({ postLogoutRedirectUri: surveyPostLogoutUri });
  };

  const handleSignInAgain = () => {
    try {
      sessionStorage.removeItem(LOGOUT_FLAG_KEY);
    } catch {
      // Ignore sessionStorage errors
    }
    setLogoutRequested(false);
    instance.loginRedirect(loginRequest);
  };

  if (!msalReady) {
    return <SigningInScreen />;
  }

  if (logoutRequested && !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <Card className="max-w-lg p-6">
          <CardContent className="space-y-3 pt-6">
            <h1 className="text-xl font-semibold">You have signed out</h1>
            <p className="text-sm text-muted-foreground">You can close this tab, or sign in again whenever you want to continue.</p>
            <Button type="button" onClick={handleSignInAgain}>Sign in again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated || !accessToken || !roleResolved) {
    return <SigningInScreen />;
  }

  if (!hasB2BAccess(entraRoles)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <Card className="max-w-lg p-6">
          <CardContent className="space-y-3 pt-6">
            <h1 className="text-xl font-semibold">No B2B Survey Access</h1>
            <p className="text-sm text-muted-foreground">
              You're signed in, but this account does not currently have access to the B2B survey.
              Please ask an administrator to grant access and then try again.
            </p>
            <Button type="button" variant="outline" onClick={handleLogout}>
              Logout
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" richColors closeButton />
      {authProfileError ? <div className="border-b bg-warning/20 px-4 py-2 text-sm text-warning-foreground">{authProfileError}</div> : null}
      <MainLayout onLogout={handleLogout} userName={userName} userEmail={userEmail} statusText={statusText}>
      <Routes>
        <Route path="/planned" element={<SurveyWorkspacePage headers={headers} userId={userId} role={role} />} />
        <Route path="/survey" element={<SurveyWorkspacePage headers={headers} userId={userId} role={role} />} />
        <Route path="/user-guide" element={<UserGuidePage />} />
        <Route path="/" element={<Navigate to="/planned" replace />} />
        <Route path="*" element={<Navigate to="/planned" replace />} />
      </Routes>
      </MainLayout>
    </>
  );
}
