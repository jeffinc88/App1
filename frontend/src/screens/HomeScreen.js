import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Flame, Sparkles, Zap, ArrowRight, BookOpen, Clock, TrendingUp, Plus } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../AuthContext";

export default function HomeScreen() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/home").then((r) => setData(r.data)).catch(() => {});
  }, []);

  const firstName = (user?.name || "").split(" ")[0] || "Aluno";
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  })();

  return (
    <div className="px-5 pt-10 pb-6" data-testid="home-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <p className="text-sm text-slate-400">{greeting},</p>
          <h1 className="text-2xl font-bold heading tracking-tight" data-testid="home-greeting">{firstName} 👋</h1>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-[#12141D] border border-[#262A36]" data-testid="streak-pill">
          <Flame size={18} className="text-[#F5A623] flame-glow" fill="#F5A623" />
          <span className="font-bold">{data?.user?.streak_atual ?? 0}</span>
          <span className="text-xs text-slate-400">dias</span>
        </div>
      </div>

      {/* 5 min hero card */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => navigate("/app/quiz/5min")}
        data-testid="hero-5min"
        className="w-full text-left relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-[#1A1D27] to-[#12141D] border border-[#F5A623]/25 hero-glow"
      >
        <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-gradient-to-br from-[#F5A623]/30 to-transparent blur-2xl" />
        <div className="relative flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#F5A623] flex items-center justify-center shrink-0">
            <Zap size={26} className="text-[#090A0F]" strokeWidth={2.5} fill="#090A0F" />
          </div>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.15em] text-[#F5A623] font-semibold">Modo 5 minutos</p>
            <h2 className="text-xl font-bold heading mt-1">Pratique agora</h2>
            <p className="text-slate-400 text-sm mt-1">
              {data?.questoes_disponiveis ?? 0} questões esperando por você
            </p>
            <div className="flex items-center gap-1 mt-3 text-[#F5A623] font-semibold text-sm">
              Começar <ArrowRight size={16} />
            </div>
          </div>
        </div>
      </motion.button>

      {/* AI Alert */}
      {data?.questoes_disponiveis > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="mt-5 sl-card p-4 flex items-start gap-3 border-l-2 border-l-[#F5A623]"
          data-testid="ai-alert"
        >
          <Sparkles size={20} className="text-[#F5A623] shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium">A IA está pronta para te testar</p>
            <p className="text-xs text-slate-400 mt-1">Pratique 5 minutos para manter sua sequência viva.</p>
          </div>
        </motion.div>
      )}

      {/* Continue studying */}
      {data?.last_materia && (
        <div className="mt-6">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">Continue estudando</p>
          <button
            onClick={() => navigate(`/app/materia/${data.last_materia.materia_id}`)}
            className="w-full sl-card p-4 flex items-center gap-4 text-left active:scale-[0.98] transition-transform"
            data-testid="continue-studying"
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl" style={{ background: data.last_materia.cor + "22", color: data.last_materia.cor }}>
              <BookOpen size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{data.last_materia.nome}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Última sessão: {data.last_session?.pontuacao ?? 0}% de acerto
              </p>
            </div>
            <ArrowRight size={18} className="text-slate-500" />
          </button>
        </div>
      )}

      {/* Empty state */}
      {data && data.total_materias === 0 && (
        <div className="mt-8 sl-card p-6 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#F5A623]/15 flex items-center justify-center mb-3">
            <Plus size={26} className="text-[#F5A623]" />
          </div>
          <h3 className="font-bold heading text-lg">Crie sua primeira matéria</h3>
          <p className="text-slate-400 text-sm mt-1 mb-4">Adicione um conteúdo e veja a mágica acontecer.</p>
          <button onClick={() => navigate("/app/materias")} className="sl-btn-primary" data-testid="empty-create-materia">
            Criar matéria
          </button>
        </div>
      )}

      {/* Quick stats */}
      <div className="mt-7 grid grid-cols-2 gap-3">
        <div className="sl-card p-4">
          <Clock size={18} className="text-[#F5A623] mb-2" />
          <p className="text-xs text-slate-400">Sequência máxima</p>
          <p className="font-bold text-xl heading">{data?.user?.streak_maximo ?? 0}d</p>
        </div>
        <div className="sl-card p-4">
          <TrendingUp size={18} className="text-[#4ADE80] mb-2" />
          <p className="text-xs text-slate-400">Matérias</p>
          <p className="font-bold text-xl heading">{data?.total_materias ?? 0}</p>
        </div>
      </div>
    </div>
  );
}
