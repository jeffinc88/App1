import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Flame, Target, Clock, Award, LogOut, Crown, ChevronRight, Trophy, Zap, BookCheck } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../AuthContext";

export default function PerfilScreen() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { api.get("/stats").then(r => setStats(r.data)); }, []);

  const doLogout = async () => { await logout(); navigate("/", { replace: true }); };

  const cards = [
    { icon: BookCheck, label: "Questões", value: stats?.total_questoes ?? 0, color: "#F5A623" },
    { icon: Target, label: "Taxa acerto", value: `${stats?.taxa_acerto ?? 0}%`, color: "#4ADE80" },
    { icon: Flame, label: "Sequência", value: `${stats?.streak_atual ?? 0}d`, color: "#FF7B00" },
    { icon: Clock, label: "Horas", value: `${stats?.total_horas ?? 0}h`, color: "#60A5FA" },
  ];

  // Heatmap: build last 18 weeks (126 days) grid
  const days = 126; // 18 weeks * 7
  const today = new Date();
  const cells = [];
  const heatmap = stats?.heatmap || {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    cells.push({ date: key, count: heatmap[key] || 0 });
  }
  const intensity = (c) => c === 0 ? 0.08 : c < 5 ? 0.3 : c < 10 ? 0.55 : c < 20 ? 0.8 : 1;

  // Achievements (computed)
  const achievements = [
    { id: "first", label: "Primeiro passo", desc: "Completou 1 sessão", icon: Zap, unlocked: (stats?.total_sessoes ?? 0) >= 1 },
    { id: "streak3", label: "Pegando ritmo", desc: "3 dias seguidos", icon: Flame, unlocked: (stats?.streak_atual ?? 0) >= 3 || (stats?.streak_maximo ?? 0) >= 3 },
    { id: "streak7", label: "Uma semana", desc: "7 dias seguidos", icon: Award, unlocked: (stats?.streak_maximo ?? 0) >= 7 },
    { id: "100q", label: "Centena", desc: "100 questões", icon: Trophy, unlocked: (stats?.total_questoes ?? 0) >= 100 },
  ];

  return (
    <div className="px-5 pt-10 pb-6" data-testid="perfil-screen">
      {/* Header */}
      <div className="flex items-center gap-4 mb-7">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#F5A623] to-[#FF7B00] flex items-center justify-center text-[#090A0F] text-2xl font-bold heading shadow-[0_0_30px_rgba(245,166,35,0.3)]">
          {user?.picture ? <img src={user.picture} alt="" className="w-full h-full rounded-2xl object-cover" /> : (user?.name?.[0]?.toUpperCase() || "?")}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold heading truncate" data-testid="perfil-nome">{user?.name}</h1>
          <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-[#F5A623]/15 text-[#F5A623]">
              {user?.plano === "pro" ? "PRO" : "FREE"}
            </span>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-7">
        {cards.map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="sl-card p-4">
              <Icon size={18} style={{ color: c.color }} className="mb-2" />
              <p className="text-xs text-slate-400">{c.label}</p>
              <p className="font-bold text-xl heading mt-0.5">{c.value}</p>
            </div>
          );
        })}
      </div>

      {/* Heatmap */}
      <div className="mb-7">
        <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">Atividade</p>
        <div className="sl-card p-4 overflow-x-auto sl-scroll">
          <div className="grid grid-rows-7 grid-flow-col gap-1" data-testid="heatmap">
            {cells.map((c) => (
              <div
                key={c.date}
                title={`${c.date}: ${c.count} questões`}
                className="w-3 h-3 rounded-[3px]"
                style={{ background: `rgba(245, 166, 35, ${intensity(c.count)})` }}
              />
            ))}
          </div>
          <div className="flex items-center justify-end gap-1 mt-3 text-[10px] text-slate-500">
            <span>menos</span>
            {[0.08, 0.3, 0.55, 0.8, 1].map((a, i) => (
              <div key={i} className="w-2.5 h-2.5 rounded-[2px]" style={{ background: `rgba(245, 166, 35, ${a})` }} />
            ))}
            <span>mais</span>
          </div>
        </div>
      </div>

      {/* Achievements */}
      <div className="mb-7">
        <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">Conquistas</p>
        <div className="grid grid-cols-2 gap-3">
          {achievements.map((a) => {
            const Icon = a.icon;
            return (
              <div key={a.id} className={`sl-card p-3.5 ${a.unlocked ? "" : "opacity-40"}`} data-testid={`ach-${a.id}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${a.unlocked ? "bg-[#F5A623]/15 text-[#F5A623]" : "bg-[#1A1D27] text-slate-500"}`}>
                  <Icon size={18} />
                </div>
                <p className="font-semibold text-sm">{a.label}</p>
                <p className="text-xs text-slate-400">{a.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upgrade card */}
      {user?.plano !== "pro" && (
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowPaywall(true)}
          data-testid="upgrade-pro"
          className="w-full text-left relative overflow-hidden rounded-2xl p-5 mb-5 bg-gradient-to-br from-[#1A1D27] to-[#12141D] border border-[#F5A623]/30"
        >
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-[#F5A623]/25 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#F5A623] text-[#090A0F] flex items-center justify-center"><Crown size={20} /></div>
            <div className="flex-1">
              <p className="font-bold heading">Vire StudyLoop Pro</p>
              <p className="text-xs text-slate-400">Tudo ilimitado. Offline. Plano IA.</p>
            </div>
            <ChevronRight size={18} className="text-[#F5A623]" />
          </div>
        </motion.button>
      )}

      {/* Settings */}
      <button onClick={doLogout} className="w-full sl-card p-4 flex items-center gap-3 active:scale-[0.98] transition" data-testid="logout-btn">
        <div className="w-10 h-10 rounded-xl bg-[#FF6B6B]/15 text-[#FF6B6B] flex items-center justify-center"><LogOut size={18} /></div>
        <span className="font-medium">Sair</span>
      </button>

      {/* Paywall modal */}
      {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} />}
    </div>
  );
}

function PaywallModal({ onClose }) {
  const benefits = [
    "Ingestão ilimitada de conteúdo",
    "Geração ilimitada de questões e flashcards",
    "Todos os modos de prática",
    "Plano de estudos com IA",
    "Modo offline completo",
    "Sem propaganda",
  ];
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} className="fixed inset-0 bg-black/80 z-40" />
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ type: "spring", damping: 30 }}
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#12141D] rounded-t-3xl z-50 p-6 border-t border-[#F5A623]/30"
        data-testid="paywall-modal"
      >
        <div className="w-10 h-1 bg-[#262A36] rounded-full mx-auto mb-5" />
        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#F5A623] to-[#FF7B00] flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(245,166,35,0.4)]">
          <Crown size={26} className="text-[#090A0F]" />
        </div>
        <h2 className="text-2xl font-bold heading text-center">StudyLoop Pro</h2>
        <p className="text-center text-slate-400 text-sm mt-1">Tudo, ilimitado.</p>

        <div className="my-5 text-center">
          <span className="text-4xl font-bold heading">R$ 29</span>
          <span className="text-slate-400">/mês</span>
        </div>

        <ul className="space-y-2.5 mb-6">
          {benefits.map((b, i) => (
            <li key={i} className="flex items-center gap-3 text-sm">
              <div className="w-5 h-5 rounded-full bg-[#4ADE80]/20 text-[#4ADE80] flex items-center justify-center text-xs">✓</div>
              {b}
            </li>
          ))}
        </ul>

        <button className="sl-btn-primary" onClick={onClose} data-testid="paywall-cta">Em breve disponível</button>
        <button onClick={onClose} className="block w-full mt-3 text-sm text-slate-400" data-testid="paywall-close">Continuar no plano gratuito</button>
      </motion.div>
    </>
  );
}
