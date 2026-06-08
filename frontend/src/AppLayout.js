import { Outlet, NavLink, useLocation } from "react-router-dom";
import { Home, BookOpen, Users, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const tabs = [
  { to: "/app", label: "Início", icon: Home, testid: "tab-inicio" },
  { to: "/app/materias", label: "Matérias", icon: BookOpen, testid: "tab-materias" },
  { to: "/app/social", label: "Social", icon: Users, testid: "tab-social" },
  { to: "/app/perfil", label: "Perfil", icon: User, testid: "tab-perfil" },
];

export default function AppLayout() {
  const location = useLocation();
  return (
    <div className="app-shell sl-scroll grain" data-testid="app-shell">
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className="min-h-[100dvh] pb-28"
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>

      <nav
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#12141D]/85 backdrop-blur-xl border-t border-[#262A36] bn-shell z-50"
        data-testid="bottom-nav"
      >
        <div className="flex justify-around items-center h-16">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.to === "/app"}
                data-testid={t.testid}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${
                    isActive ? "text-[#F5A623]" : "text-slate-500"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                    <span className="text-[10px] font-medium tracking-wide">{t.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
