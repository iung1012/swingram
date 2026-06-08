import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile } from "@/hooks/use-profile";
import { distanceKm } from "@/lib/geo";
import { Card } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icon (Leaflet + bundlers)
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

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
        .slice(0, 100);
    },
  });

  const center = useMemo<[number, number]>(
    () => (me?.lat_snap && me?.lng_snap ? [me.lat_snap, me.lng_snap] : [-14.235, -51.9253]),
    [me?.lat_snap, me?.lng_snap]
  );

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6">
      <h1 className="mb-3 flex items-center gap-2 text-xl font-bold"><MapPin /> Mapa</h1>

      {!me?.lat_snap ? (
        <Card className="mb-4 p-4 text-sm">
          <p className="font-semibold">Compartilhe sua localização</p>
          <p className="mt-1 text-muted-foreground">Sua posição é arredondada para ~500m com offset aleatório. Habilite em <Link to="/settings" className="text-primary underline">Configurações</Link>.</p>
        </Card>
      ) : (
        <>
          <Card className="mb-3 overflow-hidden p-0">
            <div style={{ height: 380, width: "100%" }}>
              <MapContainer center={center} zoom={12} style={{ height: "100%", width: "100%" }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <CircleMarker center={center} radius={8} pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.9 }}>
                  <Popup>Você (posição fuzzy)</Popup>
                </CircleMarker>
                {(nearby ?? []).map((p: any) => (
                  <Marker key={p.user_id} position={[p.lat_snap, p.lng_snap]}>
                    <Popup>
                      <div className="text-sm">
                        <p className="font-semibold">{p.display_name}</p>
                        <p className="text-xs text-muted-foreground">@{p.handle} · ~{p.km.toFixed(1)} km</p>
                        <Link to={"/u/$handle" as never} params={{ handle: p.handle } as never} className="text-primary underline">
                          Ver perfil
                        </Link>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </Card>
          <p className="text-xs text-muted-foreground">
            Todas as posições no mapa estão arredondadas a ~500m + offset aleatório fixo por usuário. Ninguém vê a localização real.
          </p>
        </>
      )}
    </div>
  );
}
