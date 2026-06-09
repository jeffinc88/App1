import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Brain, Mail, Lock, User as UserIcon, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "../AuthContext";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
function googleLogin() {
  const redirectUrl = window.location.origin + "/auth/callback";
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
}

export default function LoginScreen() {
  const [mode, setMode] = useState("login"); // login | register
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { loginWithEmail, register } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      let user;
      if (mode === "login") {
        user = await loginWithEmail(email, password);
      } else {
        user = await register({ email, password, name });
      }
      navigate(user?.onboarding_done ? "/app" : "/onboarding", { replace: true });
    } catch (err) {
      setError(err?.response?.data?.detail || "Algo deu errado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell grain relative" data-testid="login-screen">
      <div className="relative px-6 pt-14 pb-10 min-h-[100dvh] flex flex-col">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-2 mb-12"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F5A623] to-[#FF7B00] flex items-center justify-center shadow-[0_0_24px_rgba(245,166,35,0.35)]">
            <Brain size={22} className="text-[#090A0F]" strokeWidth={2.6} />
          </div>
          <span className="text-xl font-bold tracking-tight">StudyLoop</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h1 className="text-3xl font-bold tracking-tight leading-tight heading">
            {mode === "login" ? "Bem-vindo de volta." : "Crie sua conta."}
          </h1>
          <p className="text-slate-400 mt-2 text-[15px]">
            {mode === "login"
              ? "Continue estudando ativamente."
              : "Transforme qualquer conteúdo em prática ativa."}
          </p>
        </motion.div>

        <form onSubmit={submit} className="mt-8 space-y-3" data-testid="auth-form">
          {mode === "register" && (
            <div className="relative">
              <UserIcon size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                required
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="sl-input pl-10"
                data-testid="input-name"
              />
            </div>
          )}
          <div className="relative">
            <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="sl-input pl-10"
              data-testid="input-email"
            />
          </div>
          <div className="relative">
            <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type={show ? "text" : "password"}
              required
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="sl-input pl-10 pr-10"
              data-testid="input-password"
            />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" data-testid="toggle-password">
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && <div className="text-[#FF6B6B] text-sm pt-1" data-testid="auth-error">{error}</div>}

          <button type="submit" disabled={loading} className="sl-btn-primary mt-5 flex items-center justify-center gap-2" data-testid="submit-auth">
            {loading && <Loader2 size={18} className="animate-spin" />}
            {mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-slate-500 text-xs">
          <div className="flex-1 h-px bg-[#262A36]" />
          <span>ou</span>
          <div className="flex-1 h-px bg-[#262A36]" />
        </div>

        <button onClick={googleLogin} className="sl-btn-ghost flex items-center justify-center gap-3" data-testid="google-login">
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 5c1.6 0 3 .5 4.2 1.5l3.2-3.2C17.3 1.3 14.8.2 12 .2 7.3.2 3.2 3 1.3 7l3.7 2.9C6 7 8.8 5 12 5z"/><path fill="#34A853" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.7-2.4 3.6l3.7 2.9c2.2-2 3.5-5 3.5-8.8z"/><path fill="#FBBC04" d="M5 14c-.3-.8-.4-1.6-.4-2.5s.2-1.7.4-2.5L1.3 6.1C.5 7.8 0 9.8 0 12s.5 4.2 1.3 5.9L5 14z"/><path fill="#4285F4" d="M12 23.8c3 0 5.6-1 7.4-2.7l-3.7-2.9c-1 .7-2.4 1.1-3.7 1.1-3.2 0-5.9-2.1-6.9-5.1L1.3 17.9C3.2 21.7 7.3 23.8 12 23.8z"/></svg>
          Continuar com Google
        </button>

        <button disabled className="sl-btn-ghost flex items-center justify-center gap-3 mt-3 opacity-50" data-testid="apple-login" title="Em breve">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.41-1.09-.47-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.41C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
          Continuar com Apple <span className="text-xs text-slate-500">(em breve)</span>
        </button>

        <p className="text-center text-sm text-slate-400 mt-auto pt-6">
          {mode === "login" ? "Não tem conta? " : "Já tem conta? "}
          <button onClick={() => setMode(mode === "login" ? "register" : "login")} className="text-[#F5A623] font-semibold" data-testid="toggle-mode">
            {mode === "login" ? "Cadastre-se" : "Entrar"}
          </button>
        </p>
      </div>
    </div>
  );
}
