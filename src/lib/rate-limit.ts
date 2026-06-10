import { api } from "@/integrations/api/client";
import { toast } from "sonner";

export type RateLimitAction =
  | "create_post"
  | "send_message"
  | "send_interest"
  | "send_report";

const LIMITS: Record<RateLimitAction, { max: number; windowSeconds: number; label: string }> = {
  create_post:    { max: 10, windowSeconds: 3600,  label: "publicações" },
  send_message:   { max: 60, windowSeconds: 60,    label: "mensagens" },
  send_interest:  { max: 30, windowSeconds: 3600,  label: "interesses" },
  send_report:    { max: 20, windowSeconds: 86400, label: "denúncias" },
};

/**
 * Checks (and increments) a per-user rate limit on the server.
 * Returns true when the action is allowed; false (and shows a toast) when blocked.
 */
export async function checkRateLimit(action: RateLimitAction): Promise<boolean> {
  const { max, windowSeconds, label } = LIMITS[action];
  const { error } = await api.rpc("check_rate_limit", {
    p_action: action,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (!error) return true;

  if (typeof error.message === "string" && error.message.includes("rate_limit_exceeded")) {
    const periodo =
      windowSeconds >= 86400 ? "no dia"
      : windowSeconds >= 3600 ? "na última hora"
      : windowSeconds >= 60   ? "no último minuto"
      : `nos últimos ${windowSeconds}s`;
    toast.error(`Limite de ${label} atingido (${max} ${periodo}). Aguarde um pouco.`);
    return false;
  }

  // network / auth error
  toast.error("Não foi possível validar o limite. Tente novamente.");
  return false;
}

