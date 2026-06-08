import { useState } from "react";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

export function FireLike({
  liked,
  count,
  onToggle,
  disabled,
}: {
  liked: boolean;
  count: number;
  onToggle: () => void;
  disabled?: boolean;
}) {
  const [bursting, setBursting] = useState(false);

  function handle() {
    if (disabled) return;
    if (!liked) {
      setBursting(true);
      setTimeout(() => setBursting(false), 600);
    }
    onToggle();
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={disabled}
      className="relative inline-flex items-center gap-1.5 text-sm font-medium text-foreground transition hover:text-fire disabled:opacity-50"
      aria-pressed={liked}
      aria-label="Curtir com fogo"
    >
      <span className="relative">
        <Flame
          className={cn(
            "h-6 w-6 transition",
            liked ? "text-fire fill-fire" : "text-muted-foreground",
            bursting && "fire-pop",
          )}
        />
        {bursting && (
          <>
            <Flame className="fire-spark pointer-events-none absolute -top-1 left-1 h-3 w-3 text-fire" />
            <Flame className="fire-spark pointer-events-none absolute -top-1 left-3 h-3 w-3 text-accent" style={{ animationDelay: "0.08s" }} />
            <Flame className="fire-spark pointer-events-none absolute -top-1 right-1 h-3 w-3 text-primary" style={{ animationDelay: "0.16s" }} />
          </>
        )}
      </span>
      <span className="tabular-nums">{count}</span>
    </button>
  );
}
