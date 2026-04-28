import { useEffect, useMemo, useState } from "react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { Navigate, Route, Routes } from "react-router-dom";
import MainLayout from "./components/layout/MainLayout";
import SurveyWorkspacePage from "./features/survey/SurveyWorkspacePage";
import UserGuidePage from "./features/user-guide/UserGuidePage";
import { Card, CardContent } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { ensureMsalInitialized, loginRequest } from "./auth";
import { isTokenExpired } from "./utils/tokenExpiry";

const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const surveyBasePath = (import.meta.env.VITE_BASE_PATH || "/").replace(/\/+$/, "") || "/";
const surveyPostLogoutUri = new URL(surveyBasePath === "/" ? "/" : `${surveyBasePath}/`, window.location.origin).toString();
const B2B_ALLOWED_ROLES = new Set(["B2B_ADMIN", "B2B_SURVEYOR", "CX_SUPER_ADMIN"]);

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

  useEffect(() => {
    if (isAuthenticated && accounts.length > 0) {
      const account = accounts[0];
      if (isTokenExpired(account)) {
        instance.logout();
      }
    }
  }, [isAuthenticated, accounts, instance]);

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
    if (!isAuthenticated && inProgress === "none") {
      instance.loginRedirect(loginRequest);
    }
  }, [inProgress, instance, isAuthenticated, msalReady]);

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

  const headers = useMemo(() => {
    return {
      "Content-Type": "application/json",
      Authorization: accessToken ? `Bearer ${accessToken}` : "",
      "X-User-Id": userId,
      "X-User-Role": role,
    };
  }, [accessToken, role, userId]);

  const handleLogout = () => {
    instance.logoutRedirect({ postLogoutRedirectUri: surveyPostLogoutUri });
  };

  if (!msalReady || !isAuthenticated || !accessToken || !roleResolved) {
    return <div className="flex min-h-screen items-center justify-center">Signing you in...</div>;
  }

  if (!hasB2BAccess(entraRoles)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <Card className="max-w-lg p-6">
          <CardContent className="space-y-3 pt-6">
            <h1 className="text-xl font-semibold">No B2B Survey Access</h1>
            <p className="text-sm text-muted-foreground">
              Your account is signed in, but it does not have a B2B survey role.
              Ask an administrator to assign `B2B_ADMIN`, `B2B_SURVEYOR`, or `CX_SUPER_ADMIN`.
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
