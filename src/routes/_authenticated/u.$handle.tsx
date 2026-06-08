import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SignedImage } from "@/components/signed-image";
import { VerifiedAvatar } from "@/components/verified-avatar";
import { VerifiedBadge } from "@/components/verified-badge";
import { ReportDialog } from "@/components/report-dialog";
import { toast } from "sonner";
import { MessageCircle, Flame, Ban, MapPin, Grid3x3, Flag, UserPlus, UserCheck, Share2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/u/$handle")({
  ssr: false,
  head: ({ params }) => ({ meta: [{ title: `@${params.handle} — Brasa Swing` }] }),
  component: PublicProfile,
});

function PublicProfile() {
  const { handle } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();

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

  const { data: followState } = useQuery({
    queryKey: ["follow", user?.id, profile?.user_id],
    enabled: !!user && !!profile && user.id !== profile.user_id,
    queryFn: async () => {
      const [mine, counts] = await Promise.all([
        supabase
          .from("follows")
          .select("follower_id")
          .eq("follower_id", user!.id)
          .eq("followee_id", profile!.user_id)
          .maybeSingle(),
        supabase
          .from("follows")
          .select("follower_id", { count: "exact", head: true })
          .eq("followee_id", profile!.user_id),
      ]);
      return { following: !!mine.data, followers: counts.count ?? 0 };
    },
  });

  async function toggleFollow() {
    if (!user || !profile) return;
    if (followState?.following) {
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("followee_id", profile.user_id);
      toast.success("Você deixou de seguir");
    } else {
      const { error } = await supabase
        .from("follows")
        .insert({ follower_id: user.id, followee_id: profile.user_id });
      if (error) return toast.error("Falha ao seguir");
      toast.success("Seguindo");
    }
    qc.invalidateQueries({ queryKey: ["follow", user.id, profile.user_id] });
  }

  async function shareProfile() {
    if (!profile) return;
    const url = `${window.location.origin}/u/${profile.handle}`;
    const data = { title: profile.display_name, text: `Veja @${profile.handle} no Brasa Swing`, url };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copiado");
      }
    } catch {}
  }

  async function sendInterest() {
    if (!user || !profile) return;
    const { error } = await supabase
      .from("interests_sent")
      .insert({ from_user: user.id, to_user: profile.user_id });
    if (error) {
      if (error.code === "23505") toast("Já enviado antes");
      else toast.error("Falha ao enviar");
    } else toast.success("Interesse enviado");
  }

  async function openChat() {
    if (!user || !profile) return;
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

  if (!profile)
    return (
      <div className="mx-auto max-w-2xl px-4 pt-10">
        <div className="h-44 animate-pulse rounded-2xl border border-border bg-card/60" />
      </div>
    );

  const isMe = user?.id === profile.user_id;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-12 pt-6">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-[0.18]"
          style={{
            background:
              "radial-gradient(120% 80% at 50% 0%, var(--fire) 0%, transparent 60%)",
          }}
        />
        <div className="relative p-5">
          <div className="flex items-start gap-4">
          <VerifiedAvatar
            bucket="avatars"
            path={profile.avatar_url}
            alt={profile.display_name}
            verified={profile.verified}
            className="h-20 w-20"
          />
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex items-center gap-1.5">
                <h1 className="truncate text-[19px] font-semibold tracking-tight">
                  {profile.display_name}
                </h1>
                {profile.verified && <VerifiedBadge />}
              </div>
              <p className="mt-0.5 text-[13px] text-muted-foreground">@{profile.handle}</p>
              {profile.city && (
                <p className="mt-1.5 inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                  <MapPin className="h-3 w-3" strokeWidth={2} />
                  {profile.city}
                </p>
              )}
            </div>
          </div>

          {profile.bio && (
            <p className="mt-4 text-[14px] leading-relaxed text-foreground/90">{profile.bio}</p>
          )}

          {(profile.interests ?? []).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {profile.interests.map((i: string) => (
                <span
                  key={i}
                  className="rounded-md border border-border bg-secondary/60 px-2 py-0.5 text-[11px] font-medium text-foreground/85"
                >
                  {i}
                </span>
              ))}
            </div>
          )}

          {!isMe && (
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                onClick={sendInterest}
                className="flex h-10 items-center justify-center gap-1.5 rounded-lg text-[14px] font-medium text-primary-foreground transition active:scale-[0.98]"
                style={{ background: "var(--gradient-brasa-h)" }}
              >
                <Flame className="h-4 w-4" strokeWidth={2.4} />
                Tenho interesse
              </button>
              <button
                onClick={openChat}
                className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary/60 text-[14px] font-medium tracking-tight hover:bg-secondary"
              >
                <MessageCircle className="h-4 w-4" strokeWidth={2.2} />
                Mensagem
              </button>
              <button
                onClick={toggleFollow}
                className={
                  "flex h-10 items-center justify-center gap-1.5 rounded-lg border text-[13px] font-medium transition " +
                  (followState?.following
                    ? "border-border bg-card text-foreground hover:bg-secondary/60"
                    : "border-foreground/30 bg-secondary text-foreground hover:bg-secondary/80")
                }
              >
                {followState?.following ? (
                  <>
                    <UserCheck className="h-3.5 w-3.5" strokeWidth={2.2} />
                    Seguindo
                  </>
                ) : (
                  <>
                    <UserPlus className="h-3.5 w-3.5" strokeWidth={2.2} />
                    Seguir
                  </>
                )}
              </button>
              <button
                onClick={shareProfile}
                className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-card text-[13px] font-medium text-muted-foreground hover:text-foreground"
              >
                <Share2 className="h-3.5 w-3.5" strokeWidth={2} />
                Compartilhar
              </button>
              <ReportDialog
                targetType="user"
                targetId={profile.user_id}
                trigger={
                  <button className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-card text-[13px] font-medium text-muted-foreground hover:text-foreground">
                    <Flag className="h-3.5 w-3.5" strokeWidth={2} />
                    Denunciar
                  </button>
                }
              />
              <button
                onClick={blockUser}
                className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-card text-[13px] font-medium text-destructive hover:bg-secondary/60"
              >
                <Ban className="h-3.5 w-3.5" strokeWidth={2} />
                Bloquear
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="mt-7">
        <div className="mb-2.5 flex items-center justify-between px-1">
          <h2 className="inline-flex items-center gap-1.5 text-[13px] font-semibold tracking-tight">
            <Grid3x3 className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} />
            Posts
          </h2>
          <span className="text-[11px] text-muted-foreground">{(posts ?? []).length}</span>
        </div>
        {!posts || posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 px-4 py-10 text-center">
            <p className="text-[13px] text-muted-foreground">Nenhum post publicado.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {posts.map((p: any) => {
              const first = (p.post_media ?? []).sort((a: any, b: any) => a.order - b.order)[0];
              return (
                <div
                  key={p.id}
                  className="overflow-hidden rounded-lg border border-border"
                >
                  <SignedImage
                    bucket="posts"
                    path={first?.url}
                    alt=""
                    className="aspect-square w-full object-cover"
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
