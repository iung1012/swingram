import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MoreHorizontal, MessageCircle, Bookmark, BookmarkCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FireLike } from "./fire-like";
import { SignedImage } from "./signed-image";
import { VerifiedAvatar } from "./verified-avatar";
import { VerifiedBadge } from "./verified-badge";
import { ReportDialog } from "./report-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

type Media = { url: string; order: number };
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
}: {
  post: PostCardData;
  currentUserId: string | null;
  defaultBlur: boolean;
}) {
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likes, setLikes] = useState(post.likes_count);
  const [saved, setSaved] = useState(post.saved_by_me);
  const [revealed, setRevealed] = useState(!post.nsfw || !defaultBlur);
  const [active, setActive] = useState(0);

  useEffect(() => setRevealed(!post.nsfw || !defaultBlur), [post.nsfw, defaultBlur]);

  async function toggleLike() {
    if (!currentUserId) return;
    const next = !liked;
    setLiked(next);
    setLikes((l) => l + (next ? 1 : -1));
    if (next) await supabase.from("likes").insert({ post_id: post.id, user_id: currentUserId });
    else await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", currentUserId);
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
          <div className="relative">
            <div
              className="absolute -inset-0.5 rounded-full opacity-70"
              style={{ background: "var(--gradient-brasa-h)" }}
            />
            <SignedImage
              bucket="avatars"
              path={post.author.avatar_url}
              alt={post.author.display_name}
              className="relative h-9 w-9 rounded-full object-cover ring-2 ring-card"
            />
          </div>
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

      <div className="relative aspect-square w-full overflow-hidden border-y border-border bg-black">
        <button
          type="button"
          onClick={() => !revealed && setRevealed(true)}
          className="block h-full w-full"
          aria-label={revealed ? "Foto" : "Conteúdo sensível — toque para ver"}
        >
          <SignedImage
            bucket="posts"
            path={post.media[active]?.url}
            alt=""
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
                aria-label={`Foto ${i + 1}`}
                className={`h-1 rounded-full transition-all ${
                  i === active ? "w-5 bg-white" : "w-1 bg-white/40"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-4">
          <FireLike liked={liked} count={likes} onToggle={toggleLike} disabled={!currentUserId} />
          <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <MessageCircle className="h-4 w-4" strokeWidth={2.2} />
            {post.comments_count}
          </span>
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
        <p className="px-3 pb-3 text-[13px] leading-relaxed text-foreground/90">
          <Link
            to={"/u/$handle" as never}
            params={{ handle: post.author.handle } as never}
            className="mr-1.5 font-semibold tracking-tight"
          >
            @{post.author.handle}
          </Link>
          {post.caption}
        </p>
      )}
    </article>
  );
}
