import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Check, Loader2, X, FileText, Camera, Sparkles, Infinity as InfinityIcon, ShieldCheck, Trophy } from "lucide-react";
import { api } from "../api";

const BENEFITS = [
  { icon: InfinityIcon, text: "Fontes ilimitadas" },
  { icon: InfinityIcon, text: "Sessões de quiz ilimitadas" },
  { icon: Camera, text: "Foto e PDF liberados" },
  { icon: Sparkles, text: "Plano de estudo com IA" },
  { icon: FileText, text: "Histórico completo" },
  { icon: Trophy, text: "Conquistas Pro exclusivas" },
  { icon: ShieldCheck, text: "Suporte prioritário" },
];

const MOTIVO_HEADLINE = {
  fonte_limite: "Você atingiu o limite de fontes",
  sessao_limite: "Você atingiu o limite de sessões deste mês",
  foto_pdf: "Foto e PDF são exclusivos do Pro",
  default: null,
};

const MOTIVO_SUBHEAD = {
  fonte_limite: "No plano gratuito você pode ter até 3 fontes ativas.",
  sessao_limite: "No plano gratuito você tem 5 sessões por mês. Faça upgrade para continuar.",
  foto_pdf: "Plano gratuito gera quiz de texto e link. Pro libera foto e PDF.",
  default: null,
};

/**
 * Reusable Paywall modal.
 * Props:
 * - open: boolean
 * - motivo: 'fonte_limite' | 'sessao_limite' | 'foto_pdf' | null
 * - onClose: () => void
 * - onUpgraded: (user) => void  (called when upgrade succeeds)
 */
export default function PaywallModal({ open, motivo = null, onClose, onUpgraded }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  // Track paywall_shown when opened
  useEffect(() => {
    if (open) {
      api.post("/analytics/event", {
        name: "paywall_shown",
        props: { motivo: motivo || "manual" },
      }).catch(() => {});
      setSuccess(false);
      setError(null);
    }
  }, [open, motivo]);

  const upgrade = async () => {
    setError(null);
    // Track CTA tap BEFORE attempting upgrade (per spec: "sempre que o botão for tocado, mesmo sem pagamento concluído")
    api.post("/analytics/event", {
      name: "paywall_cta_tapped",
      props: { motivo: motivo || "manual" },
    }).catch(() => {});
    setLoading(true);
    try {
      const { data } = await api.post("/plan/upgrade", {
        origin_url: window.location.origin,
      });
      // If user is already Pro (e.g. via webhook before this click), close & refresh
      if (data.already_pro) {
        onUpgraded?.();
        onClose();
        return;
      }
      if (data.checkout_url) {
        // Redirect to Stripe Checkout — Stripe will redirect back to /app/perfil?checkout=success&session_id=...
        window.location.href = data.checkout_url;
        return;
      }
      throw new Error("Resposta inválida do servidor");
    } catch (e) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : (detail?.motivo || e.message || "Não foi possível iniciar o checkout."));
    } finally {
      setLoading(false);
    }
  };

  const headline = MOTIVO_HEADLINE[motivo] || MOTIVO_HEADLINE.default;
  const subhead = MOTIVO_SUBHEAD[motivo] || MOTIVO_SUBHEAD.default;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
            className="fixed inset-0 bg-black/85 z-[55]" />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            style={{ x: "-50%" }}
            className="fixed bottom-0 left-1/2 w-full max-w-md bg-[#12141D] rounded-t-3xl z-[60] p-6 border-t border-[#F5A623]/30 max-h-[94dvh] overflow-y-auto sl-scroll"
            data-testid="paywall-modal"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="w-10 h-1 bg-[#262A36] rounded-full mx-auto" />
              <button onClick={onClose} className="text-slate-400 p-1 absolute right-5 top-5" data-testid="paywall-x" aria-label="Fechar">
                <X size={20} />
              </button>
            </div>

            {success ? (
              <div className="py-10 text-center" data-testid="paywall-success">
                <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring" }}
                  className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-[#F5A623] to-[#FF7B00] flex items-center justify-center mb-4 shadow-[0_0_40px_rgba(245,166,35,0.5)]">
                  <Crown size={36} className="text-[#090A0F]" />
                </motion.div>
                <h2 className="text-2xl font-bold heading">Bem-vindo ao Pro! 🎉</h2>
                <p className="text-slate-400 text-sm mt-2">Todos os limites foram removidos. Bons estudos!</p>
              </div>
            ) : (
              <>
                <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#F5A623] to-[#FF7B00] flex items-center justify-center mt-3 mb-4 shadow-[0_0_30px_rgba(245,166,35,0.4)]">
                  <Crown size={26} className="text-[#090A0F]" />
                </div>
                <h2 className="text-2xl font-bold heading text-center">StudyLoop Pro</h2>
                <p className="text-center text-slate-400 text-sm mt-1">Estude sem limites</p>

                {headline && (
                  <div className="mt-4 mb-1 p-3 rounded-xl bg-[#F5A623]/10 border border-[#F5A623]/20 text-center" data-testid="paywall-motivo">
                    <p className="text-sm font-semibold text-[#F5A623]">{headline}</p>
                    {subhead && <p className="text-xs text-slate-300 mt-1">{subhead}</p>}
                  </div>
                )}

                <div className="my-5 text-center">
                  <span className="text-4xl font-bold heading">R$ 29</span>
                  <span className="text-slate-400">/mês</span>
                  <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mt-1">renovação automática · cancele quando quiser</p>
                </div>

                <ul className="space-y-2.5 mb-6">
                  {BENEFITS.map((b, i) => {
                    const Icon = b.icon;
                    return (
                      <li key={i} className="flex items-center gap-3 text-sm" data-testid={`benefit-${i}`}>
                        <div className="w-7 h-7 rounded-full bg-[#4ADE80]/15 text-[#4ADE80] flex items-center justify-center">
                          <Check size={14} strokeWidth={3} />
                        </div>
                        <Icon size={16} className="text-slate-400" />
                        <span>{b.text}</span>
                      </li>
                    );
                  })}
                </ul>

                {error && <p className="text-[#FF6B6B] text-sm mb-3" data-testid="paywall-error">{error}</p>}

                <button onClick={upgrade} disabled={loading} className="sl-btn-primary flex items-center justify-center gap-2" data-testid="paywall-cta">
                  {loading && <Loader2 size={18} className="animate-spin" />}
                  {loading ? "Processando..." : "Fazer upgrade para Pro"}
                </button>
                <button onClick={onClose} className="block w-full mt-3 text-sm text-slate-400 hover:text-slate-200" data-testid="paywall-continue-free">
                  Continuar no gratuito
                </button>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
