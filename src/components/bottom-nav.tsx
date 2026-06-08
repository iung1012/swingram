import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Map, MessageCircle, User, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { to: string; icon: typeof Home; label: string; primary?: boolean };
const items: NavItem[] = [
  { to: "/home", icon: Home, label: "Início" },
  { to: "/map", icon: Map, label: "Mapa" },
  { to: "/create", icon: Plus, label: "Postar", primary: true },
  { to: "/chat", icon: MessageCircle, label: "Chat" },
  { to: "/profile", icon: User, label: "Perfil" },
];

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/85 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-2xl items-center justify-around px-3 py-1.5">
        {items.map(({ to, icon: Icon, label, primary }) => {
          const active = pathname === to || (to !== "/home" && pathname.startsWith(to));
          if (primary) {
            return (
              <li key={to} className="-mt-7">
                <Link
                  to={to as never}
                  className="flex h-14 w-14 items-center justify-center rounded-full text-primary-foreground shadow-[var(--shadow-brasa)] transition active:scale-95"
                  style={{ background: "var(--gradient-brasa-h)" }}
                  aria-label={label}
                >
                  <Icon className="h-6 w-6" strokeWidth={2.4} />
                </Link>
              </li>
            );
          }
          return (
            <li key={to}>
              <Link
                to={to as never}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 rounded-md px-3 py-1.5 text-[10px] font-medium tracking-tight transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon
                  className={cn("h-[18px] w-[18px]", active && "text-primary")}
                  strokeWidth={2.2}
                />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
