import { redirect } from "@tanstack/react-router";
import { api } from "@/integrations/api/client";

async function currentRoles(): Promise<string[]> {
  const { data: { user } } = await api.auth.getUser();
  if (!user) throw redirect({ to: "/auth" });
  const { data: roles } = await api
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  return (roles ?? []).map((r: { role: string }) => r.role);
}

/** Allows any staff member (admin, moderator or support). */
export async function requireStaff() {
  const roles = await currentRoles();
  if (!roles.some((r) => r === "admin" || r === "moderator" || r === "support")) {
    throw redirect({ to: "/home" });
  }
}

/** Allows admins only. */
export async function requireAdmin() {
  const roles = await currentRoles();
  if (!roles.includes("admin")) throw redirect({ to: "/home" });
}
