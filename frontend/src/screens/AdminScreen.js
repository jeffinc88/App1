import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, RefreshCw, Users, UserCheck, TrendingUp, Star, BarChart3, Crown, DollarSign,
  Loader2, Activity, Smile, Meh, Frown
} from "lucide-react";
import { api } from "../api";
import { useAuth } from "../AuthContext";

const ADMIN_EMAIL = "jeffinc88@gmail.com";

export default function AdminScreen() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMetrics = useCallback(async () => {
    try {
      const r = await api.get("/admin/metrics");
      setData(r.data);
      setError(null);
    } catch (e) {
      setError(e?.response?.status === 403 ? "Acesso restrito" : (e?.response?.data?.detail || "Erro ao carregar métricas"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/", { replace: true }); return; }
    if ((user.email || "").toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      navigate("/app", { replace: true });
      return;
    }
    fetchMetrics();
    // Auto-refresh every 30s
    const iv = setInterval(() => { setRefreshing(true); fetchMetrics(); }, 30000);
    return () => clearInterval(iv);
  }, [authLoading, user, navigate, fetchMetrics]);

  const triggerRefresh = () => { setRefreshing(true); fetchMetrics(); };

  if (authLoading || loading) {
    return (
      <div className="min-h-[100dvh] bg-[#090A0F] flex items-center justify-center text-slate-400">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#090A0F] text-slate-100" data-testid="admin-screen">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/app")} className="text-slate-400 hover:text-white" data-testid="admin-back">
              <ArrowLeft size={22} />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold heading flex items-center gap-3">
                Admin <span className="text-[10px] uppercase tracking-[0.18em] bg-[#F5A623]/15 text-[#F5A623] px-2 py-1 rounded-full font-bold">painel privado</span>
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                {data?.generated_at ? `Atualizado ${new Date(data.generated_at).toLocaleString("pt-BR")}` : ""}
              </p>
            </div>
          </div>
          <button onClick={triggerRefresh} disabled={refreshing} className="sl-card px-3.5 py-2.5 flex items-center gap-2 text-sm hover:border-[#F5A623]/40 transition" data-testid="admin-refresh">
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>

        {error && <div className="sl-card p-4 text-[#FF6B6B]" data-testid="admin-error">{error}</div>}

        {data && (
          <div className="space-y-8">
            <Section title="Usuários" icon={Users}>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Metric label="Total cadastrados" value={data.users.total} icon={Users} color="#F5A623" testid="m-total-users" />
                <Metric label="Ativos (últimos 7 dias)" value={data.users.ativos_7d} icon={UserCheck} color="#4ADE80" testid="m-ativos-7d" />
              </div>
            </Section>

            <Section title="Ativação e Retenção" icon={TrendingUp}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <BigMetric
                  label="Ativação D7"
                  value={`${data.ativacao_retencao.ativacao_d7_pct}%`}
                  sub={`${data.ativacao_retencao.ativacao_d7_activated} de ${data.ativacao_retencao.ativacao_d7_cohort} usuários completaram ≥1 sessão nos primeiros 7 dias`}
                  color="#F5A623"
                  testid="m-ativacao-d7"
                />
                <BigMetric
                  label="Retenção D30"
                  value={`${data.ativacao_retencao.retencao_d30_pct}%`}
                  sub={`${data.ativacao_retencao.retencao_d30_retained} de ${data.ativacao_retencao.retencao_d30_cohort} usuários +30d retornaram na última semana`}
                  color="#4ADE80"
                  testid="m-retencao-d30"
                />
              </div>
            </Section>

            <Section title="Qualidade da IA" icon={Star}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="sl-card p-5" data-testid="m-ia-media">
                  <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Avaliação média das questões</p>
                  <div className="flex items-end gap-2 mt-3">
                    <span className="text-5xl font-bold heading text-[#F5A623]">{data.ia_qualidade.media_estrelas.toFixed(1)}</span>
                    <span className="text-slate-400 mb-1.5">/ 5.0</span>
                  </div>
                  <Stars value={data.ia_qualidade.media_estrelas} />
                </div>
                <Metric label="Total de avaliações coletadas" value={data.ia_qualidade.total_avaliacoes} icon={BarChart3} color="#60A5FA" testid="m-ia-total" />
              </div>
            </Section>

            <Section title="NPS" icon={Activity}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div className="sl-card p-5 lg:col-span-1" data-testid="m-nps-score">
                  <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Score NPS</p>
                  <div className="flex items-end gap-2 mt-3">
                    <span className="text-5xl font-bold heading" style={{ color: data.nps.score >= 50 ? "#4ADE80" : data.nps.score >= 0 ? "#FBBF24" : "#FF6B6B" }}>
                      {data.nps.score}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">{data.nps.total_respostas} respostas recebidas</p>
                </div>
                <NpsBlock label="Promotores" value={data.nps.promotores} sub="9-10" color="#4ADE80" icon={Smile} testid="m-nps-promo" />
                <NpsBlock label="Neutros" value={data.nps.neutros} sub="7-8" color="#FBBF24" icon={Meh} testid="m-nps-neutro" />
                <NpsBlock label="Detratores" value={data.nps.detratores} sub="0-6" color="#FF6B6B" icon={Frown} testid="m-nps-detr" />
              </div>
            </Section>

            <Section title="Monetização" icon={DollarSign}>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Metric label="Usuários Pro ativos" value={data.monetizacao.total_pro} icon={Crown} color="#F5A623" testid="m-mon-pro" />
                <Metric label="Paywalls exibidos" value={data.monetizacao.paywall_shown_count} icon={BarChart3} color="#60A5FA" testid="m-mon-shown" />
                <Metric label="Usuários que viram (únicos)" value={data.monetizacao.paywall_unique_shown_users} icon={Users} color="#A78BFA" testid="m-mon-unique-shown" />
                <Metric label="CTR do paywall" value={`${data.monetizacao.paywall_ctr_pct}%`} icon={TrendingUp} color="#4ADE80" testid="m-mon-ctr" />
              </div>

              <div className="mt-5 sl-card p-0 overflow-hidden">
                <div className="px-5 py-4 border-b border-[#262A36] flex items-center justify-between">
                  <p className="font-semibold heading">Assinantes Pro</p>
                  <span className="text-xs text-slate-500">{data.monetizacao.pro_users.length} registros</span>
                </div>
                {data.monetizacao.pro_users.length === 0 ? (
                  <div className="p-5 text-center text-slate-500 text-sm">Nenhum assinante ainda.</div>
                ) : (
                  <div className="divide-y divide-[#262A36]" data-testid="pro-users-list">
                    {data.monetizacao.pro_users.map((u) => (
                      <div key={u.user_id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-white/[0.02] transition" data-testid={`pro-row-${u.user_id}`}>
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#F5A623] to-[#FF7B00] flex items-center justify-center text-[#090A0F] font-bold text-sm shrink-0">
                          {u.picture ? <img src={u.picture} alt="" className="w-full h-full rounded-xl object-cover" /> : (u.name?.[0]?.toUpperCase() || "?")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{u.name}</p>
                          <p className="text-xs text-slate-400 truncate">{u.email}</p>
                        </div>
                        <div className="text-xs text-slate-500 shrink-0 text-right">
                          <p>Desde</p>
                          <p>{u.pro_since ? new Date(u.pro_since).toLocaleDateString("pt-BR") : "—"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Section>

            <div className="text-center text-xs text-slate-600 pt-2 pb-6">StudyLoop · painel admin · atualiza a cada 30s</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <section>
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.15em] text-slate-400 mb-3">
        <Icon size={14} className="text-[#F5A623]" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Metric({ label, value, icon: Icon, color, testid }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="sl-card p-4 flex items-start gap-3"
      data-testid={testid}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: color + "22", color }}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="font-bold text-2xl heading mt-0.5 truncate">{value}</p>
      </div>
    </motion.div>
  );
}

function BigMetric({ label, value, sub, color, testid }) {
  return (
    <div className="sl-card p-5 relative overflow-hidden" data-testid={testid}>
      <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl" style={{ background: color + "20" }} />
      <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold relative">{label}</p>
      <p className="text-5xl font-bold heading mt-3 relative" style={{ color }}>{value}</p>
      <p className="text-xs text-slate-400 mt-2 relative">{sub}</p>
    </div>
  );
}

function NpsBlock({ label, value, sub, color, icon: Icon, testid }) {
  return (
    <div className="sl-card p-4" data-testid={testid}>
      <div className="flex items-center gap-2">
        <Icon size={16} style={{ color }} />
        <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{label}</p>
      </div>
      <p className="text-3xl font-bold heading mt-2" style={{ color }}>{value}</p>
      <p className="text-[11px] text-slate-500 mt-1">Notas {sub}</p>
    </div>
  );
}

function Stars({ value }) {
  // 5 SVG stars, partially filled
  return (
    <div className="flex items-center gap-1 mt-2">
      {[1, 2, 3, 4, 5].map((n) => {
        const fillPct = Math.max(0, Math.min(1, value - (n - 1))) * 100;
        return (
          <div key={n} className="relative w-5 h-5">
            <svg viewBox="0 0 24 24" className="absolute inset-0" fill="none" stroke="#262A36" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <div className="absolute inset-0 overflow-hidden" style={{ width: `${fillPct}%` }}>
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#F5A623" stroke="#F5A623" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
          </div>
        );
      })}
    </div>
  );
}
