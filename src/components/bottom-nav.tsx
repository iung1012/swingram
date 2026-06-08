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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/70 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-2xl items-center justify-around px-2 py-1.5">
        {items.map(({ to, icon: Icon, label, primary }) => {
          const active = pathname === to || (to !== "/home" && pathname.startsWith(to));
          if (primary) {
            return (
              <li key={to} className="-mt-6">
                <Link
                  to={to as never}
                  className="flex h-14 w-14 items-center justify-center rounded-full text-primary-foreground shadow-[var(--shadow-brasa)] transition active:scale-95"
                  style={{ background: "var(--gradient-brasa-h)" }}
                  aria-label={label}
                >
                  <Icon className="h-7 w-7" strokeWidth={2.5} />
                </Link>
              </li>
            );
          }
          return (
            <li key={to}>
              <Link
                to={to as never}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] font-medium transition",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("h-5 w-5", active && "drop-shadow-[0_0_6px_oklch(0.7_0.22_45/0.6)]")} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
