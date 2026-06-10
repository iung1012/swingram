import { useQuery } from "@tanstack/react-query";
import { api } from "@/integrations/api/client";

export function useMyProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await api.from("profiles").select("*").eq("user_id", userId).maybeSingle();
      return data;
    },
  });
}

export function useIsStaff(userId: string | undefined) {
  return useQuery({
    queryKey: ["roles", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return { admin: false, moderator: false, support: false };
      const { data } = await api.from("user_roles").select("role").eq("user_id", userId);
      const roles = (data ?? []).map((r) => r.role);
      return {
        admin: roles.includes("admin"),
        moderator: roles.includes("moderator"),
        support: roles.includes("support"),
      };
    },
  });
}

