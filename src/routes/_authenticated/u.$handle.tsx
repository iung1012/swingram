import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SignedImage } from "@/components/signed-image";
import { SignedMedia } from "@/components/signed-media";
import { renderCaption } from "@/lib/hashtags";
import { VerifiedAvatar } from "@/components/verified-avatar";
import { VerifiedBadge } from "@/components/verified-badge";
import { ReportDialog } from "@/components/report-dialog";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { MessageCircle, Flame, Ban, MapPin, Grid3x3, Flag, UserPlus, UserCheck, Share2, Heart, Users, MoreVertical } from "lucide-react";


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
        .select("id, caption, post_media(url, order, kind)")
        .eq("user_id", profile!.user_id)
        .eq("moderation_status", "approved")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["profile-stats", profile?.user_id],
    enabled: !!profile,
    queryFn: async () => {
      const [followersRes, postIdsRes] = await Promise.all([
        supabase
          .from("follows")
          .select("follower_id", { count: "exact", head: true })
          .eq("followee_id", profile!.user_id),
        supabase
          .from("posts")
          .select("id")
          .eq("user_id", profile!.user_id)
          .is("deleted_at", null),
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
      return { followers: followersRes.count ?? 0, likes };
    },
  });

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

          <div className="mt-4 flex items-center gap-5 border-t border-border/60 pt-3 text-[12px]">
            <div className="flex items-center gap-1.5">
              <Grid3x3 className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} />
              <span className="font-semibold tabular-nums">{(posts ?? []).length}</span>
              <span className="text-muted-foreground">posts</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} />
              <span className="font-semibold tabular-nums">{stats?.followers ?? 0}</span>
              <span className="text-muted-foreground">seguidores</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Heart className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} />
              <span className="font-semibold tabular-nums">{stats?.likes ?? 0}</span>
              <span className="text-muted-foreground">curtidas</span>
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
              const kind: "image" | "video" | "text" = first ? first.kind ?? "image" : "text";
              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() =>
                    setZoomPost({
                      id: p.id,
                      url: first?.url ?? null,
                      kind,
                      caption: p.caption ?? "",
                    })
                  }
                  className="group relative overflow-hidden rounded-lg border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {kind === "text" ? (
                    <div className="flex aspect-square w-full items-center justify-center bg-secondary/40 p-2">
                      <p className="line-clamp-5 text-center text-[11px] leading-snug text-foreground/90">
                        {p.caption || "(sem texto)"}
                      </p>
                    </div>
                  ) : (
                    <SignedMedia
                      bucket="posts"
                      path={first?.url}
                      kind={kind}
                      alt=""
                      controls={false}
                      muted
                      className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
                    />
                  )}
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
        <DialogContent className="max-w-3xl border-border bg-card p-0">
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

function ZoomPostContent({
  postId,
  url,
  kind,
  caption,
  currentUserId,
}: {
  postId: string;
  url: string | null;
  kind: "image" | "video" | "text";
  caption: string;
  currentUserId: string | null;
}) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const { data: comments } = useQuery({
    queryKey: ["post-comments", postId],
    queryFn: async () => {
      const { data: cs } = await supabase
        .from("comments")
        .select("id, user_id, body, created_at")
        .eq("post_id", postId)
        .eq("status", "visible")
        .order("created_at", { ascending: true })
        .limit(100);
      const ids = Array.from(new Set((cs ?? []).map((c) => c.user_id)));
      let profilesMap = new Map<string, any>();
      if (ids.length) {
        const { data: ps } = await supabase
          .from("profiles")
          .select("user_id, handle, display_name, avatar_url")
          .in("user_id", ids);
        profilesMap = new Map((ps ?? []).map((p: any) => [p.user_id, p]));
      }
      return (cs ?? []).map((c: any) => ({ ...c, profile: profilesMap.get(c.user_id) }));
    },
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUserId) {
      toast.error("Faça login para comentar");
      return;
    }
    const text = body.trim();
    if (!text) return;
    setSending(true);
    const { error } = await supabase.from("comments").insert({
      post_id: postId,
      user_id: currentUserId,
      body: text,
    });
    setSending(false);
    if (error) {
      toast.error("Falha ao comentar");
      return;
    }
    setBody("");
    qc.invalidateQueries({ queryKey: ["post-comments", postId] });
  }

  const showMediaPane = kind !== "text" && !!url;

  return (
    <div
      className={
        "grid max-h-[85vh] grid-cols-1 overflow-hidden " +
        (showMediaPane ? "md:grid-cols-[1.2fr_1fr]" : "")
      }
    >
      {showMediaPane && (
        <div className="flex items-center justify-center bg-black">
          <SignedMedia
            bucket="posts"
            path={url}
            kind={kind === "video" ? "video" : "image"}
            alt=""
            controls={kind === "video"}
            className="max-h-[85vh] w-full object-contain"
          />
        </div>
      )}
      <div className="flex max-h-[85vh] flex-col">
        {caption && (
          <div className="whitespace-pre-wrap border-b border-border px-4 py-3 text-[14px] leading-relaxed text-foreground/90">
            {renderCaption(caption)}
          </div>
        )}
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {(comments ?? []).length === 0 ? (
            <p className="text-center text-[12px] text-muted-foreground">
              Seja o primeiro a comentar.
            </p>
          ) : (
            (comments ?? []).map((c: any) => (
              <div key={c.id} className="flex gap-2.5">
                <VerifiedAvatar
                  bucket="avatars"
                  path={c.profile?.avatar_url}
                  alt={c.profile?.display_name ?? ""}
                  verified={false}
                  className="h-7 w-7 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px]">
                    <span className="font-semibold">@{c.profile?.handle ?? "user"}</span>{" "}
                    <span className="text-foreground/90">{c.body}</span>
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
        <form
          onSubmit={submit}
          className="flex items-center gap-2 border-t border-border bg-card/80 px-3 py-2"
        >
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={currentUserId ? "Adicione um comentário…" : "Faça login para comentar"}
            disabled={!currentUserId || sending}
            maxLength={500}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={!currentUserId || sending || !body.trim()}
            className="rounded-md px-3 py-2 text-[13px] font-medium text-primary-foreground disabled:opacity-50"
            style={{ background: "var(--gradient-brasa-h)" }}
          >
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
}
