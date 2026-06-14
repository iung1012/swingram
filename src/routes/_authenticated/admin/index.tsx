import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/integrations/api/client";
import {
  Users,
  FileImage,
  Flag,
  ShieldCheck,
  ArrowUpRight,
  Activity,
  Inbox,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Admin — Brasa Swing" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [users, queuePending, postsPending, reportsOpen, verifPending] = await Promise.all([
        api.from("profiles").select("*", { count: "exact", head: true }),
        api.from("moderation_queue").select("*", { count: "exact", head: true }).eq("status", "pending"),
        api.from("posts").select("*", { count: "exact", head: true }).eq("moderation_status", "pending"),
        api.from("reports").select("*", { count: "exact", head: true }).eq("status", "open"),
        api.from("verification_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      return {
        users: users.count ?? 0,
        queuePending: queuePending.count ?? 0,
        postsPending: postsPending.count ?? 0,
        reportsOpen: reportsOpen.count ?? 0,
        verifPending: verifPending.count ?? 0,
      };
    },
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  const stats = [
    { label: "Na fila", value: data?.queuePending, icon: Inbox, to: "/admin/moderation", tone: "warn" as const },
    { label: "Usuários", value: data?.users, icon: Users, to: "/admin/users", tone: "neutral" as const },
    { label: "Posts pendentes", value: data?.postsPending, icon: FileImage, to: "/admin/posts", tone: "warn" as const },
    { label: "Denúncias abertas", value: data?.reportsOpen, icon: Flag, to: "/admin/reports", tone: "danger" as const },
    { label: "Verificações", value: data?.verifPending, icon: ShieldCheck, to: "/admin/verifications", tone: "accent" as const },
  ];

  return (
    <div className="pb-8">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Painel
          </p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight">Visão geral</h1>
        </div>
        <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-secondary/60 px-2 text-[11px] font-medium text-muted-foreground">
          <Activity className="h-3 w-3" strokeWidth={2.2} />
          Atualização automática
        </span>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} loading={isLoading} />
        ))}
      </div>

      <section className="mt-8 overflow-hidden rounded-2xl border border-border bg-card">
        <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-[13px] font-semibold tracking-tight">Ações rápidas</h2>
        </header>
        <div className="divide-y divide-border">
          <QuickRow to="/admin/moderation" label="Abrir fila de moderação" />
          <QuickRow to="/admin/verifications" label="Revisar verificações pendentes" />
          <QuickRow to="/admin/posts" label="Moderar posts" />
          <QuickRow to="/admin/reports" label="Tratar denúncias abertas" />
          <QuickRow to="/admin/banners" label="Gerenciar banners" />
          <QuickRow to="/admin/audit" label="Ver audit log" />
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  to,
  tone,
  loading,
}: {
  label: string;
  value: number | undefined;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  to: string;
  tone: "neutral" | "warn" | "danger" | "accent";
  loading: boolean;
}) {
  const dot =
    tone === "danger"
      ? "var(--destructive)"
      : tone === "warn"
      ? "var(--fire)"
      : tone === "accent"
      ? "var(--gold)"
      : "var(--muted-foreground)";
  return (
    <Link
      to={to as never}
      className="group relative flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:bg-secondary/40"
    >
      <div className="flex items-center justify-between">
        <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-secondary/60">
          <Icon className="h-3.5 w-3.5 text-foreground/80" strokeWidth={2.2} />
        </span>
        <ArrowUpRight
          className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          strokeWidth={2.2}
        />
      </div>
      <div className="mt-6">
        <div className="flex items-baseline gap-2">
          <p className="text-[28px] font-semibold tracking-tight leading-none tabular-nums">
            {loading ? "—" : value ?? 0}
          </p>
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: dot }}
            aria-hidden
          />
        </div>
        <p className="mt-1.5 text-[12px] text-muted-foreground">{label}</p>
      </div>
    </Link>
  );
}

function QuickRow({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to as never}
      className="flex h-12 items-center justify-between px-5 transition-colors hover:bg-secondary/40"
    >
      <span className="text-[14px] font-medium tracking-tight">{label}</span>
      <ArrowUpRight className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
    </Link>
  );
}

