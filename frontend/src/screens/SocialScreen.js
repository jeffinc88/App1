import { motion } from "framer-motion";
import { Users, Swords, Library, Trophy, Lock } from "lucide-react";

const features = [
  { icon: Users, title: "Grupos de Estudo", desc: "Crie grupos com colegas para compartilhar matérias e estudar junto." },
  { icon: Swords, title: "Duelos 1v1", desc: "Desafie alguém em tempo real numa rodada de quiz. Quem acerta mais rápido, ganha." },
  { icon: Library, title: "Biblioteca Colaborativa", desc: "Acesse quizzes feitos pela comunidade e compartilhe os seus." },
  { icon: Trophy, title: "Ranking & Ligas", desc: "Subir de liga toda semana com base em XP. Competição saudável." },
];

export default function SocialScreen() {
  return (
    <div className="px-5 pt-10 pb-6" data-testid="social-screen">
      <div className="mb-7">
        <h1 className="text-2xl font-bold heading">Social</h1>
        <p className="text-slate-400 text-sm mt-1">Estudar junto rende mais. Em breve por aqui.</p>
      </div>

      <div className="relative sl-card p-5 mb-5 overflow-hidden">
        <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-[#A78BFA]/15 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#A78BFA]/20 text-[#A78BFA] flex items-center justify-center">
            <Lock size={18} />
          </div>
          <div>
            <p className="font-semibold">Funcionalidades em desenvolvimento</p>
            <p className="text-xs text-slate-400 mt-0.5">Avisaremos quando chegar.</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {features.map((f, i) => {
          const Icon = f.icon;
          return (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="sl-card p-4 flex items-start gap-3 relative overflow-hidden"
              data-testid={`social-${i}`}
            >
              <div className="w-11 h-11 rounded-xl bg-[#1A1D27] text-[#F5A623] flex items-center justify-center shrink-0">
                <Icon size={20} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{f.title}</p>
                  <span className="text-[10px] uppercase tracking-wider bg-[#F5A623]/15 text-[#F5A623] px-2 py-0.5 rounded-full font-bold">Em breve</span>
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-6 text-center text-xs text-slate-500">
        Quer ser avisado quando lançar? <span className="text-[#F5A623] font-semibold">Fique de olho.</span>
      </div>
    </div>
  );
}
