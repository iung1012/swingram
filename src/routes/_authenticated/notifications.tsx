import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, ChevronLeft, Heart, MessageCircle, CornerDownRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { VerifiedAvatar } from "@/components/verified-avatar";
import { VerifiedBadge } from "@/components/verified-badge";
import { SpiralLoaderBlock } from "@/components/spiral-loader";
import { useRealtimeNotifications } from "@/hooks/use-realtime";

export const Route = createFileRoute("/_authenticated/notifications")({
  ssr: false,
  head: () => ({ meta: [{ title: "Notificações — Brasa Swing" }] }),
  component: Notifications,
});

function Notifications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useRealtimeNotifications(user?.id);

  const { data, isLoading } = useQuery({
    queryKey: ["notifications", user?.id ?? null],
    enabled: !!user,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("notifications")
        .select("id, actor_id, type, post_id, comment_id, read_at, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      const ids = Array.from(new Set((rows ?? []).map((r) => r.actor_id)));
      let actors = new Map<string, { handle: string; display_name: string; avatar_url: string | null; verified: boolean }>();
      if (ids.length) {
        const { data: ps } = await supabase
          .from("profiles")
          .select("user_id, handle, display_name, avatar_url, verified")
          .in("user_id", ids);
        actors = new Map(
          (ps ?? []).map((p) => [
            p.user_id,
            {
              handle: p.handle,
              display_name: p.display_name,
              avatar_url: p.avatar_url,
              verified: p.verified,
            },
          ]),
        );
      }
      return (rows ?? []).map((r) => ({ ...r, actor: actors.get(r.actor_id) }));
    },
  });

  // Mark unread as read on view.
  useEffect(() => {
    if (!user || !data || data.length === 0) return;
    const unread = data.filter((n) => !n.read_at).map((n) => n.id);
    if (!unread.length) return;
    supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", unread)
      .then(() => {
        qc.invalidateQueries({ queryKey: ["notifications", user.id] });
        qc.invalidateQueries({ queryKey: ["notifications-unread", user.id] });
      });
  }, [user, data, qc]);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-12 pt-6">
      <Link
        to="/home"
        className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={2.2} />
        Voltar
      </Link>

      <header className="mb-5 flex items-center gap-2">
        <Bell className="h-5 w-5 text-primary" strokeWidth={2.2} />
        <h1 className="text-[22px] font-semibold tracking-tight">Notificações</h1>
      </header>

      {isLoading ? (
        <SpiralLoaderBlock />
      ) : !data || data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 px-4 py-12 text-center text-[13px] text-muted-foreground">
          Sem notificações ainda.
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-border bg-card">
          {data.map((n) => {
            const a = n.actor;
            const Icon = n.type === "like" ? Heart : n.type === "reply" ? CornerDownRight : MessageCircle;
            const verb =
              n.type === "like" ? "curtiu seu post" : n.type === "reply" ? "respondeu seu comentário" : "comentou no seu post";
            return (
              <li key={n.id} className={`border-b border-border last:border-b-0 ${!n.read_at ? "bg-primary/5" : ""}`}>
                <Link
                  to={n.post_id ? ("/post/$id" as never) : ("/home" as never)}
                  params={n.post_id ? ({ id: n.post_id } as never) : (undefined as never)}
                  className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-secondary/40"
                >
                  <div className="relative">
                    <VerifiedAvatar
                      bucket="avatars"
                      path={a?.avatar_url}
                      alt={a?.display_name ?? ""}
                      verified={a?.verified ?? false}
                      className="h-10 w-10"
                    />
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background">
                      <Icon className="h-2.5 w-2.5 text-primary" strokeWidth={2.4} />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px]">
                      <span className="inline-flex items-center gap-1 font-semibold">
                        {a?.display_name ?? "Alguém"}
                        {a?.verified && <VerifiedBadge />}
                      </span>{" "}
                      <span className="text-muted-foreground">{verb}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {timeAgo(n.created_at)}
                    </p>
                  </div>
                  {!n.read_at && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function timeAgo(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}
