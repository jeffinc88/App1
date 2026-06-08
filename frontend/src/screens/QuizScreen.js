import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, X, ChevronRight, Trophy, Sparkles, Loader2 } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import ShareButton from "../components/ShareButton";

export default function QuizScreen() {
  const { mode, id } = useParams(); // mode = "5min" | "materia"
  const navigate = useNavigate();
  const { user } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [materiaName, setMateriaName] = useState("");
  const [streak, setStreak] = useState(0);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [shake, setShake] = useState(false);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const load = async () => {
      try {
        let r;
        if (mode === "5min") r = await api.get("/questoes/5min");
        else r = await api.get("/questoes", { params: { materia_id: id, limit: 10 } });
        setQuestions(r.data);
        // also load materia name + current streak for share card
        if (mode === "materia" && id) {
          try {
            const ms = await api.get("/materias");
            const m = ms.data.find((x) => x.materia_id === id);
            if (m) setMateriaName(m.nome);
          } catch (_e) { /* noop */ }
        } else {
          setMateriaName("Modo 5 minutos");
        }
        try {
          const s = await api.get("/stats");
          setStreak(s.data?.streak_atual || 0);
        } catch (_e) { /* noop */ }
      } finally { setLoading(false); }
    };
    load();
  }, [mode, id]);

  if (loading) {
    return <div className="px-5 pt-20 text-center text-slate-400"><Loader2 className="mx-auto animate-spin" /> Preparando suas questões...</div>;
  }

  if (!questions.length) {
    return (
      <div className="px-5 pt-12 text-center">
        <Sparkles size={28} className="text-[#F5A623] mx-auto mb-3" />
        <h2 className="font-bold heading text-xl">Nenhuma questão ainda</h2>
        <p className="text-slate-400 text-sm mt-2 mb-6">Adicione conteúdo em uma matéria para gerar questões.</p>
        <button onClick={() => navigate("/app/materias")} className="sl-btn-primary" data-testid="goto-materias">Ir para matérias</button>
      </div>
    );
  }

  const q = questions[idx];
  const isCorrect = selected === q.resposta_correta;

  const confirm = () => {
    if (selected === null) return;
    setConfirmed(true);
    if (selected === q.resposta_correta) {
      setCorrectCount((c) => c + 1);
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  const next = async () => {
    if (idx + 1 < questions.length) {
      setIdx(idx + 1); setSelected(null); setConfirmed(false);
    } else {
      const duration = Math.round((Date.now() - startRef.current) / 1000);
      try {
        await api.post("/sessoes", {
          materia_id: mode === "materia" ? id : null,
          tipo: mode === "5min" ? "5min" : "quiz",
          total_questoes: questions.length,
          acertos: correctCount + (isCorrect && confirmed ? 0 : 0), // already counted above
          duracao_segundos: duration,
        });
      } catch {}
      setDone(true);
    }
  };

  if (done) {
    const pct = Math.round((correctCount / questions.length) * 100);
    return (
      <div className="px-5 pt-20 text-center" data-testid="quiz-done">
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring" }}
          className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-[#F5A623] to-[#FF7B00] flex items-center justify-center mb-5 shadow-[0_0_40px_rgba(245,166,35,0.5)]">
          <Trophy size={42} className="text-[#090A0F]" />
        </motion.div>
        <h2 className="text-3xl font-bold heading">Sessão completa!</h2>
        <p className="text-slate-400 mt-2 mb-8">Você acertou <span className="text-[#F5A623] font-bold">{correctCount} de {questions.length}</span> ({pct}%)</p>
        <button onClick={() => navigate("/app")} className="sl-btn-primary" data-testid="quiz-finish">Continuar</button>
        <ShareButton
          tipo="quiz"
          title="Sessão completa!"
          materia={materiaName}
          acertos={correctCount}
          total={questions.length}
          streak={streak}
          username={user?.name}
        />
        <button onClick={() => window.location.reload()} className="sl-btn-ghost mt-3" data-testid="quiz-again">Praticar novamente</button>
      </div>
    );
  }

  return (
    <div className="px-5 pt-10 pb-6" data-testid="quiz-screen">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate(-1)} className="text-slate-300" data-testid="quiz-back"><ArrowLeft size={22} /></button>
        <span className="text-xs text-slate-400">{idx + 1} / {questions.length}</span>
      </div>

      <div className="flex gap-1.5 mb-6">
        {questions.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i < idx ? "bg-[#F5A623]" : i === idx ? "bg-[#F5A623]/60" : "bg-[#262A36]"}`} />
        ))}
      </div>

      <motion.div
        key={idx}
        initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}
        className={`sl-card p-5 ${shake ? "shake-x" : ""}`}
      >
        <p className="text-base leading-relaxed font-medium">{q.enunciado}</p>
      </motion.div>

      <div className="mt-5 space-y-2.5">
        {q.opcoes.map((opt, i) => {
          let cls = "sl-card p-4 w-full text-left transition-all active:scale-[0.99]";
          if (confirmed) {
            if (i === q.resposta_correta) cls += " !border-[#4ADE80] bg-[#4ADE80]/10";
            else if (i === selected) cls += " !border-[#FF6B6B] bg-[#FF6B6B]/10";
          } else if (selected === i) cls += " !border-[#F5A623]";
          return (
            <button
              key={i}
              disabled={confirmed}
              onClick={() => setSelected(i)}
              className={cls}
              data-testid={`option-${i}`}
            >
              <span className="flex items-center gap-3">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${confirmed && i === q.resposta_correta ? "bg-[#4ADE80] text-[#090A0F]" : confirmed && i === selected ? "bg-[#FF6B6B] text-white" : selected === i ? "bg-[#F5A623] text-[#090A0F]" : "bg-[#1A1D27] text-slate-400"}`}>
                  {confirmed && i === q.resposta_correta ? <Check size={14} /> : confirmed && i === selected ? <X size={14} /> : String.fromCharCode(65 + i)}
                </span>
                <span className="text-sm flex-1">{opt}</span>
              </span>
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {confirmed && q.explicacao && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="mt-4 sl-card p-4 border-l-2 !border-l-[#F5A623]"
            data-testid="quiz-explanation"
          >
            <p className="text-xs uppercase tracking-wider text-[#F5A623] font-bold mb-1">{isCorrect ? "Boa! 🎯" : "Quase lá"}</p>
            <p className="text-sm text-slate-300 leading-relaxed">{q.explicacao}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-6">
        {!confirmed ? (
          <button onClick={confirm} disabled={selected === null} className="sl-btn-primary" data-testid="quiz-confirm">Confirmar</button>
        ) : (
          <button onClick={next} className="sl-btn-primary flex items-center justify-center gap-2" data-testid="quiz-next">
            {idx + 1 < questions.length ? "Próxima" : "Finalizar"} <ChevronRight size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
