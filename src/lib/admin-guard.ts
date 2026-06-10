import { redirect } from "@tanstack/react-router";
import { api } from "@/integrations/api/client";

export async function requireAdmin() {
  const { data: { user } } = await api.auth.getUser();
  if (!user) throw redirect({ to: "/auth" });
  const { data: roles } = await api
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  const list = (roles ?? []).map((r) => r.role);
  if (!list.includes("admin")) throw redirect({ to: "/home" });
}

