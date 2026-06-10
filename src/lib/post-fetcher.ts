import { api } from "@/integrations/api/client";
import type { PostCardData } from "@/components/post-card";

/**
 * Build a single PostCardData object for one post id. Used by the post detail
 * page and anywhere else that needs to render a post in isolation.
 */
export async function fetchPostById(
  postId: string,
  currentUserId: string | null,
): Promise<PostCardData | null> {
  const { data: post, error } = await api
    .from("posts")
    .select(`id, user_id, caption, nsfw, created_at, post_media(url, order, kind)`)
    .eq("id", postId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !post) return null;

  const { data: author } = await api
    .from("profiles")
    .select("user_id, handle, display_name, avatar_url, verified")
    .eq("user_id", post.user_id)
    .maybeSingle();
  if (!author) return null;

  const [{ data: likes }, { data: comments }, savesRes] = await Promise.all([
    api.from("likes").select("user_id").eq("post_id", post.id),
    api.from("comments").select("id").eq("post_id", post.id).eq("status", "visible"),
    currentUserId
      ? api.from("saves").select("post_id").eq("user_id", currentUserId).eq("post_id", post.id)
      : Promise.resolve({ data: [] as Array<{ post_id: string }> }),
  ]);

  const likesCount = (likes ?? []).length;
  const likedByMe = !!currentUserId && (likes ?? []).some((l) => l.user_id === currentUserId);
  const commentsCount = (comments ?? []).length;
  const savedByMe = (savesRes?.data ?? []).length > 0;

  const paths = (post.post_media ?? []).map((m) => m.url).filter(Boolean);
  const signedMap = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await api.storage.from("posts").createSignedUrls(paths, 3600);
    (signed ?? []).forEach((s) => {
      if (s.path && s.signedUrl) signedMap.set(s.path, s.signedUrl);
    });
  }

  return {
    id: post.id,
    user_id: post.user_id,
    caption: post.caption,
    nsfw: post.nsfw,
    created_at: post.created_at,
    author: {
      handle: author.handle,
      display_name: author.display_name,
      avatar_url: author.avatar_url,
      verified: author.verified,
    },
    media: (post.post_media ?? [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((m) => ({
        url: signedMap.get(m.url) ?? m.url,
        order: m.order,
        kind: (m.kind ?? "image") as "image" | "video",
      })),
    likes_count: likesCount,
    liked_by_me: likedByMe,
    saved_by_me: savedByMe,
    comments_count: commentsCount,
  };
}

