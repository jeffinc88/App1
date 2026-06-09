import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, Clock, Target, Sparkles, ChevronRight, Check, Loader2 } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../AuthContext";

const niveis = [
  { v: "Ensino Fundamental", icon: "📘" },
  { v: "Ensino Médio", icon: "📗" },
  { v: "Vestibular / ENEM", icon: "🎯" },
  { v: "Graduação", icon: "🎓" },
  { v: "Concursos", icon: "📋" },
  { v: "Pós-graduação", icon: "🔬" },
];

const horas = [
  { v: 1, label: "Até 1h por dia" },
  { v: 2, label: "1 - 2h por dia" },
  { v: 3, label: "2 - 4h por dia" },
  { v: 5, label: "+4h por dia" },
];

const objetivos = [
  { v: "habito", label: "Criar hábito de estudo", icon: Target },
  { v: "prova", label: "Passar em uma prova", icon: GraduationCap },
  { v: "revisar", label: "Revisar conteúdo", icon: Sparkles },
];

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [nivel, setNivel] = useState(null);
  const [hora, setHora] = useState(null);
  const [obj, setObj] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { refresh, setUser } = useAuth();

  const total = 4;

  const finish = async () => {
    if (submitting) return;
    setSubmitting(true);

    // Helper: wrap any promise with a timeout so the UI never hangs forever.
    const withTimeout = (p, ms = 6000) =>
      Promise.race([
        p,
        new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
      ]);

    // 1. Try to persist onboarding on the backend (non-blocking for navigation).
    try {
      await withTimeout(
        api.post("/auth/onboarding", {
          nivel_ensino: nivel,
          horas_diarias: hora,
          objetivo: obj,
        })
      );
    } catch (e) {
      // Log but do NOT block navigation — user must reach /app no matter what.
      console.error("[onboarding] failed to persist preferences:", e);
    }

    // 2. Optimistically mark user as onboarded locally so ProtectedRoute lets us in.
    try {
      setUser((u) => (u ? { ...u, onboarding_done: true } : u));
    } catch (_e) {
      /* noop */
    }

    // 3. Best-effort refresh from server (also non-blocking, with timeout).
    try {
      await withTimeout(refresh());
    } catch (e) {
      console.error("[onboarding] refresh failed:", e);
    }

    // 4. Navigate to the main app. Try React Router first, then hard-redirect
    //    as a last-resort fallback so user is NEVER stuck on this screen.
    try {
      navigate("/app", { replace: true });
    } catch (e) {
      console.error("[onboarding] react-router navigate failed:", e);
    }

    // 5. Defensive hard redirect after a short tick if we're somehow still on /onboarding.
    setTimeout(() => {
      if (typeof window !== "undefined" && window.location.pathname.includes("/onboarding")) {
        window.location.href = "/app";
      }
    }, 400);
  };

  const canNext = (step === 1 && !nivel) || (step === 2 && !hora) || (step === 3 && !obj);

  return (
    <div className="app-shell grain" data-testid="onboarding-screen">
      <div className="px-6 pt-10 pb-8 min-h-[100dvh] flex flex-col">
        {/* progress */}
        <div className="flex gap-1.5 mb-8">
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-[#F5A623]" : "bg-[#262A36]"}`} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="flex-1"
          >
            {step === 0 && (
              <div className="h-full flex flex-col">
                <div className="mt-12 mb-8">
                  <motion.div
                    initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1, type: "spring" }}
                    className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#F5A623] to-[#FF7B00] flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(245,166,35,0.4)]"
                  >
                    <Sparkles size={36} className="text-[#090A0F]" />
                  </motion.div>
                  <h1 className="text-3xl font-bold heading leading-tight">Estudar não é só ler.</h1>
                  <p className="text-slate-400 mt-3 text-[15px] leading-relaxed">
                    O StudyLoop transforma qualquer conteúdo — texto, PDF, foto ou link — em quizzes e flashcards inteligentes.
                    Você pratica, e o app aprende com você.
                  </p>
                </div>
                <ul className="space-y-3 mt-6">
                  {[
                    "📸 Tire foto da página, vire um quiz",
                    "🧠 IA gera questões reais a partir do conteúdo",
                    "🔥 Streak diário + repetição espaçada",
                  ].map((t, i) => (
                    <li key={i} className="flex items-center gap-3 text-slate-300 sl-card p-3.5">
                      <span className="text-xl">{t.split(" ")[0]}</span>
                      <span className="text-sm">{t.split(" ").slice(1).join(" ")}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {step === 1 && (
              <div>
                <h2 className="text-2xl font-bold heading">Qual seu nível de estudo?</h2>
                <p className="text-slate-400 mt-1 mb-6 text-sm">Ajuda a IA a calibrar a dificuldade.</p>
                <div className="grid grid-cols-2 gap-3">
                  {niveis.map((n) => (
                    <button
                      key={n.v}
                      onClick={() => setNivel(n.v)}
                      data-testid={`nivel-${n.v}`}
                      className={`sl-card p-4 text-left flex flex-col gap-2 transition-all active:scale-95 ${nivel === n.v ? "border-[#F5A623] shadow-[0_0_0_3px_rgba(245,166,35,0.15)]" : ""}`}
                    >
                      <span className="text-2xl">{n.icon}</span>
                      <span className="text-sm font-medium">{n.v}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 className="text-2xl font-bold heading">Quantas horas você quer estudar?</h2>
                <p className="text-slate-400 mt-1 mb-6 text-sm">Vamos planejar lembretes e sessões.</p>
                <div className="space-y-3">
                  {horas.map((h) => (
                    <button
                      key={h.v}
                      onClick={() => setHora(h.v)}
                      data-testid={`hora-${h.v}`}
                      className={`sl-card w-full p-4 flex items-center justify-between transition-all active:scale-[0.98] ${hora === h.v ? "border-[#F5A623]" : ""}`}
                    >
                      <span className="flex items-center gap-3"><Clock size={18} className="text-[#F5A623]" /> <span className="font-medium">{h.label}</span></span>
                      {hora === h.v && <Check size={18} className="text-[#F5A623]" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <h2 className="text-2xl font-bold heading">Qual seu objetivo principal?</h2>
                <p className="text-slate-400 mt-1 mb-6 text-sm">Escolha o que mais combina com você.</p>
                <div className="space-y-3">
                  {objetivos.map((o) => {
                    const Icon = o.icon;
                    return (
                      <button
                        key={o.v}
                        onClick={() => setObj(o.v)}
                        data-testid={`obj-${o.v}`}
                        className={`sl-card w-full p-4 flex items-center gap-3 transition-all active:scale-[0.98] ${obj === o.v ? "border-[#F5A623]" : ""}`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${obj === o.v ? "bg-[#F5A623]/15 text-[#F5A623]" : "bg-[#1A1D27] text-slate-400"}`}>
                          <Icon size={20} />
                        </div>
                        <span className="font-medium">{o.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-6">
          <button
            onClick={() => (step < total - 1 ? setStep(step + 1) : finish())}
            disabled={canNext || submitting}
            data-testid="onboarding-next"
            className="sl-btn-primary flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Entrando...
              </>
            ) : (
              <>
                {step === total - 1 ? "Começar a estudar" : "Continuar"}
                <ChevronRight size={18} />
              </>
            )}
          </button>
          {step > 0 && !submitting && (
            <button onClick={() => setStep(step - 1)} className="block mx-auto text-sm text-slate-400 mt-3" data-testid="onboarding-back">
              Voltar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
