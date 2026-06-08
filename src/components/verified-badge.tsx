import { BadgeCheck } from "lucide-react";

export function VerifiedBadge({ size = 16 }: { size?: number }) {
  return <BadgeCheck className="inline text-primary" size={size} aria-label="Perfil verificado" />;
}
