import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

async function requireAdmin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw redirect({ to: "/auth" });
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const list = (roles ?? []).map((r) => r.role);
  if (!list.includes("admin")) throw redirect({ to: "/home" });
}

export const Route = createFileRoute("/_authenticated/admin/reports")({
  ssr: false,
  beforeLoad: requireAdmin,
  component: ReportsAdmin,
});

function ReportsAdmin() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["adm-reports"],
    queryFn: async () => {
      const { data } = await supabase
        .from("reports")
        .select("*")
        .eq("status", "open")
        .order("priority")
        .order("created_at");
      return data ?? [];
    },
  });

  async function resolve(r: any, action: "dismiss" | "shadow" | "ban" | "remove") {
    const { data: { user } } = await supabase.auth.getUser();
    if (action === "shadow" && r.target_type === "user") {
      await supabase.from("profiles").update({ shadow_banned: true }).eq("user_id", r.target_id);
    } else if (action === "ban" && r.target_type === "user") {
      await supabase.from("profiles").update({ banned: true }).eq("user_id", r.target_id);
    } else if (action === "remove" && r.target_type === "post") {
      await supabase.from("posts").update({ deleted_at: new Date().toISOString(), moderation_status: "rejected" }).eq("id", r.target_id);
    } else if (action === "remove" && r.target_type === "message") {
      await supabase.from("messages").update({ status: "removed" }).eq("id", r.target_id);
    } else if (action === "remove" && r.target_type === "comment") {
      await supabase.from("comments").update({ status: "removed" }).eq("id", r.target_id);
    }
    await supabase.from("reports").update({ status: action === "dismiss" ? "dismissed" : "resolved", handled_by: user!.id, handled_at: new Date().toISOString() }).eq("id", r.id);
    await supabase.from("audit_logs").insert({ admin_id: user!.id, action: `report_${action}`, target_type: r.target_type, target_id: r.target_id });
    toast.success("Resolvido");
    qc.invalidateQueries({ queryKey: ["adm-reports"] });
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Denúncias abertas</h1>
      {(data ?? []).map((r: any) => (
        <Card key={r.id} className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm"><strong>{r.target_type}</strong> · {r.reason} {r.priority <= 2 && <span className="ml-1 rounded bg-destructive px-1.5 text-[10px] text-destructive-foreground">URGENTE</span>}</p>
            <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</p>
          </div>
          <p className="mt-1 text-xs font-mono text-muted-foreground">target: {r.target_id}</p>
          {r.details && <p className="mt-2 text-sm">{r.details}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => resolve(r, "dismiss")}>Ignorar</Button>
            <Button size="sm" variant="secondary" onClick={() => resolve(r, "remove")}>Remover conteúdo</Button>
            {r.target_type === "user" && <Button size="sm" variant="secondary" onClick={() => resolve(r, "shadow")}>Shadow ban</Button>}
            {r.target_type === "user" && <Button size="sm" variant="destructive" onClick={() => resolve(r, "ban")}>Banir usuário</Button>}
          </div>
        </Card>
      ))}
      {data && data.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Sem denúncias abertas 🎉</p>}
    </div>
  );
}
