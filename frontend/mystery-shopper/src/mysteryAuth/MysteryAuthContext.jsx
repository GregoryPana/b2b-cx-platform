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
    const timedOut = error?.name === "AbortError";
    // status 0 = the request never reached the server (offline, VPN down, DNS, blocked).
    return { res: { ok: false, status: timedOut ? 408 : 0 }, data: null };
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
}

const VALIDATION_MESSAGES = {
  password: "Your password must be at least 8 characters long.",
  code: "Enter the 6-digit code shown in your authenticator app.",
  email: "Enter a valid email address.",
  enrollment_token: "This enrollment link looks incomplete. Please copy the whole link from the email.",
  recovery_code: "Enter one of your recovery codes exactly as it was shown.",
  challenge: "Your sign-in session timed out. Please enter your email and password again.",
};

// Turn any failed response into a message a shopper can act on.
export function friendlyError(res, data, fallback) {
  const status = res?.status;
  if (status === 0) {
    return "We couldn't reach the server. Check your internet connection and make sure you are connected to the company VPN, then try again.";
  }
  if (status === 408) return "The server took too long to respond. Please try again in a moment.";
  if (status === 422) {
    const items = Array.isArray(data?.detail) ? data.detail : [];
    const messages = items
      .map((item) => VALIDATION_MESSAGES[item?.loc?.[item.loc.length - 1]])
      .filter(Boolean);
    return [...new Set(messages)].join(" ") || "Some of the details you entered aren't valid. Please check them and try again.";
  }
  if (status === 429) return "Too many attempts. Please wait a few minutes and try again.";
  if (status === 502 || status === 503 || status === 504) {
    return typeof data?.detail === "string" && data.detail
      ? data.detail
      : "The service is temporarily unavailable. Please try again in a few minutes.";
  }
  if (status >= 500) {
    return "Something went wrong on our side. Please try again. If it keeps happening, contact your administrator and tell them the time it happened.";
  }
  if (typeof data?.detail === "string" && data.detail) return data.detail;
  return fallback;
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
      setError(friendlyError(res, data, "We couldn't open your enrollment page. Please try again or ask your administrator for a new link."));
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
      const message = friendlyError(res, data, "We couldn't finish your enrollment. Please check your details and try again.");
      setError(message);
      return { ok: false, data: null, message };
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
      setError(
        res.status === 401
          ? "That email and recovery code don't match our records, or the code has already been used. Each recovery code works only once. If you have no unused codes left, ask your administrator to reset your access."
          : friendlyError(res, data, "Recovery failed. Please try again."),
      );
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
      setError(
        res.status === 401
          ? "Sign-in failed. Check your email and password and try again. If you have not finished enrolling, use the link from your invitation email. After several wrong attempts your account is locked for a few minutes."
          : friendlyError(res, data, "Sign-in failed. Please try again."),
      );
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
      setError(friendlyError(res, data, "We couldn't verify that code. Please try again."));
      if (res.status === 401 && data?.detail === VALIDATION_MESSAGES.challenge) {
        // The password step timed out: send the user back to enter email + password again.
        setMfaPending(false);
        setChallenge("");
      }
      return { ok: false };
    }
    setMfaPending(false);
    setChallenge("");
    await refreshSession();
    return { ok: true };
  }, [challenge, refreshSession]);

  const cancelMfa = useCallback(() => {
    setError("");
    setMfaPending(false);
    setChallenge("");
  }, []);

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
    cancelMfa,
    setError,
    logout,
    startEnrollment,
    confirmEnrollment,
    useRecoveryCode,
    loading,
    error,
    mfaPending,
    refreshSession,
  }), [user, login, submitMfa, cancelMfa, logout, startEnrollment, confirmEnrollment, useRecoveryCode, loading, error, mfaPending, refreshSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useMysteryAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useMysteryAuth must be used within MysteryAuthProvider");
  }
  return value;
}
