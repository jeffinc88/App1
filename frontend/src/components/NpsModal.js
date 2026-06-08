import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Check } from "lucide-react";
import { api } from "../api";

/**
 * NPS Survey Modal — shown on Home if /api/nps/status returns show:true.
 * 0..10 scale, optional comment. "Enviar" calls /nps/submit, "Agora não" calls /nps/snooze.
 */
export default function NpsModal({ open, onClose }) {
  const [nota, setNota] = useState(null);
  const [comentario, setComentario] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (nota === null) return;
    setSubmitting(true);
    try { await api.post("/nps/submit", { nota, comentario: comentario.trim() || null }); }
    catch (_e) { /* noop */ }
    setSubmitting(false);
    setDone(true);
    setTimeout(() => onClose("answered"), 900);
  };

  const snooze = async () => {
    try { await api.post("/nps/snooze"); } catch (_e) { /* noop */ }
    onClose("snoozed");
  };

  // Color band for the scale
  const colorFor = (n) => {
    if (n <= 6) return "#FF6B6B"; // detrator
    if (n <= 8) return "#FBBF24"; // neutro
    return "#4ADE80"; // promotor
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-[55]"
            onClick={snooze}
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#12141D] rounded-t-3xl z-[60] p-6 border-t border-[#262A36] max-h-[92dvh] overflow-y-auto sl-scroll"
            data-testid="nps-modal"
          >
            <div className="w-10 h-1 bg-[#262A36] rounded-full mx-auto mb-5" />
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold heading">Você gosta do StudyLoop?</h2>
              </div>
              <button onClick={snooze} className="text-slate-400 p-1" data-testid="nps-close" aria-label="Fechar">
                <X size={20} />
              </button>
            </div>

            {done ? (
              <div className="py-10 text-center" data-testid="nps-thanks">
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring" }}
                  className="w-16 h-16 mx-auto rounded-full bg-[#4ADE80]/20 text-[#4ADE80] flex items-center justify-center mb-3"
                >
                  <Check size={30} strokeWidth={3} />
                </motion.div>
                <p className="font-semibold heading text-lg">Obrigado! 🧡</p>
                <p className="text-slate-400 text-sm mt-1">Sua resposta nos ajuda a melhorar o app.</p>
              </div>
            ) : (
              <>
                <p className="text-slate-300 text-[15px] leading-relaxed mb-5">
                  De 0 a 10, qual a chance de você recomendar o StudyLoop para um amigo?
                </p>

                <div className="grid grid-cols-11 gap-1 mb-2" data-testid="nps-scale">
                  {Array.from({ length: 11 }).map((_, n) => {
                    const active = nota === n;
                    const color = active ? colorFor(n) : "#262A36";
                    return (
                      <motion.button
                        key={n}
                        whileTap={{ scale: 0.88 }}
                        onClick={() => setNota(n)}
                        data-testid={`nps-${n}`}
                        className="aspect-square rounded-lg text-sm font-bold flex items-center justify-center transition-colors"
                        style={{
                          background: active ? color : "#1A1D27",
                          color: active ? "#090A0F" : "#94A3B8",
                          border: `1px solid ${active ? color : "#262A36"}`,
                          boxShadow: active ? `0 0 16px ${color}55` : "none",
                        }}
                      >{n}</motion.button>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-6">
                  <span>nada provável</span>
                  <span>muito provável</span>
                </div>

                <textarea
                  rows={3}
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder="O que motivou sua nota? (opcional)"
                  className="sl-input resize-none"
                  maxLength={1000}
                  data-testid="nps-comment"
                />

                <button
                  onClick={submit}
                  disabled={nota === null || submitting}
                  className="sl-btn-primary mt-5 flex items-center justify-center gap-2"
                  data-testid="nps-submit"
                >
                  {submitting && <Loader2 size={18} className="animate-spin" />}
                  {submitting ? "Enviando..." : "Enviar"}
                </button>
                <button onClick={snooze} className="block mx-auto mt-4 text-sm text-slate-400 underline-offset-2 hover:text-slate-200" data-testid="nps-later">
                  Agora não
                </button>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
