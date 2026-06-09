import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Target, Clock, Award, LogOut, Crown, ChevronRight, Trophy, Zap, BookCheck, Loader2, Check, X, Settings } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { usePaywall } from "../PaywallContext";

export default function PerfilScreen() {
  const { user, logout, refresh } = useAuth();
  const { open: openPaywall } = usePaywall();
  const [stats, setStats] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [checkout, setCheckout] = useState(null); // {state: 'polling'|'success'|'cancelled'|'failed', message?}
  const navigate = useNavigate();
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState(null);

  const openCustomerPortal = async () => {
    setPortalError(null);
    setPortalLoading(true);
    try {
      const { data } = await api.post("/plan/customer-portal", {
        origin_url: window.location.origin,
      });
      if (data.portal_url) {
        window.location.href = data.portal_url;
        return;
      }
      throw new Error("Resposta inválida do servidor");
    } catch (e) {
      const detail = e?.response?.data?.detail;
      setPortalError(typeof detail === "string" ? detail : (e.message || "Não foi possível abrir o portal."));
      setPortalLoading(false);
    }
  };

  useEffect(() => { api.get("/stats").then(r => setStats(r.data)); }, []);

  // Detect return from Stripe Checkout
  useEffect(() => {
    const ck = searchParams.get("checkout");
    const sessionId = searchParams.get("session_id");
    if (!ck) return;

    if (ck === "cancel") {
      setCheckout({ state: "cancelled" });
      const t = setTimeout(() => {
        setSearchParams({}, { replace: true });
        setCheckout(null);
      }, 2500);
      return () => clearTimeout(t);
    }

    if (ck === "success" && sessionId) {
      let attempts = 0;
      const max = 8;
      setCheckout({ state: "polling" });
      const poll = async () => {
        attempts += 1;
        try {
          const { data } = await api.get(`/plan/checkout-status/${sessionId}`);
          if (data.is_pro || data.payment_status === "paid") {
            setCheckout({ state: "success" });
            await refresh();
            const t = setTimeout(() => {
              setSearchParams({}, { replace: true });
              setCheckout(null);
            }, 1800);
            return () => clearTimeout(t);
          }
          if (data.status === "expired" || data.payment_status === "unpaid" && attempts >= max) {
            setCheckout({ state: "failed", message: "Pagamento não confirmado." });
            return;
          }
        } catch (_e) { /* retry */ }
        if (attempts < max) setTimeout(poll, 1800);
        else setCheckout({ state: "failed", message: "Tempo esgotado ao confirmar pagamento." });
      };
      poll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
      {/* Checkout return banner */}
      <AnimatePresence>
        {checkout && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className={`mb-5 sl-card p-4 flex items-center gap-3 ${checkout.state === "success" ? "border-[#4ADE80]/40" : checkout.state === "failed" ? "border-[#FF6B6B]/40" : ""}`}
            data-testid={`checkout-${checkout.state}`}
          >
            {checkout.state === "polling" && <Loader2 size={18} className="animate-spin text-[#F5A623]" />}
            {checkout.state === "success" && <div className="w-7 h-7 rounded-full bg-[#4ADE80]/20 flex items-center justify-center"><Check size={14} className="text-[#4ADE80]" strokeWidth={3} /></div>}
            {checkout.state === "cancelled" && <X size={18} className="text-slate-400" />}
            {checkout.state === "failed" && <X size={18} className="text-[#FF6B6B]" />}
            <div className="flex-1 text-sm">
              {checkout.state === "polling" && "Confirmando seu pagamento..."}
              {checkout.state === "success" && "🎉 Bem-vindo ao Pro! Tudo liberado."}
              {checkout.state === "cancelled" && "Pagamento cancelado. Sem problema, você pode tentar de novo quando quiser."}
              {checkout.state === "failed" && (checkout.message || "Não foi possível confirmar o pagamento.")}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
          onClick={() => openPaywall("manual")}
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

      {/* Gerenciar assinatura — visible only to Pro users */}
      {user?.plano === "pro" && (
        <div className="mb-3">
          <button
            onClick={openCustomerPortal}
            disabled={portalLoading}
            className="w-full sl-card p-4 flex items-center gap-3 active:scale-[0.98] transition border-[#F5A623]/30 disabled:opacity-60"
            data-testid="manage-subscription-btn"
          >
            <div className="w-10 h-10 rounded-xl bg-[#F5A623]/15 text-[#F5A623] flex items-center justify-center">
              {portalLoading ? <Loader2 size={18} className="animate-spin" /> : <Settings size={18} />}
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium">Gerenciar assinatura</p>
              <p className="text-xs text-slate-400">Cancelar, trocar cartão e ver faturas</p>
            </div>
            <ChevronRight size={18} className="text-slate-500" />
          </button>
          {portalError && (
            <p className="text-[#FF6B6B] text-xs mt-2 px-1" data-testid="manage-subscription-error">
              {portalError}
            </p>
          )}
        </div>
      )}

      {/* Admin link — visible only to admin email */}
      {(user?.email || "").toLowerCase() === "jeffinc88@gmail.com" && (
        <button onClick={() => navigate("/admin")} className="w-full sl-card p-4 flex items-center gap-3 mb-3 active:scale-[0.98] transition border-[#F5A623]/30" data-testid="open-admin">
          <div className="w-10 h-10 rounded-xl bg-[#F5A623]/15 text-[#F5A623] flex items-center justify-center"><ChevronRight size={18} /></div>
          <span className="font-medium flex-1 text-left">Painel admin</span>
          <span className="text-[10px] uppercase tracking-wider font-bold text-[#F5A623]">PRIVADO</span>
        </button>
      )}

      {/* Settings */}
      <button onClick={doLogout} className="w-full sl-card p-4 flex items-center gap-3 active:scale-[0.98] transition" data-testid="logout-btn">
        <div className="w-10 h-10 rounded-xl bg-[#FF6B6B]/15 text-[#FF6B6B] flex items-center justify-center"><LogOut size={18} /></div>
        <span className="font-medium">Sair</span>
      </button>
    </div>
  );
}
