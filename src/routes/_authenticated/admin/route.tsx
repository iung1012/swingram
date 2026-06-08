import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, ShieldCheck, FileImage, Flag, Users, Image as ImageIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const list = (roles ?? []).map((r) => r.role);
    if (!list.includes("admin") && !list.includes("moderator") && !list.includes("support")) {
      throw redirect({ to: "/home" });
    }
    return { roles: list };
  },
  component: AdminLayout,
});

const ITEMS = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { to: "/admin/verifications", icon: ShieldCheck, label: "Verificações" },
  { to: "/admin/posts", icon: FileImage, label: "Posts" },
  { to: "/admin/reports", icon: Flag, label: "Denúncias" },
  { to: "/admin/users", icon: Users, label: "Usuários" },
  { to: "/admin/banners", icon: ImageIcon, label: "Banners" },
];

function AdminLayout() {
  return (
    <div className="mx-auto max-w-5xl px-3 pt-4">
      <nav className="mb-4 flex flex-wrap gap-1.5 overflow-x-auto rounded-xl border border-border bg-card p-1.5">
        {ITEMS.map(({ to, icon: Icon, label }) => (
          <Link key={to} to={to as never} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground [&.active]:bg-primary [&.active]:text-primary-foreground" activeOptions={{ exact: to === "/admin" }}>
            <Icon className="h-4 w-4" />{label}
          </Link>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
