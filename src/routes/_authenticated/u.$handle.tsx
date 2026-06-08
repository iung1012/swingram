import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SignedImage } from "@/components/signed-image";
import { VerifiedBadge } from "@/components/verified-badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReportDialog } from "@/components/report-dialog";
import { toast } from "sonner";
import { MessageCircle, Flame, Ban } from "lucide-react";

export const Route = createFileRoute("/_authenticated/u/$handle")({
  ssr: false,
  head: ({ params }) => ({ meta: [{ title: `@${params.handle} — Brasa Swing` }] }),
  component: PublicProfile,
});

function PublicProfile() {
  const { handle } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ["profile-handle", handle],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("handle", handle).maybeSingle();
      return data;
    },
  });

  const { data: posts } = useQuery({
    queryKey: ["public-posts", profile?.user_id],
    enabled: !!profile,
    queryFn: async () => {
      const { data } = await supabase
        .from("posts")
        .select("id, post_media(url, order)")
        .eq("user_id", profile!.user_id)
        .eq("moderation_status", "approved")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function sendInterest() {
    if (!user || !profile) return;
    const { error } = await supabase.from("interests_sent").insert({ from_user: user.id, to_user: profile.user_id });
    if (error) {
      if (error.code === "23505") toast("Já enviado antes");
      else toast.error("Falha ao enviar");
    } else toast.success("Interesse enviado 🔥");
  }

  async function openChat() {
    if (!user || !profile) return;
    // Check conversation exists & unlocked
    const a = user.id < profile.user_id ? user.id : profile.user_id;
    const b = user.id < profile.user_id ? profile.user_id : user.id;
    const { data: conv } = await supabase
      .from("conversations")
      .select("id, unlocked")
      .or(`and(user_a.eq.${a},user_b.eq.${b}),and(user_a.eq.${b},user_b.eq.${a})`)
      .maybeSingle();
    if (!conv || !conv.unlocked) {
      toast("O chat só abre depois do interesse ser aceito.");
      return;
    }
    nav({ to: "/chat/$id" as never, params: { id: conv.id } as never });
  }

  async function blockUser() {
    if (!user || !profile) return;
    await supabase.from("blocks").insert({ user_id: user.id, blocked_user_id: profile.user_id });
    toast.success("Usuário bloqueado");
    nav({ to: "/home" });
  }

  if (!profile) return <p className="p-6 text-center text-sm text-muted-foreground">Perfil não encontrado.</p>;

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
        {user?.id !== profile.user_id && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button onClick={sendInterest}><Flame className="mr-1 h-4 w-4" /> Tenho interesse</Button>
            <Button variant="outline" onClick={openChat}><MessageCircle className="mr-1 h-4 w-4" /> Chat</Button>
            <ReportDialog targetType="user" targetId={profile.user_id} />
            <Button variant="ghost" onClick={blockUser}><Ban className="mr-1 h-4 w-4" /> Bloquear</Button>
          </div>
        )}
      </Card>

      <div className="mt-5 grid grid-cols-3 gap-1">
        {(posts ?? []).map((p: any) => {
          const first = (p.post_media ?? []).sort((a: any, b: any) => a.order - b.order)[0];
          return <SignedImage key={p.id} bucket="posts" path={first?.url} alt="" className="aspect-square w-full object-cover" />;
        })}
      </div>
    </div>
  );
}
