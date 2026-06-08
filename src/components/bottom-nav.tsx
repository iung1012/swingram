import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, Map, MessageCircle, User, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { to: string; icon: typeof Home; label: string; primary?: boolean };
const items: NavItem[] = [
  { to: "/home", icon: Home, label: "Início" },
  { to: "/search", icon: Search, label: "Buscar" },
  { to: "/create", icon: Plus, label: "Postar", primary: true },
  { to: "/map", icon: Map, label: "Mapa" },
  { to: "/chat", icon: MessageCircle, label: "Chat" },
  { to: "/profile", icon: User, label: "Perfil" },
];

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/85 backdrop-blur-md">
      <ul className="mx-auto flex max-w-2xl items-center justify-around px-2 py-2">
        {items.map(({ to, icon: Icon, label, primary }) => {
          const active = pathname === to || (to !== "/home" && pathname.startsWith(to));
          return (
            <li key={to}>
              <Link
                to={to}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] font-medium transition",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  primary && "rounded-full bg-gradient-to-br from-primary to-accent px-4 py-3 text-primary-foreground shadow-lg",
                )}
              >
                <Icon className={cn(primary ? "h-6 w-6" : "h-5 w-5")} />
                {!primary && <span>{label}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
