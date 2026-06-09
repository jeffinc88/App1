import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "./api";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    const handle = async () => {
      const hash = window.location.hash || "";
      const m = hash.match(/session_id=([^&]+)/);
      if (!m) {
        navigate("/", { replace: true });
        return;
      }
      const session_id = m[1];
      try {
        const { data } = await api.post("/auth/google/session", { session_id });
        if (!active) return;
        // Session cookie is set by backend. Clear fragment & navigate to app.
        window.history.replaceState(null, "", window.location.pathname);
        navigate(data.user?.onboarding_done ? "/app" : "/onboarding", { replace: true, state: { user: data.user } });
        // Force a reload so AuthProvider picks up the cookie via /auth/me
        window.location.reload();
      } catch (e) {
        setError(e?.response?.data?.detail || "Erro no login Google");
      }
    };
    handle();
    return () => { active = false; };
  }, [navigate]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center text-slate-300 text-sm">
      {error ? `Erro: ${error}` : "Conectando com o Google..."}
    </div>
  );
}
