import { useEffect, useMemo, useState } from "react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import MainLayout from "./components/layout/MainLayout";
import InstallationSurveyPage from "./features/installation/InstallationSurveyPage";
import { ensureMsalInitialized, loginRequest } from "./auth";
import { Card, CardContent } from "./components/ui/card";

const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const INSTALLATION_ALLOWED_ROLES = new Set(["INSTALL_ADMIN", "INSTALL_SURVEYOR", "CX_SUPER_ADMIN"]);

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
      try {
        const res = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
        const data = await res.json();
        if (res.ok) {
          const roles = Array.isArray(data.roles) ? data.roles : [];
          setEntraRoles(roles);
          setUserId(String(data.sub || userId));
          setUserName(data.name || userName);
          setUserEmail(data.preferred_username || userEmail);
        }
      } finally {
        setRoleResolved(true);
      }
    };
    run();
  }, [accessToken, userEmail, userId, userName]);

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
            <button type="button" className="rounded-md border px-3 py-2 text-sm" onClick={handleLogout}>
              Logout
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <MainLayout onLogout={handleLogout} userName={userName} userEmail={userEmail} statusText={statusText}>
      <InstallationSurveyPage headers={headers} />
    </MainLayout>
  );
}
