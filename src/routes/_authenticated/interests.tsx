import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SignedImage } from "@/components/signed-image";
import { VerifiedBadge } from "@/components/verified-badge";
import { Flame, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/interests")({
  ssr: false,
  head: () => ({ meta: [{ title: "Interesses — Spark" }] }),
  component: InterestsPage,
});

function InterestsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data } = useQuery({
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
    await supabase.from("interests_sent").update({ status: accept ? "accepted" : "rejected", responded_at: new Date().toISOString() }).eq("id", id);
    if (accept) {
      const a = user!.id < fromUser ? user!.id : fromUser;
      const b = user!.id < fromUser ? fromUser : user!.id;
      // Try create conversation
      await supabase.from("conversations").upsert({ user_a: a, user_b: b, unlocked: true }, { onConflict: "user_a,user_b" });
      toast.success("Aceito! Super chat liberado.");
    } else toast("Rejeitado");
    qc.invalidateQueries({ queryKey: ["interests-inbox"] });
  }

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <h1 className="mb-3 flex items-center gap-2 text-xl font-bold"><Flame className="text-primary" /> Interesses recebidos</h1>
      <div className="space-y-2">
        {(data ?? []).map((r: any) => (
          <Card key={r.id} className="flex items-center gap-3 p-3">
            <SignedImage bucket="avatars" path={r.sender?.avatar_url} alt={r.sender?.display_name} className="h-12 w-12 rounded-full object-cover" />
            <div className="flex-1">
              <p className="text-sm font-semibold">{r.sender?.display_name} {r.sender?.verified && <VerifiedBadge />}</p>
              <p className="text-xs text-muted-foreground">@{r.sender?.handle}</p>
            </div>
            <Button size="icon" variant="default" onClick={() => respond(r.id, r.from_user, true)} aria-label="Aceitar"><Check className="h-4 w-4" /></Button>
            <Button size="icon" variant="outline" onClick={() => respond(r.id, r.from_user, false)} aria-label="Rejeitar"><X className="h-4 w-4" /></Button>
          </Card>
        ))}
        {data && data.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum interesse pendente.</p>}
      </div>
    </div>
  );
}
