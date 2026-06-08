import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Admin — Brasa Swing" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [users, postsPending, reportsOpen, verifPending] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("posts").select("*", { count: "exact", head: true }).eq("moderation_status", "pending"),
        supabase.from("reports").select("*", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("verification_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      return {
        users: users.count ?? 0,
        postsPending: postsPending.count ?? 0,
        reportsOpen: reportsOpen.count ?? 0,
        verifPending: verifPending.count ?? 0,
      };
    },
  });

  const stats = [
    { label: "Usuários", value: data?.users ?? "..." },
    { label: "Posts pendentes", value: data?.postsPending ?? "..." },
    { label: "Denúncias abertas", value: data?.reportsOpen ?? "..." },
    { label: "Verificações pendentes", value: data?.verifPending ?? "..." },
  ];

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Painel administrativo</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-bold">{s.value}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
