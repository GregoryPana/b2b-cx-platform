import { useEffect, useMemo, useState } from "react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import MainLayout from "./components/layout/MainLayout";
import InstallationSurveyPage from "./features/installation/InstallationSurveyPage";
import { ensureMsalInitialized, loginRequest } from "./auth";
import { Card, CardContent } from "./components/ui/card";
import { Button } from "./components/ui/button";

const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const INSTALLATION_ALLOWED_ROLES = new Set(["INSTALL_ADMIN", "INSTALL_SURVEYOR", "CX_SUPER_ADMIN"]);

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

  useEffect(() => {
    let active = true;
    ensureMsalInitialized().then(() => {
      if (active) setMsalReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!msalReady) return;
    if (!isAuthenticated && inProgress === "none") {
      instance.loginRedirect(loginRequest);
    }
  }, [instance, inProgress, isAuthenticated, msalReady]);

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
    const run = async () => {
      setAuthProfileError("");
      try {
        const res = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
        const contentType = res.headers.get("content-type") || "";
        let data = null;
        if (contentType.includes("application/json")) {
          data = await res.json();
        } else {
          const rawText = await res.text();
          throw new Error(`Profile endpoint returned non-JSON response (${res.status}). ${rawText.slice(0, 120)}`);
        }

        if (res.status === 401 && accounts[0]) {
          try {
            const result = await instance.acquireTokenSilent({ ...loginRequest, account: accounts[0], forceRefresh: true });
            if (result?.accessToken) {
              setAccessToken(result.accessToken);
              return;
            }
          } catch (refreshError) {
            if (refreshError instanceof InteractionRequiredAuthError) {
              instance.acquireTokenRedirect(loginRequest);
              return;
            }
          }
        }

        if (!res.ok) {
          throw new Error(data?.detail || `Failed to load profile (${res.status})`);
        }

        if (res.ok) {
          const roles = Array.isArray(data.roles) ? data.roles : [];
          setEntraRoles(roles);
          setUserId(String(data.sub || userId));
          setUserName(data.name || userName);
          setUserEmail(data.preferred_username || userEmail);
        }
      } catch (error) {
        console.error("Failed loading /auth/me profile", error);
        setAuthProfileError("Could not load profile details from server. Installation access will fall back to your Entra token roles.");
      } finally {
        setRoleResolved(true);
      }
    };
    run();
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
    instance.logoutRedirect();
  };

  if (!msalReady || !isAuthenticated || !accessToken || !roleResolved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <Card className="p-6">
          <CardContent className="pt-6">Signing you in...</CardContent>
        </Card>
      </div>
    );
  }

  if (!hasInstallationAccess(entraRoles)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <Card className="max-w-lg p-6">
          <CardContent className="space-y-3 pt-6">
            <h1 className="text-xl font-semibold">No Installation Access</h1>
            <p className="text-sm text-muted-foreground">
              Your account is signed in, but it does not have an Installation Assessment role.
              Ask an administrator to assign `INSTALL_ADMIN`, `INSTALL_SURVEYOR`, or `CX_SUPER_ADMIN`.
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
        <InstallationSurveyPage headers={headers} />
      </MainLayout>
    </>
  );
}
