import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MoreHorizontal, MessageCircle, Bookmark, BookmarkCheck, Heart, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FireLike } from "./fire-like";
import { SignedMedia } from "./signed-media";
import { VerifiedAvatar } from "./verified-avatar";
import { VerifiedBadge } from "./verified-badge";
import { ReportDialog } from "./report-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { renderCaption } from "@/lib/hashtags";


type Media = { url: string; order: number; kind?: "image" | "video" };
type Author = {
  handle: string;
  display_name: string;
  avatar_url: string | null;
  verified: boolean;
};
export type PostCardData = {
  id: string;
  user_id: string;
  caption: string | null;
  nsfw: boolean;
  created_at: string;
  author: Author;
  media: Media[];
  likes_count: number;
  liked_by_me: boolean;
  saved_by_me: boolean;
  comments_count: number;
};

export function PostCard({
  post,
  currentUserId,
  defaultBlur,
  commentsAsDialog,
}: {
  post: PostCardData;
  currentUserId: string | null;
  defaultBlur: boolean;
  commentsAsDialog?: boolean;
}) {
  const qc = useQueryClient();
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likes, setLikes] = useState(post.likes_count);
  const [saved, setSaved] = useState(post.saved_by_me);
  const [revealed, setRevealed] = useState(!post.nsfw || !defaultBlur);
  const [active, setActive] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [likesOpen, setLikesOpen] = useState(false);
  const hasMedia = (post.media ?? []).length > 0;
  const current = post.media[active];

  useEffect(() => setRevealed(!post.nsfw || !defaultBlur), [post.nsfw, defaultBlur]);
  useEffect(() => { setLiked(post.liked_by_me); setLikes(post.likes_count); }, [post.liked_by_me, post.likes_count]);

  const COMMENTS_PAGE_SIZE = 15;
  const {
    data: commentsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: commentsLoading,
  } = useInfiniteQuery({
    queryKey: ["post-comments", post.id, currentUserId],
    enabled: showComments || commentsOpen,
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: any) => lastPage.nextCursor as string | null,
    queryFn: async ({ pageParam }) => {
      let q = supabase
        .from("comments")
        .select("id, user_id, body, created_at")
        .eq("post_id", post.id)
        .eq("status", "visible")
        .order("created_at", { ascending: false })
        .limit(COMMENTS_PAGE_SIZE + 1);
      if (pageParam) q = q.lt("created_at", pageParam);
      const { data: cs } = await q;
      const rows = cs ?? [];
      const hasMore = rows.length > COMMENTS_PAGE_SIZE;
      const list = hasMore ? rows.slice(0, COMMENTS_PAGE_SIZE) : rows;
      const commentIds = list.map((c) => c.id);
      const ids = Array.from(new Set(list.map((c) => c.user_id)));
      let profilesMap = new Map<string, any>();
      if (ids.length) {
        const { data: ps } = await supabase
          .from("profiles")
          .select("user_id, handle, display_name, avatar_url")
          .in("user_id", ids);
        profilesMap = new Map((ps ?? []).map((p: any) => [p.user_id, p]));
      }
      const likesByComment = new Map<string, { count: number; mine: boolean; byAuthor: boolean }>();
      if (commentIds.length) {
        const { data: cls } = await supabase
          .from("comment_likes")
          .select("comment_id, user_id")
          .in("comment_id", commentIds);
        (cls ?? []).forEach((cl: any) => {
          const prev = likesByComment.get(cl.comment_id) ?? { count: 0, mine: false, byAuthor: false };
          prev.count += 1;
          if (cl.user_id === currentUserId) prev.mine = true;
          if (cl.user_id === post.user_id) prev.byAuthor = true;
          likesByComment.set(cl.comment_id, prev);
        });
      }
      const items = list.map((c: any) => ({
        ...c,
        profile: profilesMap.get(c.user_id),
        likes: likesByComment.get(c.id)?.count ?? 0,
        liked_by_me: likesByComment.get(c.id)?.mine ?? false,
        liked_by_author: likesByComment.get(c.id)?.byAuthor ?? false,
      }));
      return {
        items,
        nextCursor: hasMore ? list[list.length - 1].created_at : null,
      };
    },
  });

  // Flatten pages (desc fetched) then reverse to render ascending (oldest -> newest).
  const comments = useMemo(() => {
    if (!commentsData) return undefined;
    const all = commentsData.pages.flatMap((p: any) => p.items);
    return [...all].reverse();
  }, [commentsData]);

  const inlineScrollRef = useRef<HTMLDivElement | null>(null);
  const dialogScrollRef = useRef<HTMLDivElement | null>(null);

  function onCommentsScroll(e: React.UIEvent<HTMLDivElement>) {
    if (!hasNextPage || isFetchingNextPage) return;
    if (e.currentTarget.scrollTop < 40) fetchNextPage();
  }


  const { data: likers } = useQuery({
    queryKey: ["post-likers", post.id],
    enabled: likesOpen,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("likes")
        .select("user_id")
        .eq("post_id", post.id)
        .order("created_at", { ascending: false })
        .limit(100);
      const ids = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
      if (!ids.length) return [];
      const { data: ps } = await supabase
        .from("profiles")
        .select("user_id, handle, display_name, avatar_url, verified")
        .in("user_id", ids);
      const map = new Map((ps ?? []).map((p: any) => [p.user_id, p]));
      return (rows ?? []).map((r: any) => map.get(r.user_id)).filter(Boolean);
    },
  });

  async function deleteComment(commentId: string) {
    const { error } = await supabase.from("comments").delete().eq("id", commentId);
    if (error) toast.error("Falha ao apagar");
    else {
      toast.success("Comentário apagado");
      qc.invalidateQueries({ queryKey: ["post-comments", post.id] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    }
  }

  async function toggleCommentLike(commentId: string, liked: boolean) {
    if (!currentUserId) return;
    if (liked) {
      await supabase.from("comment_likes").delete().eq("comment_id", commentId).eq("user_id", currentUserId);
    } else {
      await supabase.from("comment_likes").insert({ comment_id: commentId, user_id: currentUserId });
    }
    qc.invalidateQueries({ queryKey: ["post-comments", post.id] });
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUserId) {
      toast.error("Faça login para comentar");
      return;
    }
    const text = body.trim();
    if (!text) return;
    setSending(true);
    const { error } = await supabase.from("comments").insert({
      post_id: post.id,
      user_id: currentUserId,
      body: text,
    });
    setSending(false);
    if (error) {
      toast.error("Falha ao comentar");
      return;
    }
    setBody("");
    qc.invalidateQueries({ queryKey: ["post-comments", post.id] });
    qc.invalidateQueries({ queryKey: ["feed"] });
  }

  async function toggleLike() {
    if (!currentUserId) return;
    const next = !liked;
    setLiked(next);
    setLikes((l) => l + (next ? 1 : -1));
    if (next) await supabase.from("likes").insert({ post_id: post.id, user_id: currentUserId });
    else await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", currentUserId);
    qc.setQueryData(["post-likes", post.id, currentUserId], {
      likes: likes + (next ? 1 : -1),
      likedByMe: next,
    });
    qc.invalidateQueries({ queryKey: ["post-likes", post.id] });
    qc.invalidateQueries({ queryKey: ["feed"] });
    qc.invalidateQueries({ queryKey: ["profile-stats"] });
  }

  async function toggleSave() {
    if (!currentUserId) return;
    const next = !saved;
    setSaved(next);
    if (next) await supabase.from("saves").insert({ post_id: post.id, user_id: currentUserId });
    else await supabase.from("saves").delete().eq("post_id", post.id).eq("user_id", currentUserId);
  }

  async function blockAuthor() {
    if (!currentUserId) return;
    const { error } = await supabase
      .from("blocks")
      .insert({ user_id: currentUserId, blocked_user_id: post.user_id });
    if (error) toast.error("Falha ao bloquear");
    else toast.success("Usuário bloqueado");
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card">
      <header className="flex items-center justify-between gap-2 px-3 py-2.5">
        <Link
          to={"/u/$handle" as never}
          params={{ handle: post.author.handle } as never}
          className="group flex min-w-0 items-center gap-2.5"
        >
          <VerifiedAvatar
            bucket="avatars"
            path={post.author.avatar_url}
            alt={post.author.display_name}
            verified={post.author.verified}
            className="h-9 w-9"
          />
          <div className="min-w-0">
            <p className="flex items-center gap-1 truncate text-[13px] font-semibold tracking-tight leading-tight group-hover:underline">
              {post.author.display_name}
              {post.author.verified && <VerifiedBadge />}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">@{post.author.handle}</p>
          </div>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Mais"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={2.2} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <ReportDialog
              targetType="post"
              targetId={post.id}
              trigger={
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  Denunciar post
                </DropdownMenuItem>
              }
            />
            <ReportDialog
              targetType="user"
              targetId={post.user_id}
              trigger={
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  Denunciar perfil
                </DropdownMenuItem>
              }
            />
            <DropdownMenuItem onSelect={blockAuthor}>Bloquear usuário</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {hasMedia && (
        <div className="relative aspect-square w-full overflow-hidden border-y border-border bg-black">
          <button
            type="button"
            onClick={() => !revealed && setRevealed(true)}
            className="block h-full w-full"
            aria-label={revealed ? "Mídia" : "Conteúdo sensível — toque para ver"}
          >
            <SignedMedia
              bucket="posts"
              path={current?.url}
              kind={current?.kind ?? "image"}
              alt=""
              controls={current?.kind === "video" && revealed}
              muted
              playsInline
              className={`h-full w-full object-cover ${!revealed ? "nsfw-blur" : ""}`}
            />
            {!revealed && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[13px] font-medium tracking-tight text-white">
                Conteúdo sensível — toque para ver
              </span>
            )}
          </button>
          {post.media.length > 1 && (
            <div className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 gap-1 rounded-full border border-white/10 bg-black/40 px-2 py-1 backdrop-blur">
              {post.media.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  aria-label={`Item ${i + 1}`}
                  className={`h-1 rounded-full transition-all ${
                    i === active ? "w-5 bg-white" : "w-1 bg-white/40"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-4">
          <Dialog open={likesOpen} onOpenChange={setLikesOpen}>
            <DialogTrigger asChild>
              <button className="inline-flex items-center gap-1">
                <FireLike liked={liked} count={likes} onToggle={toggleLike} disabled={!currentUserId} />
              </button>
            </DialogTrigger>
            <DialogContent className="max-h-[80vh] overflow-hidden p-0">
              <DialogHeader className="px-5 pt-5 pb-3">
                <DialogTitle className="text-[15px]">Curtidas</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 overflow-y-auto px-5 pb-5">
                {(likers ?? []).length === 0 ? (
                  <p className="text-center text-[12px] text-muted-foreground">
                    {likesOpen ? "Ninguém curtiu ainda." : "Carregando…"}
                  </p>
                ) : (
                  (likers ?? []).map((p: any) => (
                    <Link
                      key={p.user_id}
                      to={"/u/$handle" as never}
                      params={{ handle: p.handle } as never}
                      className="flex items-center gap-2.5"
                      onClick={() => setLikesOpen(false)}
                    >
                      <VerifiedAvatar
                        bucket="avatars"
                        path={p.avatar_url}
                        alt={p.display_name}
                        verified={p.verified}
                        className="h-8 w-8"
                      />
                      <div className="min-w-0">
                        <p className="flex items-center gap-1 truncate text-[13px] font-semibold leading-tight">
                          {p.display_name}
                          {p.verified && <VerifiedBadge />}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">@{p.handle}</p>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>
          {commentsAsDialog ? (
            <Dialog open={commentsOpen} onOpenChange={setCommentsOpen}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  aria-label="Comentários"
                  className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
                >
                  <MessageCircle className="h-4 w-4" strokeWidth={2.2} />
                  {comments?.length ?? post.comments_count}
                </button>
              </DialogTrigger>
            </Dialog>
          ) : (
            <button
              type="button"
              onClick={() => setShowComments((v) => !v)}
              aria-label="Comentários"
              aria-expanded={showComments}
              className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
            >
              <MessageCircle className="h-4 w-4" strokeWidth={2.2} />
              {comments?.length ?? post.comments_count}
            </button>
          )}
        </div>
        <button
          onClick={toggleSave}
          aria-label="Salvar"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
        >
          {saved ? (
            <BookmarkCheck className="h-3.5 w-3.5 text-primary" strokeWidth={2.2} />
          ) : (
            <Bookmark className="h-3.5 w-3.5" strokeWidth={2.2} />
          )}
        </button>
      </div>
      {post.caption && (
        <p className="whitespace-pre-wrap px-3 pb-3 text-[13px] leading-relaxed text-foreground/90">
          <Link
            to={"/u/$handle" as never}
            params={{ handle: post.author.handle } as never}
            className="mr-1.5 font-semibold tracking-tight"
          >
            @{post.author.handle}
          </Link>
          {renderCaption(post.caption)}
        </p>
      )}
      {!commentsAsDialog && showComments && (
        <div className="border-t border-border">
          <div className="max-h-72 space-y-3 overflow-y-auto px-3 py-3">
            {(comments ?? []).length === 0 ? (
              <p className="text-center text-[12px] text-muted-foreground">
                {comments ? "Seja o primeiro a comentar." : "Carregando…"}
              </p>
            ) : (
              (comments ?? []).map((c: any) => {
                const isOwn = c.user_id === currentUserId;
                const canDelete = isOwn || post.user_id === currentUserId;
                return (
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
                      <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                        <button
                          type="button"
                          onClick={() => toggleCommentLike(c.id, c.liked_by_me)}
                          disabled={!currentUserId}
                          className="inline-flex items-center gap-1 hover:text-foreground disabled:opacity-50"
                          aria-label={c.liked_by_me ? "Descurtir" : "Curtir"}
                        >
                          <Heart
                            className={`h-3 w-3 ${c.liked_by_me ? "fill-primary text-primary" : ""}`}
                            strokeWidth={2.2}
                          />
                          {c.likes > 0 && c.likes}
                        </button>
                        {c.liked_by_author && c.user_id !== post.user_id && (
                          <span className="text-primary">Curtido pelo autor</span>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label="Mais"
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={2.2} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canDelete && (
                          <DropdownMenuItem
                            onSelect={() => deleteComment(c.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Apagar comentário
                          </DropdownMenuItem>
                        )}
                        {!isOwn && (
                          <ReportDialog
                            targetType="comment"
                            targetId={c.id}
                            trigger={
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                Denunciar como spam
                              </DropdownMenuItem>
                            }
                          />
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })
            )}
          </div>
          <form
            onSubmit={submitComment}
            className="flex items-center gap-2 border-t border-border bg-card/95 px-3 py-2"
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
      )}
      {commentsAsDialog && (
        <Dialog open={commentsOpen} onOpenChange={setCommentsOpen}>
          <DialogContent className="max-h-[85vh] overflow-hidden p-0 sm:max-w-md">
            <DialogHeader className="px-5 pt-5 pb-3">
              <DialogTitle className="text-[15px]">Comentários</DialogTitle>
            </DialogHeader>
            <div className="max-h-[60vh] space-y-3 overflow-y-auto px-5 pb-3">
              {(comments ?? []).length === 0 ? (
                <p className="text-center text-[12px] text-muted-foreground">
                  {comments ? "Seja o primeiro a comentar." : "Carregando…"}
                </p>
              ) : (
                (comments ?? []).map((c: any) => {
                  const isOwn = c.user_id === currentUserId;
                  const canDelete = isOwn || post.user_id === currentUserId;
                  return (
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
                        <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                          <button
                            type="button"
                            onClick={() => toggleCommentLike(c.id, c.liked_by_me)}
                            disabled={!currentUserId}
                            className="inline-flex items-center gap-1 hover:text-foreground disabled:opacity-50"
                            aria-label={c.liked_by_me ? "Descurtir" : "Curtir"}
                          >
                            <Heart
                              className={`h-3 w-3 ${c.liked_by_me ? "fill-primary text-primary" : ""}`}
                              strokeWidth={2.2}
                            />
                            {c.likes > 0 && c.likes}
                          </button>
                          {c.liked_by_author && c.user_id !== post.user_id && (
                            <span className="text-primary">Curtido pelo autor</span>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label="Mais"
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={2.2} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canDelete && (
                            <DropdownMenuItem
                              onSelect={() => deleteComment(c.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" /> Apagar comentário
                            </DropdownMenuItem>
                          )}
                          {!isOwn && (
                            <ReportDialog
                              targetType="comment"
                              targetId={c.id}
                              trigger={
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                  Denunciar como spam
                                </DropdownMenuItem>
                              }
                            />
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })
              )}
            </div>
            <form
              onSubmit={submitComment}
              className="flex items-center gap-2 border-t border-border bg-card/95 px-5 py-3"
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
          </DialogContent>
        </Dialog>
      )}
    </article>
  );
}
