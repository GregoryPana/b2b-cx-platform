import { useEffect, useMemo, useState } from "react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { Navigate, Route, Routes } from "react-router-dom";
import MainLayout from "./components/layout/MainLayout";
import DashboardPage from "./pages/DashboardPage";
import PlatformSelectionPage from "./pages/PlatformSelectionPage";
import { ensureMsalInitialized, loginRequest } from "./auth";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === "true";

function resolvePlatformsFromRoles(entraRoles) {
  const isSuperAdmin = entraRoles.includes("CX_SUPER_ADMIN");
  const canAccess = (platformKey) => {
    if (isSuperAdmin) return true;
    if (platformKey === "B2B") return entraRoles.includes("B2B_ADMIN") || entraRoles.includes("B2B_SURVEYOR");
    if (platformKey === "Mystery Shopper") return entraRoles.includes("MYSTERY_ADMIN") || entraRoles.includes("MYSTERY_SURVEYOR");
    if (platformKey === "Installation Assessment") return entraRoles.includes("INSTALL_ADMIN") || entraRoles.includes("INSTALL_SURVEYOR");
    return false;
  };

  return [
    { name: "B2B", keyPoints: ["Relationship analytics", "Question trends", "Business management"] },
    { name: "Mystery Shopper", keyPoints: ["Location-level surveys", "Service quality review", "Operational trend tracking"] },
    { name: "Installation Assessment", keyPoints: ["Installation checks", "Quality scoring", "Audit traceability"] },
  ].filter((platform) => canAccess(platform.name));
}

function DashboardShell({ headers, entraRoles, userName, userEmail, activePlatform, setActivePlatform, onLogout }) {
  if (!activePlatform) {
    const availablePlatforms = resolvePlatformsFromRoles(entraRoles);
    return (
      <PlatformSelectionPage
        userName={userName}
        userEmail={userEmail}
        availablePlatforms={availablePlatforms}
        onSelectPlatform={setActivePlatform}
        onLogout={onLogout}
      />
    );
  }

  return (
    <MainLayout
      onLogout={onLogout}
      onSwitchPlatform={() => setActivePlatform("")}
      userName={userName}
      userEmail={userEmail}
      activePlatform={activePlatform}
    >
      <Routes>
        <Route path="/" element={<DashboardPage headers={headers} activePlatform={activePlatform} />} />
        <Route path="/planned" element={<DashboardPage headers={headers} activePlatform={activePlatform} />} />
        <Route path="/trends" element={<DashboardPage headers={headers} activePlatform={activePlatform} />} />
        <Route path="/review" element={<DashboardPage headers={headers} activePlatform={activePlatform} />} />
        <Route path="/surveys" element={<DashboardPage headers={headers} activePlatform={activePlatform} />} />
        <Route path="/businesses" element={<DashboardPage headers={headers} activePlatform={activePlatform} />} />
        <Route path="/locations" element={<DashboardPage headers={headers} activePlatform={activePlatform} />} />
        <Route path="/purposes" element={<DashboardPage headers={headers} activePlatform={activePlatform} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </MainLayout>
  );
}

function MsalAuthenticatedApp() {
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [msalReady, setMsalReady] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [userId, setUserId] = useState("3");
  const [role, setRole] = useState("Admin");
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [activePlatform, setActivePlatform] = useState("");
  const [entraRoles, setEntraRoles] = useState([]);

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
      setEntraRoles(roles);
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
  }, [accessToken, entraRoles, role, userId]);

  const handleLogout = () => {
    instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin });
  };

  useEffect(() => {
    if (!activePlatform) return;
    const stillAllowed = resolvePlatformsFromRoles(entraRoles).some((platform) => platform.name === activePlatform);
    if (!stillAllowed) setActivePlatform("");
  }, [activePlatform, entraRoles]);

  if (!msalReady || !isAuthenticated || !accessToken) {
    return <div className="flex min-h-screen items-center justify-center">Signing you in...</div>;
  }

  return (
    <DashboardShell
      headers={headers}
      entraRoles={entraRoles}
      userName={userName}
      userEmail={userEmail}
      activePlatform={activePlatform}
      setActivePlatform={setActivePlatform}
      onLogout={handleLogout}
    />
  );
}

function DevBypassApp() {
  const devRoles = useMemo(() => {
    const value = import.meta.env.VITE_DEV_BYPASS_ROLES || "CX_SUPER_ADMIN";
    return value
      .split(",")
      .map((role) => role.trim())
      .filter(Boolean);
  }, []);

  const [activePlatform, setActivePlatform] = useState("");
  const userId = import.meta.env.VITE_DEV_BYPASS_USER_ID || "999999";
  const userName = import.meta.env.VITE_DEV_BYPASS_NAME || "Dev Local User";
  const userEmail = import.meta.env.VITE_DEV_BYPASS_EMAIL || "dev.local@example.com";
  const role = devRoles.some((item) => item.endsWith("_ADMIN") || item === "CX_SUPER_ADMIN") ? "Admin" : "Representative";

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      "X-User-Id": userId,
      "X-User-Role": role,
      "X-Dev-Auth-Bypass": "true",
    }),
    [devRoles, role, userId]
  );

  const handleLogout = () => {
    setActivePlatform("");
  };

  return (
    <DashboardShell
      headers={headers}
      entraRoles={devRoles}
      userName={userName}
      userEmail={userEmail}
      activePlatform={activePlatform}
      setActivePlatform={setActivePlatform}
      onLogout={handleLogout}
    />
  );
}

export default function App() {
  if (DEV_AUTH_BYPASS) {
    return <DevBypassApp />;
  }
  return <MsalAuthenticatedApp />;
}
