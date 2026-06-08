import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, BookOpen, X, ChevronRight, FlaskConical, Atom, Calculator, Globe, Microscope, Languages, Palette, Music } from "lucide-react";
import { api } from "../api";

const ICONS = { book: BookOpen, flask: FlaskConical, atom: Atom, calc: Calculator, globe: Globe, micro: Microscope, lang: Languages, palette: Palette, music: Music };
const COLORS = ["#F5A623", "#4ADE80", "#60A5FA", "#FF6B6B", "#A78BFA", "#F472B6", "#FBBF24", "#34D399"];

export default function MateriasScreen() {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState(COLORS[0]);
  const [icone, setIcone] = useState("book");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const navigate = useNavigate();

  const load = () => api.get("/materias").then((r) => setList(r.data));
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await api.post("/materias", { nome, cor, icone });
      setOpen(false); setNome(""); setCor(COLORS[0]); setIcone("book");
      load();
    } catch (ex) {
      setErr(ex?.response?.data?.detail || "Erro ao criar matéria");
    } finally { setLoading(false); }
  };

  return (
    <div className="px-5 pt-10 pb-6" data-testid="materias-screen">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold heading">Matérias</h1>
        <button
          onClick={() => setOpen(true)}
          className="w-11 h-11 rounded-full bg-[#F5A623] flex items-center justify-center text-[#090A0F] active:scale-95 transition shadow-[0_4px_20px_rgba(245,166,35,0.3)]"
          data-testid="add-materia-button"
        >
          <Plus size={22} strokeWidth={2.6} />
        </button>
      </div>

      {list.length === 0 && (
        <div className="sl-card p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#F5A623]/15 flex items-center justify-center mb-3">
            <BookOpen size={26} className="text-[#F5A623]" />
          </div>
          <h3 className="font-bold heading">Nenhuma matéria ainda</h3>
          <p className="text-slate-400 text-sm mt-1">Crie sua primeira matéria para começar.</p>
        </div>
      )}

      <div className="space-y-3">
        {list.map((m) => {
          const Icon = ICONS[m.icone] || BookOpen;
          const total = (m.total_questoes || 0) + (m.total_flashcards || 0);
          return (
            <motion.button
              key={m.materia_id}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(`/app/materia/${m.materia_id}`)}
              data-testid={`materia-${m.materia_id}`}
              className="w-full sl-card p-4 flex items-center gap-4 text-left transition-colors hover:border-[#F5A623]/40"
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: m.cor + "22", color: m.cor }}>
                <Icon size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{m.nome}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {m.total_fontes || 0} {(m.total_fontes||0) === 1 ? "fonte" : "fontes"} · {total} itens
                </p>
              </div>
              <ChevronRight size={18} className="text-slate-500" />
            </motion.button>
          );
        })}
      </div>

      {/* Bottom sheet for create */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 bg-black/70 z-[55]"
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30 }}
              className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#12141D] rounded-t-3xl z-[60] p-6 border-t border-[#262A36]"
              data-testid="create-materia-sheet"
            >
              <div className="w-10 h-1 bg-[#262A36] rounded-full mx-auto mb-5" />
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold heading">Nova matéria</h2>
                <button onClick={() => setOpen(false)} className="text-slate-400" data-testid="close-sheet"><X size={20} /></button>
              </div>
              <form onSubmit={create} className="space-y-4">
                <input
                  required maxLength={50} value={nome} onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: História do Brasil"
                  className="sl-input" data-testid="input-materia-nome"
                />
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">Cor</p>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map((c) => (
                      <button type="button" key={c} onClick={() => setCor(c)}
                        className={`w-9 h-9 rounded-full transition-transform ${cor === c ? "scale-110 ring-2 ring-white/40" : ""}`}
                        style={{ background: c }} data-testid={`color-${c}`}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">Ícone</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(ICONS).map(([k, Ic]) => (
                      <button type="button" key={k} onClick={() => setIcone(k)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition ${icone === k ? "bg-[#F5A623] text-[#090A0F]" : "bg-[#1A1D27] text-slate-400"}`}
                        data-testid={`icon-${k}`}
                      ><Ic size={18} /></button>
                    ))}
                  </div>
                </div>
                <button type="submit" disabled={loading || !nome.trim()} className="sl-btn-primary mt-2" data-testid="submit-materia">
                  {loading ? "Criando..." : "Criar matéria"}
                </button>
                {err && <p className="text-[#FF6B6B] text-sm mt-2" data-testid="materia-error">{err}</p>}
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
