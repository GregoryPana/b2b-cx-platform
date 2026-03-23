import { useEffect, useMemo, useState } from "react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { Navigate, Route, Routes } from "react-router-dom";
import MainLayout from "./components/layout/MainLayout";
import DashboardPage from "./pages/DashboardPage";
import { ensureMsalInitialized, loginRequest } from "./auth";

const API_BASE = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8001`;

export default function App() {
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [msalReady, setMsalReady] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [userId, setUserId] = useState("3");
  const [role, setRole] = useState("Admin");
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [activePlatform, setActivePlatform] = useState("");

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
    setUserId(String(claims.sub || claims.oid || "3"));
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
      setRole(roles.some((item) => item.endsWith("_ADMIN") || item === "CX_SUPER_ADMIN") ? "Admin" : "Representative");
      setUserId(String(data.sub || userId));
      setUserName(data.name || userName);
      setUserEmail(data.preferred_username || userEmail);
    };
    run();
  }, [accessToken, userEmail, userId, userName]);

  const headers = useMemo(() => {
    const next = {
      "Content-Type": "application/json",
      "X-User-Id": userId,
      "X-User-Role": role,
    };
    if (accessToken) next.Authorization = `Bearer ${accessToken}`;
    return next;
  }, [accessToken, role, userId]);

  const handleLogout = () => {
    instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin });
  };

  if (!msalReady || !isAuthenticated || !accessToken) {
    return <div className="flex min-h-screen items-center justify-center">Signing you in...</div>;
  }

  return (
    <MainLayout onLogout={handleLogout} userName={userName} userEmail={userEmail}>
      <Routes>
        <Route path="/" element={<DashboardPage headers={headers} activePlatform={activePlatform} setActivePlatform={setActivePlatform} />} />
        <Route path="/trends" element={<DashboardPage headers={headers} activePlatform={activePlatform} setActivePlatform={setActivePlatform} />} />
        <Route path="/review" element={<DashboardPage headers={headers} activePlatform={activePlatform} setActivePlatform={setActivePlatform} />} />
        <Route path="/businesses" element={<DashboardPage headers={headers} activePlatform={activePlatform} setActivePlatform={setActivePlatform} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </MainLayout>
  );
}
