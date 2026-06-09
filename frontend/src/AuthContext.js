import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "./api";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    try {
      const { data } = await api.get("/auth/me");
      // Keep the local "onboarding_completed" mirror in sync with the server,
      // but ONLY upgrade it (false → true). Never clear it here, otherwise a
      // race where the backend didn't persist the update yet would loop the
      // user back to /onboarding.
      if (data?.onboarding_done) {
        try {
          localStorage.setItem("onboarding_completed", "true");
        } catch (_e) {
          /* noop */
        }
      }
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // If returning from Emergent Google OAuth, AuthCallback handles session first
    if (window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const loginWithEmail = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("sl_token", data.token);
    // Sync local onboarding flag with the server truth so we never lock a
    // brand-new user out of the onboarding flow.
    if (data.user?.onboarding_done) {
      localStorage.setItem("onboarding_completed", "true");
    } else {
      localStorage.removeItem("onboarding_completed");
    }
    setUser(data.user);
    return data.user;
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    localStorage.setItem("sl_token", data.token);
    // New registrations always need onboarding — wipe any stale flag.
    localStorage.removeItem("onboarding_completed");
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch (_e) { /* noop */ }
    localStorage.removeItem("sl_token");
    localStorage.removeItem("onboarding_completed");
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, setUser, loading, loginWithEmail, register, logout, refresh: checkAuth }}>
      {children}
    </AuthCtx.Provider>
  );
}
