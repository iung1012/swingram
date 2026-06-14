import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

// The self-hosted backend does not expose a realtime/websocket channel, so we
// fall back to lightweight polling: while the tab is visible we periodically
// invalidate the relevant query keys, keeping counts and lists eventually
// fresh without holding a persistent connection.
const POLL_MS = 15000;

function usePolledInvalidation(enabled: boolean, keys: string[][], deps: unknown[]) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled || keys.length === 0) return;
    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      keys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    };
    const id = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Keeps the like/comment data for a single post fresh by polling while the
 * post is on screen.
 */
export function useRealtimePost(
  postId: string | null | undefined,
  opts?: { likes?: boolean; comments?: boolean; commentLikes?: boolean },
) {
  const keys: string[][] = [];
  if (postId) {
    if (opts?.likes !== false) keys.push(["post-likes", postId], ["post-likers", postId]);
    if (opts?.comments !== false) keys.push(["post-comments", postId]);
    keys.push(["post", postId]);
  }
  usePolledInvalidation(!!postId, keys, [postId, opts?.likes, opts?.comments, opts?.commentLikes]);
}

/**
 * Keeps the notification list/badge fresh for the given user by polling while
 * the tab is visible.
 */
export function useRealtimeNotifications(userId: string | null | undefined) {
  const keys: string[][] = userId
    ? [["notifications", userId], ["notifications-unread", userId]]
    : [];
  usePolledInvalidation(!!userId, keys, [userId]);
}
