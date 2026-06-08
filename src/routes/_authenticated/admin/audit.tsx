import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { requireAdmin } from "@/lib/admin-guard";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  ssr: false,
  beforeLoad: () => requireAdmin(),
  component: AuditAdmin,
});

function AuditAdmin() {
  const { data } = useQuery({
    queryKey: ["adm-audit"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("*, admin:profiles!audit_logs_admin_id_fkey(handle, display_name)")
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Audit log</h1>
      <p className="text-sm text-muted-foreground">Últimas 200 ações administrativas.</p>
      <div className="space-y-1.5">
        {(data ?? []).map((l: any) => (
          <Card key={l.id} className="p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p>
                <strong className="text-primary">{l.action}</strong>{" "}
                <span className="text-muted-foreground">em {l.target_type}</span>{" "}
                <code className="rounded bg-muted px-1 text-[10px]">{l.target_id}</code>
              </p>
              <p className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              por @{l.admin?.handle ?? "—"} {l.ip && `· ip ${l.ip}`}
            </p>
          </Card>
        ))}
        {data && data.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum log ainda.</p>}
      </div>
    </div>
  );
}
