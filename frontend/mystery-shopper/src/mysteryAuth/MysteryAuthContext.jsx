import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);

const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

async function fetchJsonSafe(url, options = {}, timeout = 30000) {
  const controller = timeout > 0 ? new AbortController() : null;
  const timeoutId = timeout > 0 ? window.setTimeout(() => controller.abort(), timeout) : null;
  try {
    const response = await fetch(url, {
      credentials: "include",
      ...options,
      ...(controller ? { signal: controller.signal } : {}),
    });
    const text = await response.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    return { res: response, data };
  } catch (error) {
    return { res: { ok: false, status: error?.name === "AbortError" ? 408 : 500 }, data: { detail: error?.message || "Request failed" } };
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
}

export function MysteryAuthProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [mfaPending, setMfaPending] = useState(false);
  const [challenge, setChallenge] = useState("");

  const startEnrollment = useCallback(async (enrollmentToken) => {
    setError("");
    const { res, data } = await fetchJsonSafe(`${API_BASE}/auth/enroll/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enrollment_token: enrollmentToken }),
    });
    if (!res.ok) {
      setError(data?.detail || "Enrollment could not be started");
      return { ok: false, data: null };
    }
    return { ok: true, data };
  }, []);

  const confirmEnrollment = useCallback(async (enrollmentToken, password, code) => {
    setError("");
    const { res, data } = await fetchJsonSafe(`${API_BASE}/auth/enroll/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enrollment_token: enrollmentToken, password, code }),
    });
    if (!res.ok) {
      setError(data?.detail || "Enrollment confirmation failed");
      return { ok: false, data: null };
    }
    return { ok: true, data };
  }, []);

  const useRecoveryCode = useCallback(async (email, recoveryCode) => {
    setError("");
    const { res, data } = await fetchJsonSafe(`${API_BASE}/auth/recovery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, recovery_code: recoveryCode }),
    });
    if (!res.ok) {
      setError(data?.detail || "Recovery failed");
      return { ok: false, data: null };
    }
    return { ok: true, data };
  }, []);

  const refreshSession = useCallback(async () => {
    setLoading(true);
    try {
      const { res, data } = await fetchJsonSafe(`${API_BASE}/auth/session`);
      if (res.ok) {
        setUser(data || null);
        setError("");
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = useCallback(async (email, password) => {
    setError("");
    const { res, data } = await fetchJsonSafe(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      setError(data?.detail || "Login failed");
      return { ok: false };
    }
    setChallenge(data?.challenge || "");
    setMfaPending(true);
    return { ok: true };
  }, []);

  const submitMfa = useCallback(async (code) => {
    setError("");
    const { res, data } = await fetchJsonSafe(`${API_BASE}/auth/mfa`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challenge, code }),
    });
    if (!res.ok) {
      setError(data?.detail || "Verification failed");
      return { ok: false };
    }
    setMfaPending(false);
    setChallenge("");
    await refreshSession();
    return { ok: true };
  }, [challenge, refreshSession]);

  const logout = useCallback(async () => {
    await fetchJsonSafe(`${API_BASE}/auth/logout`, { method: "POST" });
    setUser(null);
    setMfaPending(false);
    setChallenge("");
  }, []);

  const value = useMemo(() => ({
    isAuthenticated: Boolean(user),
    user,
    login,
    submitMfa,
    logout,
    startEnrollment,
    confirmEnrollment,
    useRecoveryCode,
    loading,
    error,
    mfaPending,
    refreshSession,
  }), [user, login, submitMfa, logout, startEnrollment, confirmEnrollment, useRecoveryCode, loading, error, mfaPending, refreshSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useMysteryAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useMysteryAuth must be used within MysteryAuthProvider");
  }
  return value;
}
