import { api } from "./api";

/**
 * Checks if the user can start a new quiz session this month.
 * Returns true if allowed, false if paywall should be shown.
 */
export async function canStartSession() {
  try {
    const { data } = await api.get("/plan/status");
    if (data.is_pro) return { allowed: true };
    if (data.sessoes_mes_used >= data.sessoes_mes_max) {
      return { allowed: false, motivo: "sessao_limite" };
    }
    return { allowed: true };
  } catch (_e) {
    return { allowed: true }; // fail-open
  }
}
