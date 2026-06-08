import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Trophy, Loader2, Sparkles } from "lucide-react";
import { api } from "../api";

const RATINGS = [
  { v: 0, label: "Errei", color: "#FF6B6B" },
  { v: 1, label: "Difícil", color: "#FBBF24" },
  { v: 2, label: "Bom", color: "#60A5FA" },
  { v: 3, label: "Fácil", color: "#4ADE80" },
];

export default function FlashcardScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [loading, setLoading] = useState(true);
  const startRef = useRef(Date.now());

  useEffect(() => {
    api.get(`/flashcards/due/${id}`).then((r) => setCards(r.data)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="px-5 pt-20 text-center text-slate-400"><Loader2 className="mx-auto animate-spin" /></div>;
  if (!cards.length) {
    return (
      <div className="px-5 pt-12 text-center">
        <Sparkles size={28} className="text-[#F5A623] mx-auto mb-3" />
        <h2 className="font-bold heading text-xl">Nenhum flashcard ainda</h2>
        <p className="text-slate-400 text-sm mt-2 mb-6">Adicione conteúdo nesta matéria.</p>
        <button onClick={() => navigate(-1)} className="sl-btn-primary" data-testid="back-no-cards">Voltar</button>
      </div>
    );
  }

  const card = cards[idx];

  const rate = async (grade) => {
    try { await api.post(`/flashcards/${card.flashcard_id}/review`, { grade }); } catch {}
    setReviewed(r => r + 1);
    if (idx + 1 < cards.length) { setIdx(idx + 1); setFlipped(false); }
    else {
      const duration = Math.round((Date.now() - startRef.current) / 1000);
      try {
        await api.post("/sessoes", {
          materia_id: id, tipo: "flashcard",
          total_questoes: cards.length, acertos: cards.length, // any completion counts
          duracao_segundos: duration,
        });
      } catch {}
      setDone(true);
    }
  };

  if (done) {
    return (
      <div className="px-5 pt-20 text-center" data-testid="fc-done">
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring" }}
          className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-[#60A5FA] to-[#A78BFA] flex items-center justify-center mb-5 shadow-[0_0_40px_rgba(96,165,250,0.5)]">
          <Trophy size={42} className="text-white" />
        </motion.div>
        <h2 className="text-3xl font-bold heading">Sessão concluída!</h2>
        <p className="text-slate-400 mt-2 mb-8">{reviewed} flashcards revisados</p>
        <button onClick={() => navigate(-1)} className="sl-btn-primary" data-testid="fc-finish">Voltar</button>
      </div>
    );
  }

  return (
    <div className="px-5 pt-10 pb-6 min-h-[100dvh] flex flex-col" data-testid="flashcard-screen">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate(-1)} className="text-slate-300" data-testid="fc-back"><ArrowLeft size={22} /></button>
        <span className="text-xs text-slate-400">{idx + 1} / {cards.length}</span>
      </div>

      <div className="flex gap-1.5 mb-8">
        {cards.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i < idx ? "bg-[#60A5FA]" : "bg-[#262A36]"}`} />
        ))}
      </div>

      <div className="flex-1 flex items-center justify-center my-4">
        <div
          onClick={() => setFlipped(f => !f)}
          className="fc-flip w-full h-[340px] cursor-pointer select-none"
          data-testid="flashcard-card"
        >
          <div className={`fc-card w-full h-full ${flipped ? "flipped" : ""}`}>
            <div className="fc-face sl-card p-6 flex flex-col items-center justify-center text-center">
              <p className="text-xs uppercase tracking-[0.18em] text-[#F5A623] font-bold mb-4">Frente</p>
              <p className="text-xl font-medium leading-relaxed heading">{card.frente}</p>
              <p className="text-xs text-slate-500 mt-6">Toque para virar</p>
            </div>
            <div className="fc-face fc-back sl-card p-6 flex flex-col items-center justify-center text-center border-[#60A5FA]/30">
              <p className="text-xs uppercase tracking-[0.18em] text-[#60A5FA] font-bold mb-4">Verso</p>
              <p className="text-lg leading-relaxed">{card.verso}</p>
            </div>
          </div>
        </div>
      </div>

      <div>
        {!flipped ? (
          <button onClick={() => setFlipped(true)} className="sl-btn-primary" data-testid="fc-flip-btn">Mostrar resposta</button>
        ) : (
          <div>
            <p className="text-center text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">Como foi sua resposta?</p>
            <div className="grid grid-cols-4 gap-2">
              {RATINGS.map((r) => (
                <button
                  key={r.v} onClick={() => rate(r.v)}
                  className="py-3 rounded-xl font-semibold text-sm active:scale-95 transition"
                  style={{ background: r.color + "20", color: r.color, border: `1px solid ${r.color}33` }}
                  data-testid={`fc-rate-${r.v}`}
                >{r.label}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
