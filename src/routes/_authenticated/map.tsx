import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile } from "@/hooks/use-profile";
import { distanceKm } from "@/lib/geo";
import { Card } from "@/components/ui/card";
import { SignedImage } from "@/components/signed-image";
import { VerifiedBadge } from "@/components/verified-badge";
import { MapPin } from "lucide-react";

export const Route = createFileRoute("/_authenticated/map")({
  ssr: false,
  head: () => ({ meta: [{ title: "Mapa — Spark" }] }),
  component: MapPage,
});

function MapPage() {
  const { user } = useAuth();
  const { data: me } = useMyProfile(user?.id);

  const { data: nearby } = useQuery({
    queryKey: ["map-nearby", me?.lat_snap, me?.lng_snap],
    enabled: !!me?.lat_snap && !!me?.lng_snap,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, handle, display_name, avatar_url, verified, city, lat_snap, lng_snap, invisible_mode, banned, shadow_banned")
        .neq("user_id", user!.id);
      return (data ?? [])
        .filter((p: any) => !p.invisible_mode && !p.banned && !p.shadow_banned && p.lat_snap && p.lng_snap)
        .map((p: any) => ({ ...p, km: distanceKm({ lat: me!.lat_snap!, lng: me!.lng_snap! }, { lat: p.lat_snap, lng: p.lng_snap }) }))
        .sort((a: any, b: any) => a.km - b.km)
        .slice(0, 50);
    },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6">
      <h1 className="mb-3 flex items-center gap-2 text-xl font-bold"><MapPin /> Próximos de você</h1>

      {!me?.lat_snap && (
        <Card className="mb-4 p-4 text-sm">
          <p className="font-semibold">Compartilhe sua localização</p>
          <p className="mt-1 text-muted-foreground">Sua posição é arredondada para ~500m com offset aleatório. Habilite em <Link to="/settings" className="text-primary underline">Configurações</Link>.</p>
        </Card>
      )}

      <Card className="mb-4 border-dashed p-4 text-xs text-muted-foreground">
        🗺️ <strong>Mapa visual com Google Maps</strong> entra no próximo build, junto com pins reais. Por enquanto, mostramos lista ordenada por proximidade (posições já fuzzy a ~500m).
      </Card>

      <div className="space-y-2">
        {(nearby ?? []).map((p: any) => (
          <Link key={p.user_id} to={"/u/$handle" as never} params={{ handle: p.handle } as never} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:bg-secondary">
            <SignedImage bucket="avatars" path={p.avatar_url} alt={p.display_name} className="h-12 w-12 rounded-full object-cover" />
            <div className="flex-1">
              <p className="text-sm font-semibold">{p.display_name} {p.verified && <VerifiedBadge />}</p>
              <p className="text-xs text-muted-foreground">@{p.handle} {p.city && `• ${p.city}`}</p>
            </div>
            <span className="rounded-full bg-secondary px-2 py-1 text-xs font-semibold">~{p.km.toFixed(1)} km</span>
          </Link>
        ))}
        {nearby && nearby.length === 0 && me?.lat_snap && <p className="py-8 text-center text-sm text-muted-foreground">Ninguém por perto ainda.</p>}
      </div>
    </div>
  );
}
