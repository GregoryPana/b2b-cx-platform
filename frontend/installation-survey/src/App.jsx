import { useEffect, useMemo, useState } from "react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { Navigate, Route, Routes } from "react-router-dom";
import MainLayout from "./components/layout/MainLayout";
import InstallationSurveyPage from "./features/installation/InstallationSurveyPage";
import UserGuidePage from "./features/user-guide/UserGuidePage";
import { ensureMsalInitialized, loginRequest } from "./auth";
import { Card, CardContent } from "./components/ui/card";
import { Button } from "./components/ui/button";
import SigningInScreen from "./components/SigningInScreen";

const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const INSTALLATION_ALLOWED_ROLES = new Set(["INSTALL_ADMIN", "INSTALL_SURVEYOR", "CX_SUPER_ADMIN"]);
const LOGOUT_FLAG_KEY = "cx.logoutRequested";

function readJwtExpiry(accessToken) {
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

function hasInstallationAccess(roles) {
  return Array.isArray(roles) && roles.some((role) => INSTALLATION_ALLOWED_ROLES.has(role));
}

export default function App() {
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  const [msalReady, setMsalReady] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [statusText, setStatusText] = useState("");
  const [entraRoles, setEntraRoles] = useState([]);
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
    if (!msalReady || !accounts[0]) return;
    const account = accounts[0];
    const claims = account.idTokenClaims || {};
    const claimRoles = Array.isArray(claims.roles) ? claims.roles : [];
    setUserId(String(claims.sub || claims.oid || ""));
    setUserName(claims.name || account.name || "");
    setUserEmail(claims.preferred_username || account.username || "");
    setEntraRoles(claimRoles);
    setStatusText("Installation Assessment");

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
  }, [accessToken, userEmail, userId, userName, accounts, instance]);

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
      "X-User-Name": userName,
      "X-User-Email": userEmail,
      "X-User-Role": entraRoles.includes("INSTALL_ADMIN") || entraRoles.includes("CX_SUPER_ADMIN") ? "Admin" : "Representative",
    };
  }, [accessToken, entraRoles, userId, userName, userEmail]);

  const handleLogout = () => {
    try {
      sessionStorage.setItem(LOGOUT_FLAG_KEY, "true");
    } catch {
      // Ignore sessionStorage errors
    }
    setLogoutRequested(true);
    instance.logoutRedirect();
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
            <p className="text-sm text-muted-foreground">You're all set. You can close this tab, or sign in again when you're ready.</p>
            <Button type="button" onClick={handleSignInAgain}>Sign in again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated || !accessToken || !roleResolved) {
    return <SigningInScreen />;
  }

  if (!hasInstallationAccess(entraRoles)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <Card className="max-w-lg p-6">
          <CardContent className="space-y-3 pt-6">
            <h1 className="text-xl font-semibold">No Installation Access</h1>
            <p className="text-sm text-muted-foreground">
              You're signed in, but this account does not currently have access to the Installation Assessment survey.
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
      {authProfileError ? (
        <div className="border-b bg-warning/20 px-4 py-2 text-sm text-warning-foreground">{authProfileError}</div>
      ) : null}
      <MainLayout onLogout={handleLogout} userName={userName} userEmail={userEmail} statusText={statusText}>
        <Routes>
          <Route path="/" element={<InstallationSurveyPage headers={headers} />} />
          <Route path="/user-guide" element={<UserGuidePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MainLayout>
    </>
  );
}
