import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Table = "likes" | "comments" | "comment_likes" | "notifications" | "posts";

/**
 * Subscribes to realtime changes on a table for a single post and invalidates
 * the supplied query keys when a change arrives.
 */
export function useRealtimePost(
  postId: string | null | undefined,
  opts?: { likes?: boolean; comments?: boolean; commentLikes?: boolean },
) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!postId) return;
    const channels: ReturnType<typeof supabase.channel>[] = [];
    const subscribe = (table: Table, filter: string, keys: string[][]) => {
      const ch = supabase
        .channel(`rt-${table}-${postId}-${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes" as never,
          { event: "*", schema: "public", table, filter } as never,
          () => {
            keys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
          },
        )
        .subscribe();
      channels.push(ch);
    };
    if (opts?.likes !== false) {
      subscribe("likes", `post_id=eq.${postId}`, [
        ["feed"],
        ["post-likes", postId],
        ["post", postId],
        ["post-likers", postId],
      ]);
    }
    if (opts?.comments !== false) {
      subscribe("comments", `post_id=eq.${postId}`, [
        ["feed"],
        ["post-comments", postId],
        ["post", postId],
      ]);
    }
    if (opts?.commentLikes !== false) {
      subscribe("comment_likes", `comment_id=neq.00000000-0000-0000-0000-000000000000`, [
        ["post-comments", postId],
      ]);
    }
    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [postId, qc, opts?.likes, opts?.comments, opts?.commentLikes]);
}

/**
 * Subscribes to new notifications for the given user and invalidates the
 * notifications query.
 */
export function useRealtimeNotifications(userId: string | null | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`rt-notifications-${userId}`)
      .on(
        "postgres_changes" as never,
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        } as never,
        () => {
          qc.invalidateQueries({ queryKey: ["notifications", userId] });
          qc.invalidateQueries({ queryKey: ["notifications-unread", userId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, qc]);
}
