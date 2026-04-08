import { useEffect, useMemo, useState } from "react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { Navigate, Route, Routes } from "react-router-dom";
import MainLayout from "./components/layout/MainLayout";
import InstallationSurveyPage from "./features/installation/InstallationSurveyPage";
import { ensureMsalInitialized, loginRequest } from "./auth";
import { isTokenExpired } from "./utils/tokenExpiry";

const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const surveyBasePath = (import.meta.env.VITE_BASE_PATH || "/").replace(/\/+$/, "") || "/";
const surveyPostLogoutUri = new URL(surveyBasePath === "/" ? "/" : `${surveyBasePath}/`, window.location.origin).toString();

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
    const run = async () => {
      const res = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await res.json();
      if (!res.ok) return;
      const roles = Array.isArray(data.roles) ? data.roles : [];
      setRole(roles.includes("B2B_ADMIN") || roles.includes("CX_SUPER_ADMIN") ? "Admin" : "Representative");
      setUserId(String(data.sub || userId));
      setUserName(data.name || userName);
      setUserEmail(data.preferred_username || userEmail);
      setStatusText(role === "Admin" ? "Admin controls enabled" : "Representative workflow enabled");
    };
    run();
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

  if (!msalReady || !isAuthenticated || !accessToken) {
    return <div className="flex min-h-screen items-center justify-center">Signing you in...</div>;
  }

  return (
    <MainLayout onLogout={handleLogout} userName={userName} userEmail={userEmail} statusText={statusText}>
      <Routes>
        <Route path="/" element={<InstallationSurveyPage headers={headers} />} />
        <Route path="/survey" element={<InstallationSurveyPage headers={headers} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </MainLayout>
  );
}
