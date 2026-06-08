import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  MoreHorizontal,
  MessageCircle,
  Bookmark,
  BookmarkCheck,
  Heart,
  Trash2,
  X,
  Pencil,
  Share2,
  Reply,
  ExternalLink,
} from "lucide-react";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { renderCaption } from "@/lib/hashtags";
import { useRealtimePost } from "@/hooks/use-realtime";


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

type CommentRow = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  parent_id: string | null;
  profile?: { handle: string; display_name: string; avatar_url: string | null };
  likes: number;
  liked_by_me: boolean;
  liked_by_author: boolean;
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
  const isOwner = currentUserId === post.user_id;

  const [liked, setLiked] = useState(post.liked_by_me);
  const [likes, setLikes] = useState(post.likes_count);
  const [saved, setSaved] = useState(post.saved_by_me);
  const [commentsCount, setCommentsCount] = useState(post.comments_count);
  const [revealed, setRevealed] = useState(!post.nsfw || !defaultBlur);
  const [active, setActive] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [likesOpen, setLikesOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; handle: string } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [caption, setCaption] = useState(post.caption ?? "");
  const [captionDraft, setCaptionDraft] = useState(post.caption ?? "");
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const hasMedia = (post.media ?? []).length > 0;
  const current = post.media[active];

  // Realtime: keep counts and comments fresh while the card is mounted.
  useRealtimePost(post.id);

  useEffect(() => setRevealed(!post.nsfw || !defaultBlur), [post.nsfw, defaultBlur]);
  useEffect(() => { setLiked(post.liked_by_me); setLikes(post.likes_count); }, [post.liked_by_me, post.likes_count]);
  useEffect(() => { setCommentsCount(post.comments_count); }, [post.comments_count]);
  useEffect(() => { setCaption(post.caption ?? ""); }, [post.caption]);

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
    getNextPageParam: (lastPage: { items: CommentRow[]; nextCursor: string | null }) => lastPage.nextCursor,
    queryFn: async ({ pageParam }) => {
      let q = supabase
        .from("comments")
        .select("id, user_id, body, created_at, parent_id")
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
      let profilesMap = new Map<string, { handle: string; display_name: string; avatar_url: string | null }>();
      if (ids.length) {
        const { data: ps } = await supabase
          .from("profiles")
          .select("user_id, handle, display_name, avatar_url")
          .in("user_id", ids);
        profilesMap = new Map(
          (ps ?? []).map((p) => [
            p.user_id,
            { handle: p.handle, display_name: p.display_name, avatar_url: p.avatar_url },
          ]),
        );
      }
      const likesByComment = new Map<string, { count: number; mine: boolean; byAuthor: boolean }>();
      if (commentIds.length) {
        const { data: cls } = await supabase
          .from("comment_likes")
          .select("comment_id, user_id")
          .in("comment_id", commentIds);
        (cls ?? []).forEach((cl) => {
          const prev = likesByComment.get(cl.comment_id) ?? { count: 0, mine: false, byAuthor: false };
          prev.count += 1;
          if (cl.user_id === currentUserId) prev.mine = true;
          if (cl.user_id === post.user_id) prev.byAuthor = true;
          likesByComment.set(cl.comment_id, prev);
        });
      }
      const items: CommentRow[] = list.map((c) => ({
        id: c.id,
        user_id: c.user_id,
        body: c.body,
        created_at: c.created_at,
        parent_id: c.parent_id ?? null,
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

  // Flatten pages then split into roots + replies grouped by parent.
  const { roots, repliesByParent } = useMemo(() => {
    const all = (commentsData?.pages ?? []).flatMap((p) => p.items);
    // Show oldest -> newest at root level.
    const sorted = [...all].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const present = new Set(sorted.map((c) => c.id));
    const replies = new Map<string, CommentRow[]>();
    const roots: CommentRow[] = [];
    for (const c of sorted) {
      if (c.parent_id && present.has(c.parent_id)) {
        const arr = replies.get(c.parent_id) ?? [];
        arr.push(c);
        replies.set(c.parent_id, arr);
      } else {
        // Orphans (parent not in current pages) render at root.
        roots.push(c);
      }
    }
    return { roots, repliesByParent: replies };
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
      const ids = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
      if (!ids.length) return [];
      const { data: ps } = await supabase
        .from("profiles")
        .select("user_id, handle, display_name, avatar_url, verified")
        .in("user_id", ids);
      const map = new Map((ps ?? []).map((p) => [p.user_id, p]));
      return (rows ?? []).map((r) => map.get(r.user_id)).filter(Boolean) as Array<{
        user_id: string;
        handle: string;
        display_name: string;
        avatar_url: string | null;
        verified: boolean;
      }>;
    },
  });

  async function deleteComment(commentId: string) {
    const { error } = await supabase.from("comments").delete().eq("id", commentId);
    if (error) toast.error("Falha ao apagar");
    else {
      toast.success("Comentário apagado");
      setCommentsCount((c) => Math.max(0, c - 1));
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
      parent_id: replyingTo?.id ?? null,
    });
    setSending(false);
    if (error) {
      toast.error("Falha ao comentar");
      return;
    }
    setBody("");
    setReplyingTo(null);
    setCommentsCount((c) => c + 1);
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

  async function sharePost() {
    const url = `${window.location.origin}/post/${post.id}`;
    const shareData = {
      title: post.author.display_name,
      text: post.caption ?? "",
      url,
    };
    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await navigator.share(shareData);
        return;
      }
    } catch {
      // user canceled — fall back to copy.
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  }

  async function saveEdit() {
    if (!currentUserId) return;
    const text = captionDraft.trim();
    setSavingEdit(true);
    const { error } = await supabase
      .from("posts")
      .update({ caption: text || null })
      .eq("id", post.id);
    setSavingEdit(false);
    if (error) {
      toast.error("Falha ao salvar");
      return;
    }
    setCaption(text);
    setEditOpen(false);
    toast.success("Legenda atualizada");
    qc.invalidateQueries({ queryKey: ["feed"] });
    qc.invalidateQueries({ queryKey: ["post", post.id] });
    qc.invalidateQueries({ queryKey: ["my-posts"] });
  }

  async function deletePost() {
    if (!currentUserId) return;
    setDeleting(true);
    const { error } = await supabase
      .from("posts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", post.id);
    setDeleting(false);
    setConfirmDelete(false);
    if (error) {
      toast.error("Falha ao apagar post");
      return;
    }
    setDeleted(true);
    toast.success("Post apagado");
    qc.invalidateQueries({ queryKey: ["feed"] });
    qc.invalidateQueries({ queryKey: ["my-posts"] });
    qc.invalidateQueries({ queryKey: ["profile-stats"] });
  }

  if (deleted) return null;

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
            <DropdownMenuItem onSelect={sharePost}>
              <Share2 className="mr-2 h-3.5 w-3.5" /> Compartilhar
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={"/post/$id" as never} params={{ id: post.id } as never}>
                <ExternalLink className="mr-2 h-3.5 w-3.5" /> Abrir post
              </Link>
            </DropdownMenuItem>
            {isOwner ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    setCaptionDraft(caption);
                    setEditOpen(true);
                  }}
                >
                  <Pencil className="mr-2 h-3.5 w-3.5" /> Editar legenda
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setConfirmDelete(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Apagar post
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuSeparator />
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
              </>
            )}
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
                  (likers ?? []).map((p) => (
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
                  {commentsCount}
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
              {commentsCount}
            </button>
          )}
          <button
            type="button"
            onClick={sharePost}
            aria-label="Compartilhar"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
          >
            <Share2 className="h-4 w-4" strokeWidth={2.2} />
          </button>
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
      {caption && (
        <p className="whitespace-pre-wrap px-3 pb-3 text-[13px] leading-relaxed text-foreground/90">
          <Link
            to={"/u/$handle" as never}
            params={{ handle: post.author.handle } as never}
            className="mr-1.5 font-semibold tracking-tight"
          >
            @{post.author.handle}
          </Link>
          {renderCaption(caption)}
        </p>
      )}

      {/* Edit caption dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Editar legenda</DialogTitle>
            <DialogDescription className="text-[12px]">
              Sua edição fica visível imediatamente.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={captionDraft}
            onChange={(e) => setCaptionDraft(e.target.value)}
            maxLength={2200}
            rows={5}
            placeholder="Escreva uma legenda…"
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-[14px] leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{captionDraft.length}/2200</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={savingEdit}>
              Cancelar
            </Button>
            <Button onClick={saveEdit} disabled={savingEdit}>
              {savingEdit ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Apagar post?</DialogTitle>
            <DialogDescription className="text-[12px]">
              Esta ação não pode ser desfeita. O post será removido do feed e do seu perfil.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={deletePost} disabled={deleting}>
              {deleting ? "Apagando…" : "Apagar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!commentsAsDialog && showComments && (
        <div className="border-t border-border">
          <div
            ref={inlineScrollRef}
            onScroll={onCommentsScroll}
            className="max-h-72 space-y-3 overflow-y-auto px-3 py-3"
          >
            <CommentsList
              roots={roots}
              repliesByParent={repliesByParent}
              loading={commentsLoading}
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              fetchNextPage={fetchNextPage}
              currentUserId={currentUserId}
              postOwnerId={post.user_id}
              onReply={(c) => setReplyingTo({ id: c.id, handle: c.profile?.handle ?? "user" })}
              onLikeToggle={toggleCommentLike}
              onDelete={deleteComment}
            />
          </div>
          <CommentForm
            body={body}
            setBody={setBody}
            sending={sending}
            replyingTo={replyingTo}
            cancelReply={() => setReplyingTo(null)}
            onSubmit={submitComment}
            disabled={!currentUserId}
            padded
          />
        </div>
      )}
      {commentsAsDialog && (
        <Dialog open={commentsOpen} onOpenChange={setCommentsOpen}>
          <DialogContent className="max-h-[85vh] overflow-hidden p-0 sm:max-w-md">
            <DialogHeader className="px-5 pt-5 pb-3">
              <DialogTitle className="text-[15px]">Comentários</DialogTitle>
            </DialogHeader>
            <div
              ref={dialogScrollRef}
              onScroll={onCommentsScroll}
              className="max-h-[60vh] space-y-3 overflow-y-auto px-5 pb-3"
            >
              <CommentsList
                roots={roots}
                repliesByParent={repliesByParent}
                loading={commentsLoading}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                fetchNextPage={fetchNextPage}
                currentUserId={currentUserId}
                postOwnerId={post.user_id}
                onReply={(c) => setReplyingTo({ id: c.id, handle: c.profile?.handle ?? "user" })}
                onLikeToggle={toggleCommentLike}
                onDelete={deleteComment}
              />
            </div>
            <CommentForm
              body={body}
              setBody={setBody}
              sending={sending}
              replyingTo={replyingTo}
              cancelReply={() => setReplyingTo(null)}
              onSubmit={submitComment}
              disabled={!currentUserId}
            />
          </DialogContent>
        </Dialog>
      )}
    </article>
  );
}

function CommentItem({
  c,
  depth,
  currentUserId,
  postOwnerId,
  onReply,
  onLikeToggle,
  onDelete,
}: {
  c: CommentRow;
  depth: number;
  currentUserId: string | null;
  postOwnerId: string;
  onReply: (c: CommentRow) => void;
  onLikeToggle: (id: string, liked: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const isOwn = c.user_id === currentUserId;
  const canDelete = isOwn || postOwnerId === currentUserId;
  return (
    <div className={`flex gap-2.5 ${depth > 0 ? "ml-7" : ""}`}>
      <VerifiedAvatar
        bucket="avatars"
        path={c.profile?.avatar_url ?? null}
        alt={c.profile?.display_name ?? ""}
        verified={false}
        className={depth > 0 ? "h-6 w-6 shrink-0" : "h-7 w-7 shrink-0"}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[12px]">
          <span className="font-semibold">@{c.profile?.handle ?? "user"}</span>{" "}
          <span className="text-foreground/90">{c.body}</span>
        </p>
        <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
          <button
            type="button"
            onClick={() => onLikeToggle(c.id, c.liked_by_me)}
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
          {currentUserId && (
            <button
              type="button"
              onClick={() => onReply(c)}
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <Reply className="h-3 w-3" strokeWidth={2.2} />
              Responder
            </button>
          )}
          {c.liked_by_author && c.user_id !== postOwnerId && (
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
              onSelect={() => onDelete(c.id)}
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
}

function CommentsList({
  roots,
  repliesByParent,
  loading,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  currentUserId,
  postOwnerId,
  onReply,
  onLikeToggle,
  onDelete,
}: {
  roots: CommentRow[];
  repliesByParent: Map<string, CommentRow[]>;
  loading: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  currentUserId: string | null;
  postOwnerId: string;
  onReply: (c: CommentRow) => void;
  onLikeToggle: (id: string, liked: boolean) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      {hasNextPage && (
        <button
          type="button"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="mx-auto flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          {isFetchingNextPage ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Ver comentários anteriores
        </button>
      )}
      {loading ? (
        <p className="text-center text-[12px] text-muted-foreground">Carregando…</p>
      ) : roots.length === 0 ? (
        <p className="text-center text-[12px] text-muted-foreground">Seja o primeiro a comentar.</p>
      ) : (
        roots.map((c) => (
          <div key={c.id} className="space-y-3">
            <CommentItem
              c={c}
              depth={0}
              currentUserId={currentUserId}
              postOwnerId={postOwnerId}
              onReply={onReply}
              onLikeToggle={onLikeToggle}
              onDelete={onDelete}
            />
            {(repliesByParent.get(c.id) ?? []).map((r) => (
              <CommentItem
                key={r.id}
                c={r}
                depth={1}
                currentUserId={currentUserId}
                postOwnerId={postOwnerId}
                onReply={onReply}
                onLikeToggle={onLikeToggle}
                onDelete={onDelete}
              />
            ))}
          </div>
        ))
      )}
    </>
  );
}

function CommentForm({
  body,
  setBody,
  sending,
  replyingTo,
  cancelReply,
  onSubmit,
  disabled,
  padded,
}: {
  body: string;
  setBody: (v: string) => void;
  sending: boolean;
  replyingTo: { id: string; handle: string } | null;
  cancelReply: () => void;
  onSubmit: (e: React.FormEvent) => void;
  disabled: boolean;
  padded?: boolean;
}) {
  return (
    <div className={`border-t border-border bg-card/95 ${padded ? "px-3 py-2" : "px-5 py-3"}`}>
      {replyingTo && (
        <div className="mb-2 flex items-center justify-between rounded-md bg-secondary/60 px-2 py-1 text-[11px] text-muted-foreground">
          <span>
            Respondendo a <span className="font-semibold text-foreground">@{replyingTo.handle}</span>
          </span>
          <button
            type="button"
            onClick={cancelReply}
            aria-label="Cancelar resposta"
            className="hover:text-foreground"
          >
            <X className="h-3 w-3" strokeWidth={2.2} />
          </button>
        </div>
      )}
      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            disabled
              ? "Faça login para comentar"
              : replyingTo
                ? `Responder @${replyingTo.handle}…`
                : "Adicione um comentário…"
          }
          disabled={disabled || sending}
          maxLength={500}
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={disabled || sending || !body.trim()}
          className="rounded-md px-3 py-2 text-[13px] font-medium text-primary-foreground disabled:opacity-50"
          style={{ background: "var(--gradient-brasa-h)" }}
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
