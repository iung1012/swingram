import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/integrations/api/client";
import { useAuth } from "@/hooks/use-auth";
import { VerifiedAvatar } from "@/components/verified-avatar";
import { VerifiedBadge } from "@/components/verified-badge";
import { Flame, ChevronRight, Inbox } from "lucide-react";

export const Route = createFileRoute("/_authenticated/chat")({
  ssr: false,
  head: () => ({ meta: [{ title: "Chat — Brasa Swing" }] }),
  component: ChatList,
});

function ChatList() {
  const { user } = useAuth();
  const { data: convs, isLoading } = useQuery({
    queryKey: ["convs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await api
        .from("conversations")
        .select("id, user_a, user_b, unlocked")
        .or(`user_a.eq.${user!.id},user_b.eq.${user!.id}`)
        .eq("unlocked", true);
      const others = (data ?? []).map((c) => ({
        id: c.id,
        other: c.user_a === user!.id ? c.user_b : c.user_a,
      }));
      if (others.length === 0) return [];
      const { data: profs } = await api
        .from("profiles")
        .select("user_id, handle, display_name, avatar_url, verified")
        .in("user_id", others.map((o) => o.other));
      const profMap = new Map((profs ?? []).map((p) => [p.user_id, p]));
      return others.map((o) => ({ id: o.id, profile: profMap.get(o.other) }));
    },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 pb-8 pt-6">
      <header className="mb-5 flex items-end justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Mensagens
          </p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight">Conversas</h1>
        </div>
        <Link
          to="/interests"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-3 text-[13px] font-medium tracking-tight hover:bg-secondary"
        >
          <Flame className="h-3.5 w-3.5 text-primary" strokeWidth={2.2} />
          Interesses
        </Link>
      </header>

      {isLoading ? (
        <div className="h-20 animate-pulse rounded-2xl border border-border bg-card/60" />
      ) : !convs || convs.length === 0 ? (
        <EmptyState />
      ) : (
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="divide-y divide-border">
            {convs.map(
              (c: any) =>
                c.profile && (
                  <Link
                    key={c.id}
                    to={"/chat/$id" as never}
                    params={{ id: c.id } as never}
                    className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-secondary/40"
                  >
                    <VerifiedAvatar
                      bucket="avatars"
                      path={c.profile.avatar_url}
                      alt={c.profile.display_name}
                      verified={c.profile.verified}
                      className="h-11 w-11"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1 truncate text-[14px] font-medium tracking-tight">
                        {c.profile.display_name}
                        {c.profile.verified && <VerifiedBadge />}
                      </p>
                      <p className="truncate text-[12px] text-muted-foreground">
                        @{c.profile.handle}
                      </p>
                    </div>
                    <ChevronRight
                      className="h-4 w-4 text-muted-foreground"
                      strokeWidth={2}
                    />
                  </Link>
                ),
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 px-5 py-12 text-center">
      <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-secondary/60">
        <Inbox className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
      </span>
      <p className="text-[13px] text-muted-foreground">
        Nenhuma conversa ainda. Envie interesse para alguém.
      </p>
    </div>
  );
}

