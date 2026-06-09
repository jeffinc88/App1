import { useState } from "react";
import { Share2, Loader2, Check } from "lucide-react";
import { buildShareCard, shareOrDownload } from "../lib/shareCard";

/**
 * Reusable share button — generates a 1080x1920 PNG of the session result and opens the
 * native share sheet (or downloads as a fallback on desktop).
 */
export default function ShareButton({ title, materia, acertos, total, streak, tipo, username, label = "Compartilhar resultado" }) {
  const [state, setState] = useState("idle"); // idle | loading | done

  const handle = async () => {
    try {
      setState("loading");
      const blob = await buildShareCard({ title, materia, acertos, total, streak, tipo, username });
      const fileName = `studyloop-${tipo}-${Date.now()}.png`;
      await shareOrDownload(blob, fileName, {
        title: "Meu progresso no StudyLoop",
        text: tipo === "flashcard"
          ? `Acabei de revisar ${total} flashcards de ${materia} no StudyLoop 🔥`
          : `Acertei ${acertos}/${total} (${Math.round((acertos / Math.max(total, 1)) * 100)}%) em ${materia} no StudyLoop 🔥`,
      });
      setState("done");
      setTimeout(() => setState("idle"), 2200);
    } catch (e) {
      setState("idle");
    }
  };

  return (
    <button
      onClick={handle}
      disabled={state === "loading"}
      className="sl-btn-ghost mt-3 flex items-center justify-center gap-2"
      data-testid="share-result"
    >
      {state === "loading" && <Loader2 size={18} className="animate-spin" />}
      {state === "done" && <Check size={18} className="text-[#4ADE80]" />}
      {state === "idle" && <Share2 size={18} />}
      {state === "loading" ? "Gerando imagem..." : state === "done" ? "Pronto!" : label}
    </button>
  );
}
