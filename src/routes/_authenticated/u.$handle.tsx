import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SignedImage } from "@/components/signed-image";
import { SignedMedia } from "@/components/signed-media";
import { PostCard, type PostCardData } from "@/components/post-card";
import { renderCaption } from "@/lib/hashtags";
import { VerifiedAvatar } from "@/components/verified-avatar";
import { VerifiedBadge } from "@/components/verified-badge";
import { ReportDialog } from "@/components/report-dialog";
import { ZoomPostContent } from "@/components/zoom-post-content";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { MessageCircle, Flame, Ban, MapPin, Grid3x3, Flag, UserPlus, UserCheck, Share2, Heart, Users, MoreVertical, Eye, BadgeCheck } from "lucide-react";
import { useMyProfile } from "@/hooks/use-profile";
import { distanceKm } from "@/lib/geo";




function formatCompact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "") + "k";
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
}

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
  const [reportOpen, setReportOpen] = useState(false);
  const [zoomPost, setZoomPost] = useState<{ id: string; url: string | null; kind: "image" | "video" | "text"; caption: string } | null>(null);
  const [tab, setTab] = useState<"posts" | "photos">("posts");
  const { data: myProfile } = useMyProfile(user?.id);


  const { data: profile } = useQuery({
    queryKey: ["profile-handle", handle],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("handle", handle).maybeSingle();
      return data;
    },
  });

  const { data: postCards } = useQuery<PostCardData[]>({
    queryKey: ["public-posts", profile?.user_id, user?.id],
    enabled: !!profile,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("posts")
        .select(`id, user_id, caption, nsfw, created_at, post_media(url, order, kind)`)
        .eq("user_id", profile!.user_id)
        .eq("moderation_status", "approved")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      const postRows = rows ?? [];
      if (postRows.length === 0) return [];

      const ids = postRows.map((r: any) => r.id);
      const [{ data: likes }, { data: comments }, savesRes] = await Promise.all([
        supabase.from("likes").select("post_id, user_id").in("post_id", ids),
        supabase.from("comments").select("post_id").in("post_id", ids),
        user?.id
          ? supabase.from("saves").select("post_id").eq("user_id", user.id).in("post_id", ids)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const likesMap: Record<string, number> = {};
      const likesByMe = new Set<string>();
      (likes ?? []).forEach((l: any) => {
        likesMap[l.post_id] = (likesMap[l.post_id] ?? 0) + 1;
        if (user?.id && l.user_id === user.id) likesByMe.add(l.post_id);
      });

      const commentsMap: Record<string, number> = {};
      (comments ?? []).forEach((c: any) => {
        commentsMap[c.post_id] = (commentsMap[c.post_id] ?? 0) + 1;
      });

      const savedByMe = new Set<string>();
      (savesRes?.data ?? []).forEach((s: any) => savedByMe.add(s.post_id));

      const author = {
        handle: profile!.handle,
        display_name: profile!.display_name,
        avatar_url: profile!.avatar_url,
        verified: profile!.verified,
      };

      return postRows.map((r: any) => ({
        id: r.id,
        user_id: r.user_id,
        caption: r.caption,
        nsfw: r.nsfw,
        created_at: r.created_at,
        author,
        media: (r.post_media ?? [])
          .sort((a: any, b: any) => a.order - b.order)
          .map((m: any) => ({ url: m.url, order: m.order, kind: m.kind })),
        likes_count: likesMap[r.id] ?? 0,
        liked_by_me: likesByMe.has(r.id),
        saved_by_me: savedByMe.has(r.id),
        comments_count: commentsMap[r.id] ?? 0,
      }));
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["profile-stats", profile?.user_id],
    enabled: !!profile,
    queryFn: async () => {
      const [followersRes, postIdsRes, viewsRes] = await Promise.all([
        supabase
          .from("follows")
          .select("follower_id", { count: "exact", head: true })
          .eq("followee_id", profile!.user_id),
        supabase
          .from("posts")
          .select("id")
          .eq("user_id", profile!.user_id)
          .is("deleted_at", null),
        supabase
          .from("profile_views")
          .select("profile_id", { count: "exact", head: true })
          .eq("profile_id", profile!.user_id),
      ]);
      const ids = (postIdsRes.data ?? []).map((p: any) => p.id);
      let likes = 0;
      if (ids.length) {
        const { count } = await supabase
          .from("likes")
          .select("post_id", { count: "exact", head: true })
          .in("post_id", ids);
        likes = count ?? 0;
      }
      return { followers: followersRes.count ?? 0, likes, views: viewsRes.count ?? 0 };
    },
  });

  useEffect(() => {
    if (!user || !profile || user.id === profile.user_id) return;
    supabase
      .from("profile_views")
      .insert({ profile_id: profile.user_id, viewer_id: user.id })
      .then(({ error }) => {
        if (!error) qc.invalidateQueries({ queryKey: ["profile-stats", profile.user_id] });
      });
  }, [user?.id, profile?.user_id]);

  const { data: followState } = useQuery({
    queryKey: ["follow", user?.id, profile?.user_id],
    enabled: !!user && !!profile && user.id !== profile.user_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", user!.id)
        .eq("followee_id", profile!.user_id)
        .maybeSingle();
      return { following: !!data };
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
    qc.invalidateQueries({ queryKey: ["profile-stats", profile.user_id] });

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
    const { checkRateLimit } = await import("@/lib/rate-limit");
    if (!(await checkRateLimit("send_interest"))) return;
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
              <div className="flex items-start gap-1.5">
                <h1 className="min-w-0 flex-1 truncate text-[19px] font-semibold tracking-tight">
                  {profile.display_name}
                </h1>
                {profile.verified && <VerifiedBadge />}
                {!isMe && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        aria-label="Mais opções"
                        className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                      >
                        <MoreVertical className="h-4 w-4" strokeWidth={2.2} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onSelect={() => setReportOpen(true)}>
                        <Flag className="mr-2 h-4 w-4" strokeWidth={2} />
                        Denunciar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={blockUser} className="text-destructive focus:text-destructive">
                        <Ban className="mr-2 h-4 w-4" strokeWidth={2} />
                        Bloquear
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <p className="mt-0.5 text-[13px] text-muted-foreground">@{profile.handle}</p>
              {profile.verified && (
                <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                  <BadgeCheck className="h-3 w-3" strokeWidth={2.5} />
                  Perfil verificado
                </p>
              )}
              {profile.city && (
                <p className="mt-1.5 inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                  <MapPin className="h-3 w-3" strokeWidth={2} />
                  {profile.city}
                </p>
              )}
            </div>
          </div>

          {!isMe && (
            <ReportDialog
              targetType="user"
              targetId={profile.user_id}
              trigger={null as any}
              open={reportOpen}
              onOpenChange={setReportOpen}
            />
          )}


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

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/60 pt-3 text-[12px]">
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} />
              <span className="font-semibold tabular-nums">{formatCompact(stats?.followers ?? 0)}</span>
              <span className="text-muted-foreground">seguidores</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Heart className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} />
              <span className="font-semibold tabular-nums">{formatCompact(stats?.likes ?? 0)}</span>
              <span className="text-muted-foreground">curtidas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} />
              <span className="font-semibold tabular-nums">{formatCompact(stats?.views ?? 0)}</span>
              <span className="text-muted-foreground">visitas</span>
            </div>
          </div>



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
            </div>
          )}
        </div>
      </section>

      <section className="mt-7">
        <div className="mb-3 flex items-center gap-1 rounded-xl border border-border bg-card/40 p-1">
          <button
            type="button"
            onClick={() => setTab("posts")}
            className={`flex-1 rounded-lg px-3 py-2 text-[12px] font-semibold tracking-tight transition-colors ${
              tab === "posts"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Postagens
            <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
              {(postCards ?? []).length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab("photos")}
            className={`flex-1 rounded-lg px-3 py-2 text-[12px] font-semibold tracking-tight transition-colors ${
              tab === "photos"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Fotos
            <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
              {(postCards ?? []).filter((p) => p.media.length > 0).length}
            </span>
          </button>
        </div>

        {tab === "posts" ? (
          !postCards || postCards.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/40 px-4 py-10 text-center">
              <p className="text-[13px] text-muted-foreground">Nenhum post publicado.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {postCards.map((p) => (
                <PostCard key={p.id} post={p} currentUserId={user?.id ?? null} defaultBlur={false} />
              ))}
            </div>
          )
        ) : !postCards || postCards.filter((p) => p.media.length > 0).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 px-4 py-10 text-center">
            <p className="text-[13px] text-muted-foreground">Nenhuma foto ou vídeo publicado.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {postCards
              .filter((p) => p.media.length > 0)
              .map((p) => {
                const first = p.media[0];
                const kind = first?.kind ?? "image";
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() =>
                      setZoomPost({
                        id: p.id,
                        url: first?.url ?? null,
                        kind: kind as "image" | "video" | "text",
                        caption: p.caption ?? "",
                      })
                    }
                    className="group relative overflow-hidden rounded-lg border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <SignedMedia
                      bucket="posts"
                      path={first?.url}
                      kind={kind}
                      alt=""
                      controls={false}
                      muted
                      className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
                    />
                    {kind === "video" && (
                      <span className="pointer-events-none absolute right-1.5 top-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                        ▶ vídeo
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
        )}
      </section>

      <Dialog open={!!zoomPost} onOpenChange={(o) => !o && setZoomPost(null)}>
        <DialogContent className="flex h-[92vh] max-h-[92vh] w-[96vw] max-w-3xl flex-col overflow-hidden border-border bg-card p-0 sm:h-[88vh] sm:max-h-[88vh]">
          <DialogTitle className="sr-only">Visualizar post</DialogTitle>
          {zoomPost && (
            <ZoomPostContent
              postId={zoomPost.id}
              url={zoomPost.url}
              kind={zoomPost.kind}
              caption={zoomPost.caption}
              currentUserId={user?.id ?? null}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
