import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SignedImage } from "@/components/signed-image";
import { VerifiedBadge } from "@/components/verified-badge";
import { toast } from "sonner";

async function requireAdmin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw redirect({ to: "/auth" });
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const list = (roles ?? []).map((r) => r.role);
  if (!list.includes("admin")) throw redirect({ to: "/home" });
}

export const Route = createFileRoute("/_authenticated/admin/users")({
  ssr: false,
  beforeLoad: requireAdmin,
  component: UsersAdmin,
});

function UsersAdmin() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["adm-users", q],
    queryFn: async () => {
      let query = supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(50);
      if (q) query = query.or(`handle.ilike.%${q}%,display_name.ilike.%${q}%`);
      const { data } = await query;
      return data ?? [];
    },
  });

  async function act(userId: string, action: "ban" | "unban" | "shadow" | "unshadow" | "verify" | "unverify") {
    const { data: { user } } = await supabase.auth.getUser();
    const updates: any =
      action === "ban" ? { banned: true } :
      action === "unban" ? { banned: false } :
      action === "shadow" ? { shadow_banned: true } :
      action === "unshadow" ? { shadow_banned: false } :
      action === "verify" ? { verified: true, verified_at: new Date().toISOString() } :
      { verified: false };
    await supabase.from("profiles").update(updates).eq("user_id", userId);
    await supabase.from("audit_logs").insert({ admin_id: user!.id, action, target_type: "user", target_id: userId });
    toast.success("OK");
    qc.invalidateQueries({ queryKey: ["adm-users"] });
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Usuários</h1>
      <Input placeholder="Buscar @ ou nome" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="space-y-2">
        {(data ?? []).map((p: any) => (
          <Card key={p.user_id} className="flex flex-wrap items-center gap-3 p-3">
            <SignedImage bucket="avatars" path={p.avatar_url} alt={p.display_name} className="h-10 w-10 rounded-full object-cover" />
            <div className="flex-1 min-w-[120px]">
              <p className="text-sm font-semibold">{p.display_name} {p.verified && <VerifiedBadge />}</p>
              <p className="text-xs text-muted-foreground">@{p.handle} {p.banned && <span className="ml-1 rounded bg-destructive px-1 text-[10px] text-destructive-foreground">BANIDO</span>} {p.shadow_banned && <span className="ml-1 rounded bg-accent px-1 text-[10px] text-accent-foreground">SHADOW</span>}</p>
            </div>
            <div className="flex flex-wrap gap-1">
              <Button size="sm" variant="outline" onClick={() => act(p.user_id, p.verified ? "unverify" : "verify")}>{p.verified ? "Tirar selo" : "Verificar"}</Button>
              <Button size="sm" variant="outline" onClick={() => act(p.user_id, p.shadow_banned ? "unshadow" : "shadow")}>{p.shadow_banned ? "Desfazer shadow" : "Shadow"}</Button>
              <Button size="sm" variant={p.banned ? "outline" : "destructive"} onClick={() => act(p.user_id, p.banned ? "unban" : "ban")}>{p.banned ? "Desbanir" : "Banir"}</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
