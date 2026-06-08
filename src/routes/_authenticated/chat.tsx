import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SignedImage } from "@/components/signed-image";
import { VerifiedBadge } from "@/components/verified-badge";
import { Button } from "@/components/ui/button";
import { Flame } from "lucide-react";

export const Route = createFileRoute("/_authenticated/chat")({
  ssr: false,
  head: () => ({ meta: [{ title: "Chat — Brasa Swing" }] }),
  component: ChatList,
});

function ChatList() {
  const { user } = useAuth();
  const { data: convs } = useQuery({
    queryKey: ["convs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("conversations")
        .select("id, user_a, user_b, unlocked")
        .or(`user_a.eq.${user!.id},user_b.eq.${user!.id}`)
        .eq("unlocked", true);
      const others = (data ?? []).map((c) => ({ id: c.id, other: c.user_a === user!.id ? c.user_b : c.user_a }));
      if (others.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, handle, display_name, avatar_url, verified")
        .in("user_id", others.map((o) => o.other));
      const profMap = new Map((profs ?? []).map((p) => [p.user_id, p]));
      return others.map((o) => ({ id: o.id, profile: profMap.get(o.other) }));
    },
  });

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-bold">Conversas</h1>
        <Button asChild variant="outline" size="sm"><Link to="/interests"><Flame className="mr-1 h-4 w-4" />Interesses</Link></Button>
      </div>
      <div className="space-y-2">
        {(convs ?? []).map((c: any) => c.profile && (
          <Link key={c.id} to={"/chat/$id" as never} params={{ id: c.id } as never} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:bg-secondary">
            <SignedImage bucket="avatars" path={c.profile.avatar_url} alt={c.profile.display_name} className="h-12 w-12 rounded-full object-cover" />
            <div className="flex-1">
              <p className="text-sm font-semibold">{c.profile.display_name} {c.profile.verified && <VerifiedBadge />}</p>
              <p className="text-xs text-muted-foreground">@{c.profile.handle}</p>
            </div>
          </Link>
        ))}
        {convs && convs.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma conversa ainda. Envie interesse para alguém!</p>}
      </div>
    </div>
  );
}
