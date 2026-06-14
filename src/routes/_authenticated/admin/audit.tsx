import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/integrations/api/client";
import { requireStaff } from "@/lib/admin-guard";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  ssr: false,
  beforeLoad: () => requireStaff(),
  component: AuditAdmin,
});

function AuditAdmin() {
  const { data } = useQuery({
    queryKey: ["adm-audit"],
    queryFn: async () => {
      const { data: logs } = await api
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      const ids = Array.from(new Set((logs ?? []).map((l: any) => l.admin_id).filter(Boolean)));
      let profMap = new Map<string, any>();
      if (ids.length > 0) {
        const { data: profs } = await api.from("profiles").select("user_id, handle").in("user_id", ids);
        profMap = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
      }
      return (logs ?? []).map((l: any) => ({ ...l, admin: l.admin_id ? profMap.get(l.admin_id) : null }));
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

