import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile } from "@/hooks/use-profile";
import { distanceKm } from "@/lib/geo";
import { Card } from "@/components/ui/card";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Custom flame pin (no Google-style marker)
const flamePin = L.divIcon({
  className: "",
  html: `<div style="
    width: 22px; height: 22px; border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, oklch(0.88 0.18 85), oklch(0.64 0.24 28) 70%);
    box-shadow: 0 0 12px oklch(0.7 0.22 45 / 0.85), 0 0 0 2px oklch(0.08 0 0);
  "></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

export default function MapView() {
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
        .slice(0, 100);
    },
  });

  const center = useMemo<[number, number]>(
    () => (me?.lat_snap && me?.lng_snap ? [me.lat_snap, me.lng_snap] : [-14.235, -51.9253]),
    [me?.lat_snap, me?.lng_snap]
  );

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Próximos</h1>
          <p className="text-xs text-muted-foreground">{nearby?.length ?? 0} brasas por perto</p>
        </div>
      </div>

      {!me?.lat_snap ? (
        <Card className="mb-4 p-5 text-sm">
          <p className="font-semibold">Compartilhe sua localização</p>
          <p className="mt-1 text-muted-foreground">
            Posição arredondada para ~500m com offset aleatório. Habilite em{" "}
            <Link to="/settings" className="text-primary underline">Configurações</Link>.
          </p>
        </Card>
      ) : (
        <>
          <div className="relative overflow-hidden rounded-3xl border border-border shadow-2xl">
            {/* Subtle warm vignette on top of the dark map */}
            <div className="pointer-events-none absolute inset-0 z-[400]"
              style={{ boxShadow: "inset 0 0 80px oklch(0.08 0 0 / 0.9), inset 0 80px 40px -40px oklch(0.6 0.25 25 / 0.18)" }} />
            <div style={{ height: 460, width: "100%" }}>
              <MapContainer center={center} zoom={11} style={{ height: "100%", width: "100%" }} zoomControl={false} attributionControl={false}>
                {/* Carto dark, NO labels — pure shapes only */}
                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png" />
                <CircleMarker
                  center={center}
                  radius={9}
                  pathOptions={{ color: "oklch(0.85 0.18 85)", fillColor: "oklch(0.74 0.2 55)", fillOpacity: 0.95, weight: 2 }}
                />
                {(nearby ?? []).map((p: any) => (
                  <Marker key={p.user_id} position={[p.lat_snap, p.lng_snap]} icon={flamePin}>
                    <Popup>
                      <div className="text-sm">
                        <p className="font-semibold">{p.display_name}</p>
                        <p className="text-xs opacity-70">@{p.handle} · ~{p.km.toFixed(1)} km</p>
                        <Link to={"/u/$handle" as never} params={{ handle: p.handle } as never} className="text-primary underline">
                          Ver perfil
                        </Link>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>
          <p className="mt-3 px-1 text-[11px] leading-relaxed text-muted-foreground">
            Posições arredondadas a ~500m + offset aleatório fixo por usuário. Ninguém vê a localização exata.
          </p>

          {/* Nearby list — sleek Apple-like rows */}
          {nearby && nearby.length > 0 && (
            <div className="mt-5 space-y-2">
              {nearby.slice(0, 12).map((p: any) => (
                <Link
                  key={p.user_id}
                  to={"/u/$handle" as never}
                  params={{ handle: p.handle } as never}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-3 backdrop-blur transition active:scale-[0.99] hover:border-primary/40"
                >
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-secondary">
                    <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-muted-foreground">
                      {p.display_name?.[0] ?? "?"}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.display_name}</p>
                    <p className="truncate text-xs text-muted-foreground">@{p.handle}</p>
                  </div>
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                    {p.km.toFixed(1)} km
                  </span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
