import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { VerifiedAvatar } from "@/components/verified-avatar";
import { VerifiedBadge } from "@/components/verified-badge";
import { Flame, Check, X, Inbox } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/interests")({
  ssr: false,
  head: () => ({ meta: [{ title: "Interesses — Brasa Swing" }] }),
  component: InterestsPage,
});

function InterestsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["interests-inbox", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("interests_sent")
        .select(`id, from_user, to_user, status, created_at,
          sender:profiles!interests_sent_from_user_fkey(handle, display_name, avatar_url, verified)`)
        .eq("to_user", user!.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function respond(id: string, fromUser: string, accept: boolean) {
    await supabase
      .from("interests_sent")
      .update({ status: accept ? "accepted" : "rejected", responded_at: new Date().toISOString() })
      .eq("id", id);
    if (accept) {
      const a = user!.id < fromUser ? user!.id : fromUser;
      const b = user!.id < fromUser ? fromUser : user!.id;
      await supabase
        .from("conversations")
        .upsert({ user_a: a, user_b: b, unlocked: true }, { onConflict: "user_a,user_b" });
      toast.success("Aceito. Super chat liberado.");
    } else toast("Rejeitado");
    qc.invalidateQueries({ queryKey: ["interests-inbox"] });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-8 pt-6">
      <header className="mb-5 flex items-end justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Solicitações
          </p>
          <h1 className="mt-1 inline-flex items-center gap-2 text-[26px] font-semibold tracking-tight">
            <Flame className="h-5 w-5 text-primary" strokeWidth={2.2} />
            Interesses
          </h1>
        </div>
      </header>

      {isLoading ? (
        <div className="h-20 animate-pulse rounded-2xl border border-border bg-card/60" />
      ) : !data || data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 px-5 py-12 text-center">
          <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-secondary/60">
            <Inbox className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
          </span>
          <p className="text-[13px] text-muted-foreground">Nenhum interesse pendente.</p>
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="divide-y divide-border">
            {data.map((r: any) => (
              <div key={r.id} className="flex items-center gap-3 px-3 py-3">
                <SignedImage
                  bucket="avatars"
                  path={r.sender?.avatar_url}
                  alt={r.sender?.display_name}
                  className="h-11 w-11 rounded-full object-cover ring-1 ring-border"
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate text-[14px] font-medium tracking-tight">
                    {r.sender?.display_name}
                    {r.sender?.verified && <VerifiedBadge />}
                  </p>
                  <p className="truncate text-[12px] text-muted-foreground">
                    @{r.sender?.handle}
                  </p>
                </div>
                <button
                  onClick={() => respond(r.id, r.from_user, false)}
                  aria-label="Rejeitar"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-secondary/60 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" strokeWidth={2.2} />
                </button>
                <button
                  onClick={() => respond(r.id, r.from_user, true)}
                  aria-label="Aceitar"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-primary-foreground transition active:scale-95"
                  style={{ background: "var(--gradient-brasa-h)" }}
                >
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
