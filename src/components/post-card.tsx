import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MoreVertical, MessageCircle, Bookmark, BookmarkCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FireLike } from "./fire-like";
import { SignedImage } from "./signed-image";
import { VerifiedBadge } from "./verified-badge";
import { ReportDialog } from "./report-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
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

export function PostCard({ post, currentUserId, defaultBlur }: { post: PostCardData; currentUserId: string | null; defaultBlur: boolean }) {
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
    if (next) {
      await supabase.from("likes").insert({ post_id: post.id, user_id: currentUserId });
    } else {
      await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", currentUserId);
    }
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
    const { error } = await supabase.from("blocks").insert({ user_id: currentUserId, blocked_user_id: post.user_id });
    if (error) toast.error("Falha ao bloquear");
    else toast.success("Usuário bloqueado");
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <header className="flex items-center justify-between gap-2 p-3">
        <Link to={"/u/$handle" as never} params={{ handle: post.author.handle } as never} className="flex items-center gap-2 group">
          <SignedImage
            bucket="avatars"
            path={post.author.avatar_url}
            alt={post.author.display_name}
            className="h-9 w-9 rounded-full object-cover"
          />
          <div>
            <p className="text-sm font-semibold leading-tight group-hover:underline">
              {post.author.display_name} {post.author.verified && <VerifiedBadge />}
            </p>
            <p className="text-xs text-muted-foreground">@{post.author.handle}</p>
          </div>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Mais"><MoreVertical className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <ReportDialog targetType="post" targetId={post.id} trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Denunciar post</DropdownMenuItem>} />
            <ReportDialog targetType="user" targetId={post.user_id} trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Denunciar perfil</DropdownMenuItem>} />
            <DropdownMenuItem onSelect={blockAuthor}>Bloquear usuário</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="relative aspect-square w-full bg-black">
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
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-semibold text-white">
              Conteúdo sensível — toque para ver
            </span>
          )}
        </button>
        {post.media.length > 1 && (
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
            {post.media.map((_, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                aria-label={`Foto ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === active ? "w-6 bg-white" : "w-1.5 bg-white/50"}`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-4">
          <FireLike liked={liked} count={likes} onToggle={toggleLike} disabled={!currentUserId} />
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <MessageCircle className="h-5 w-5" /> {post.comments_count}
          </span>
        </div>
        <button onClick={toggleSave} aria-label="Salvar" className="text-muted-foreground hover:text-foreground">
          {saved ? <BookmarkCheck className="h-5 w-5 text-primary" /> : <Bookmark className="h-5 w-5" />}
        </button>
      </div>
      {post.caption && (
        <p className="px-3 pb-3 text-sm">
          <Link to="/u/$handle" params={{ handle: post.author.handle }} className="mr-1.5 font-semibold">@{post.author.handle}</Link>
          {post.caption}
        </p>
      )}
    </article>
  );
}
