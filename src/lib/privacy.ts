import { api } from "@/integrations/api/client";

export type ProfileVisibility = "public" | "followers" | "hidden";

export type PrivacyProfile = {
  user_id: string;
  banned?: boolean | null;
  shadow_banned?: boolean | null;
  invisible_mode?: boolean | null;
  profile_visibility?: ProfileVisibility | null;
};

export type PrivacyState = {
  following: Set<string>;
  blockedByMe: Set<string>;
  blockedMe: Set<string>;
};

export const PROFILE_VISIBILITY_OPTIONS: Array<{
  value: ProfileVisibility;
  label: string;
  description: string;
}> = [
  {
    value: "public",
    label: "Público",
    description: "Aparece para qualquer pessoa autenticada.",
  },
  {
    value: "followers",
    label: "Só seguidores",
    description: "Aparece apenas para quem já segue você.",
  },
  {
    value: "hidden",
    label: "Oculto",
    description: "Não entra em busca, feed ou mapa.",
  },
];

export function effectiveVisibility(profile: PrivacyProfile): ProfileVisibility {
  if (profile.invisible_mode) return "hidden";
  return profile.profile_visibility ?? "public";
}

export function isProfileBlocked(
  targetUserId: string,
  state: PrivacyState,
): boolean {
  return state.blockedByMe.has(targetUserId) || state.blockedMe.has(targetUserId);
}

export function canViewProfile(
  profile: PrivacyProfile | null | undefined,
  viewerUserId: string | null,
  state: PrivacyState,
  isStaff = false,
): boolean {
  if (!profile) return false;
  if (isStaff) return true;
  if (viewerUserId === profile.user_id) return true;
  if (profile.banned) return false;
  if (profile.shadow_banned) return false;
  if (isProfileBlocked(profile.user_id, state)) return false;

  const visibility = effectiveVisibility(profile);
  if (visibility === "hidden") return false;
  if (visibility === "followers") return state.following.has(profile.user_id);
  return true;
}

export function visibilityLabel(value: ProfileVisibility | null | undefined): string {
  switch (value ?? "public") {
    case "followers":
      return "Só seguidores";
    case "hidden":
      return "Oculto";
    default:
      return "Público";
  }
}

export async function fetchPrivacyState(
  viewerUserId: string | null,
  targetUserIds: string[],
): Promise<PrivacyState> {
  const ids = Array.from(new Set(targetUserIds.filter(Boolean)));
  if (!viewerUserId || ids.length === 0) {
    return {
      following: new Set(),
      blockedByMe: new Set(),
      blockedMe: new Set(),
    };
  }

  const [followingRes, blockedByMeRes, blockedMeRes] = await Promise.all([
    api
      .from("follows")
      .select("followee_id")
      .eq("follower_id", viewerUserId)
      .in("followee_id", ids),
    api
      .from("blocks")
      .select("blocked_user_id")
      .eq("user_id", viewerUserId)
      .in("blocked_user_id", ids),
    api
      .from("blocks")
      .select("user_id")
      .eq("blocked_user_id", viewerUserId)
      .in("user_id", ids),
  ]);

  return {
    following: new Set((followingRes.data ?? []).map((r: any) => r.followee_id)),
    blockedByMe: new Set((blockedByMeRes.data ?? []).map((r: any) => r.blocked_user_id)),
    blockedMe: new Set((blockedMeRes.data ?? []).map((r: any) => r.user_id)),
  };
}

export function notifyPrivacyChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("privacy:changed"));
}
