import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, FileText, Link as LinkIcon, FileUp, Camera, BookOpen, Layers, Sparkles, X, Loader2, Trash2 } from "lucide-react";
import { api } from "../api";

const TIPO_ICON = { texto: FileText, link: LinkIcon, pdf: FileUp, foto: Camera };

export default function MateriaDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [materia, setMateria] = useState(null);
  const [fontes, setFontes] = useState([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const ms = await api.get("/materias");
    const m = ms.data.find((x) => x.materia_id === id);
    setMateria(m);
    const f = await api.get(`/fontes/${id}`);
    setFontes(f.data);
  };
  useEffect(() => { load(); }, [id]);

  const removeFonte = async (fonte_id) => {
    if (!window.confirm("Remover essa fonte e seu conteúdo gerado?")) return;
    await api.delete(`/fontes/${fonte_id}`);
    load();
  };

  if (!materia) return <div className="px-5 pt-10 text-slate-400">Carregando…</div>;

  const totalQ = fontes.reduce((s, f) => s + (f.total_questoes || 0), 0);
  const totalF = fontes.reduce((s, f) => s + (f.total_flashcards || 0), 0);

  return (
    <div className="pb-6" data-testid="materia-detail">
      {/* Header with color tint */}
      <div className="relative px-5 pt-10 pb-6" style={{ background: `linear-gradient(180deg, ${materia.cor}22 0%, transparent 100%)` }}>
        <button onClick={() => navigate(-1)} className="mb-4 text-slate-300 active:scale-95" data-testid="back-btn">
          <ArrowLeft size={22} />
        </button>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: materia.cor + "33", color: materia.cor }}>
            <BookOpen size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold heading" data-testid="materia-nome">{materia.nome}</h1>
            <p className="text-xs text-slate-400">{fontes.length} {fontes.length === 1 ? "fonte" : "fontes"}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-5">
          <button
            disabled={totalQ === 0}
            onClick={() => navigate(`/app/quiz/materia/${id}`)}
            className="sl-card p-4 text-left active:scale-95 transition disabled:opacity-40"
            data-testid="start-quiz"
          >
            <Sparkles size={18} className="text-[#F5A623] mb-2" />
            <p className="font-semibold">Quiz</p>
            <p className="text-xs text-slate-400">{totalQ} questões</p>
          </button>
          <button
            disabled={totalF === 0}
            onClick={() => navigate(`/app/flashcards/${id}`)}
            className="sl-card p-4 text-left active:scale-95 transition disabled:opacity-40"
            data-testid="start-flashcards"
          >
            <Layers size={18} className="text-[#60A5FA] mb-2" />
            <p className="font-semibold">Flashcards</p>
            <p className="text-xs text-slate-400">{totalF} cards</p>
          </button>
        </div>
      </div>

      <div className="px-5 mt-2">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Fontes de estudo</p>
          <button onClick={() => setOpen(true)} className="text-sm text-[#F5A623] font-semibold flex items-center gap-1" data-testid="add-fonte-button">
            <Plus size={16} /> Adicionar
          </button>
        </div>

        {fontes.length === 0 && (
          <div className="sl-card p-8 text-center">
            <Sparkles size={28} className="text-[#F5A623] mx-auto mb-2" />
            <p className="font-semibold">Adicione conteúdo</p>
            <p className="text-slate-400 text-sm mt-1">Texto, link, PDF ou foto — a IA cuida do resto.</p>
          </div>
        )}

        <div className="space-y-3">
          {fontes.map((f) => {
            const Icon = TIPO_ICON[f.tipo] || FileText;
            return (
              <div key={f.fonte_id} className="sl-card p-4 flex items-start gap-3" data-testid={`fonte-${f.fonte_id}`}>
                <div className="w-10 h-10 rounded-xl bg-[#1A1D27] flex items-center justify-center shrink-0 text-[#F5A623]">
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{f.titulo}</p>
                  {f.resumo_ia && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{f.resumo_ia}</p>}
                  <div className="flex gap-3 mt-2 text-xs text-slate-500">
                    <span>{f.total_questoes || 0} questões</span>
                    <span>·</span>
                    <span>{f.total_flashcards || 0} cards</span>
                  </div>
                </div>
                <button onClick={() => removeFonte(f.fonte_id)} className="text-slate-500 hover:text-[#FF6B6B] p-1" data-testid={`del-${f.fonte_id}`}>
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <AddContentSheet open={open} onClose={() => setOpen(false)} materiaId={id} onCreated={load} />
    </div>
  );
}

function AddContentSheet({ open, onClose, materiaId, onCreated }) {
  const [tipo, setTipo] = useState(null);
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const reset = () => { setTipo(null); setTitulo(""); setConteudo(""); setUrl(""); setFile(null); setErr(null); };
  const close = () => { reset(); onClose(); };

  const submit = async (e) => {
    e?.preventDefault?.();
    setErr(null);
    setLoading(true);
    try {
      if (tipo === "texto") {
        await api.post("/fontes/text", { materia_id: materiaId, titulo, conteudo });
      } else if (tipo === "link") {
        await api.post("/fontes/link", { materia_id: materiaId, titulo: titulo || undefined, url });
      } else if (tipo === "pdf" || tipo === "foto") {
        const fd = new FormData();
        fd.append("materia_id", materiaId);
        fd.append("titulo", titulo);
        fd.append("file", file);
        await api.post(`/fontes/${tipo}`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      }
      onCreated();
      close();
    } catch (ex) {
      setErr(ex?.response?.data?.detail || "Erro ao gerar conteúdo");
    } finally {
      setLoading(false);
    }
  };

  const tipos = [
    { v: "texto", icon: FileText, label: "Texto", desc: "Cole conteúdo" },
    { v: "link", icon: LinkIcon, label: "Link", desc: "URL de site" },
    { v: "pdf", icon: FileUp, label: "PDF", desc: "Upload arquivo" },
    { v: "foto", icon: Camera, label: "Foto", desc: "Página de livro" },
  ];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={close} className="fixed inset-0 bg-black/70 z-[55]" />
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30 }}
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#12141D] rounded-t-3xl z-[60] p-6 border-t border-[#262A36] max-h-[88vh] overflow-y-auto sl-scroll"
            data-testid="add-content-sheet"
          >
            <div className="w-10 h-1 bg-[#262A36] rounded-full mx-auto mb-5" />
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold heading">{tipo ? "Adicionar conteúdo" : "Tipo de conteúdo"}</h2>
              <button onClick={close} className="text-slate-400" data-testid="close-add-content"><X size={20} /></button>
            </div>

            {!tipo && (
              <div className="grid grid-cols-2 gap-2.5">
                {tipos.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button key={t.v} onClick={() => setTipo(t.v)} className="sl-card p-3 text-left active:scale-95 transition" data-testid={`tipo-${t.v}`}>
                      <div className="w-9 h-9 rounded-lg bg-[#F5A623]/15 text-[#F5A623] flex items-center justify-center mb-2"><Icon size={18} /></div>
                      <p className="font-semibold text-sm">{t.label}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{t.desc}</p>
                    </button>
                  );
                })}
              </div>
            )}

            {tipo && (
              <form onSubmit={submit} className="space-y-4">
                <button type="button" onClick={() => setTipo(null)} className="text-sm text-slate-400 flex items-center gap-1" data-testid="back-tipo">
                  <ArrowLeft size={14} /> Trocar tipo
                </button>

                <input
                  required={tipo !== "link"}
                  value={titulo} onChange={(e) => setTitulo(e.target.value)}
                  placeholder={tipo === "link" ? "Título (opcional)" : "Título da fonte"}
                  className="sl-input" data-testid="input-fonte-titulo"
                />

                {tipo === "texto" && (
                  <textarea
                    required value={conteudo} onChange={(e) => setConteudo(e.target.value)}
                    placeholder="Cole aqui o conteúdo de estudo (mínimo 200 caracteres recomendado)..."
                    rows={8} className="sl-input resize-none" data-testid="input-conteudo"
                  />
                )}
                {tipo === "link" && (
                  <input required type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="sl-input" data-testid="input-url" />
                )}
                {(tipo === "pdf" || tipo === "foto") && (
                  <label className="block sl-card p-6 text-center cursor-pointer hover:border-[#F5A623]/40 transition" data-testid="file-drop">
                    <input
                      type="file"
                      accept={tipo === "pdf" ? "application/pdf" : "image/*"}
                      onChange={(e) => setFile(e.target.files?.[0])}
                      className="hidden"
                      capture={tipo === "foto" ? "environment" : undefined}
                      data-testid="input-file"
                    />
                    {tipo === "pdf" ? <FileUp size={28} className="mx-auto text-[#F5A623] mb-2" /> : <Camera size={28} className="mx-auto text-[#F5A623] mb-2" />}
                    <p className="text-sm font-medium">{file ? file.name : (tipo === "pdf" ? "Escolher PDF" : "Tirar foto / escolher imagem")}</p>
                    <p className="text-xs text-slate-500 mt-1">{tipo === "pdf" ? "Até 50 páginas" : "JPG ou PNG"}</p>
                  </label>
                )}

                {err && <div className="text-[#FF6B6B] text-sm" data-testid="add-error">{err}</div>}

                <div className="bg-[#1A1D27] rounded-xl p-3 flex items-center gap-3 text-xs text-slate-400">
                  <Sparkles size={16} className="text-[#F5A623] shrink-0" />
                  A IA vai gerar 6 questões e 6 flashcards. Pode levar até 30s.
                </div>

                <button type="submit" disabled={loading || (tipo === "texto" && !conteudo) || (tipo === "link" && !url) || ((tipo === "pdf" || tipo === "foto") && !file) || (tipo !== "link" && !titulo)} className="sl-btn-primary flex items-center justify-center gap-2" data-testid="submit-fonte">
                  {loading && <Loader2 size={18} className="animate-spin" />}
                  {loading ? "Gerando..." : "Gerar com IA"}
                </button>
              </form>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
