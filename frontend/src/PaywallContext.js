import { createContext, useCallback, useContext, useState } from "react";
import { useAuth } from "./AuthContext";
import PaywallModal from "./components/PaywallModal";

const PaywallCtx = createContext({ open: () => {} });
export const usePaywall = () => useContext(PaywallCtx);

export function PaywallProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [motivo, setMotivo] = useState(null);
  const { refresh } = useAuth();

  const open = useCallback((m = null) => {
    setMotivo(m);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const onUpgraded = useCallback(() => {
    refresh();
  }, [refresh]);

  return (
    <PaywallCtx.Provider value={{ open }}>
      {children}
      <PaywallModal open={isOpen} motivo={motivo} onClose={close} onUpgraded={onUpgraded} />
    </PaywallCtx.Provider>
  );
}
