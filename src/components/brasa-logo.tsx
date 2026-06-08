import logo from "@/assets/brasa-logo.png";
import { cn } from "@/lib/utils";

export function BrasaLogo({ className, glow = false }: { className?: string; glow?: boolean }) {
  return (
    <img
      src={logo}
      alt="Brasa Swing"
      className={cn("select-none object-contain", glow && "brasa-glow", className)}
      draggable={false}
    />
  );
}

export function BrasaWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "bg-clip-text font-display font-bold tracking-tight text-transparent",
        className,
      )}
      style={{ backgroundImage: "var(--gradient-brasa-h)" }}
    >
      Brasa Swing
    </span>
  );
}
