import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile, useIsStaff } from "@/hooks/use-profile";
import { SignedImage } from "@/components/signed-image";
import { VerifiedBadge } from "@/components/verified-badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, BadgeCheck, Shield, LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  ssr: false,
  head: () => ({ meta: [{ title: "Meu perfil — Spark" }] }),
  component: MyProfile,
});

function MyProfile() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { data: profile } = useMyProfile(user?.id);
  const { data: roles } = useIsStaff(user?.id);

  const { data: posts } = useQuery({
    queryKey: ["my-posts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("posts")
        .select("id, post_media(url, order), moderation_status")
        .eq("user_id", user!.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function logout() {
    await supabase.auth.signOut();
    nav({ to: "/auth" });
  }

  if (!profile) return <p className="p-6 text-center text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6">
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <SignedImage bucket="avatars" path={profile.avatar_url} alt={profile.display_name} className="h-20 w-20 rounded-full object-cover" />
          <div className="flex-1">
            <h1 className="text-lg font-bold">{profile.display_name} {profile.verified && <VerifiedBadge />}</h1>
            <p className="text-sm text-muted-foreground">@{profile.handle}</p>
            {profile.city && <p className="text-xs text-muted-foreground">📍 {profile.city}</p>}
          </div>
        </div>
        {profile.bio && <p className="mt-3 text-sm">{profile.bio}</p>}
        {(profile.interests ?? []).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {profile.interests.map((i: string) => <span key={i} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">{i}</span>)}
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          {!profile.verified && (
            <Button asChild variant="default" size="sm"><Link to="/verify"><BadgeCheck className="mr-1 h-4 w-4" /> Verificar</Link></Button>
          )}
          <Button asChild variant="outline" size="sm"><Link to="/settings"><Settings className="mr-1 h-4 w-4" /> Configurações</Link></Button>
          {roles?.admin && (
            <Button asChild variant="secondary" size="sm" className="col-span-2"><Link to="/admin"><Shield className="mr-1 h-4 w-4" /> Painel admin</Link></Button>
          )}
          <Button variant="ghost" size="sm" className="col-span-2 text-destructive" onClick={logout}><LogOut className="mr-1 h-4 w-4" /> Sair</Button>
        </div>
      </Card>

      <div className="mt-5">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Seus posts</h2>
        {!posts || posts.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhum post ainda.</p>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {posts.map((p: any) => {
              const first = (p.post_media ?? []).sort((a: any, b: any) => a.order - b.order)[0];
              return (
                <div key={p.id} className="relative">
                  <SignedImage bucket="posts" path={first?.url} alt="" className="aspect-square w-full object-cover" />
                  {p.moderation_status !== "approved" && (
                    <span className="absolute left-1 top-1 rounded bg-background/80 px-1.5 py-0.5 text-[10px] uppercase">{p.moderation_status === "pending" ? "Em análise" : "Rejeitado"}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
