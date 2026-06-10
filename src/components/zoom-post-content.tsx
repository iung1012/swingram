import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/integrations/api/client";
import { SignedMedia } from "@/components/signed-media";
import { VerifiedAvatar } from "@/components/verified-avatar";
import { FireLike } from "@/components/fire-like";
import { renderCaption } from "@/lib/hashtags";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";

export function ZoomPostContent({
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

  const { data: likeData } = useQuery({
    queryKey: ["post-likes", postId, currentUserId],
    queryFn: async () => {
      const { count } = await api
        .from("likes")
        .select("post_id", { count: "exact", head: true })
        .eq("post_id", postId);
      let likedByMe = false;
      if (currentUserId) {
        const { data: me } = await api
          .from("likes")
          .select("post_id")
          .eq("post_id", postId)
          .eq("user_id", currentUserId)
          .maybeSingle();
        likedByMe = !!me;
      }
      return { likes: count ?? 0, likedByMe };
    },
  });

  const liked = likeData?.likedByMe ?? false;
  const likes = likeData?.likes ?? 0;

  async function toggleLike() {
    if (!currentUserId) return;
    const key = ["post-likes", postId, currentUserId];
    const prev = qc.getQueryData<{ likes: number; likedByMe: boolean }>(key);
    const next = !(prev?.likedByMe ?? liked);
    qc.setQueryData(key, {
      likes: (prev?.likes ?? likes) + (next ? 1 : -1),
      likedByMe: next,
    });
    if (next) {
      await api.from("likes").insert({ post_id: postId, user_id: currentUserId });
    } else {
      await api.from("likes").delete().eq("post_id", postId).eq("user_id", currentUserId);
    }
    qc.invalidateQueries({ queryKey: ["post-likes", postId] });
    qc.invalidateQueries({ queryKey: ["feed"] });
    qc.invalidateQueries({ queryKey: ["profile-stats"] });
  }

  const { data: comments } = useQuery({
    queryKey: ["post-comments", postId],
    queryFn: async () => {
      const { data: cs } = await api
        .from("comments")
        .select("id, user_id, body, created_at")
        .eq("post_id", postId)
        .eq("status", "visible")
        .order("created_at", { ascending: true })
        .limit(100);
      const ids = Array.from(new Set((cs ?? []).map((c) => c.user_id)));
      let profilesMap = new Map<string, any>();
      if (ids.length) {
        const { data: ps } = await api
          .from("profiles")
          .select("user_id, handle, display_name, avatar_url, verified")
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
    const { error } = await api.from("comments").insert({
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
        "grid min-h-0 flex-1 grid-cols-1 overflow-hidden " +
        (showMediaPane ? "md:grid-cols-[1.2fr_1fr]" : "")
      }
    >
      {showMediaPane && (
        <div className="flex max-h-[40vh] items-center justify-center bg-black md:max-h-none">
          <SignedMedia
            bucket="posts"
            path={url}
            kind={kind === "video" ? "video" : "image"}
            alt=""
            controls={kind === "video"}
            className="h-full max-h-[40vh] w-full object-contain md:max-h-none"
          />
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5">
          <FireLike
            liked={liked}
            count={likes}
            onToggle={toggleLike}
            disabled={!currentUserId}
          />
          <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <MessageCircle className="h-3.5 w-3.5" strokeWidth={2.2} />
            {(comments ?? []).length}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {caption && (
            <div className="whitespace-pre-wrap border-b border-border px-4 py-3 text-[14px] leading-relaxed text-foreground/90">
              {renderCaption(caption)}
            </div>
          )}
          <div className="space-y-3 px-4 py-3">
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
                    verified={!!c.profile?.verified}
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
        </div>
        <form
          onSubmit={submit}
          className="flex shrink-0 items-center gap-2 border-t border-border bg-card/95 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur"
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

