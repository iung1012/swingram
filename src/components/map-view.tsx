import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Plus, Minus, Locate, Maximize2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile } from "@/hooks/use-profile";
import { distanceKm } from "@/lib/geo";
import { Card } from "@/components/ui/card";

const DARK_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

type NearbyProfile = {
  user_id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  verified: boolean | null;
  city: string | null;
  lat_snap: number;
  lng_snap: number;
  km: number;
};

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
        .map((p: any) => ({
          ...p,
          km: distanceKm({ lat: me!.lat_snap!, lng: me!.lng_snap! }, { lat: p.lat_snap, lng: p.lng_snap }),
        }))
        .sort((a: any, b: any) => a.km - b.km)
        .slice(0, 100) as NearbyProfile[];
    },
  });

  const center = useMemo<[number, number]>(
    () => (me?.lng_snap && me?.lat_snap ? [me.lng_snap, me.lat_snap] : [-51.9253, -14.235]),
    [me?.lat_snap, me?.lng_snap]
  );

  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [selected, setSelected] = useState<NearbyProfile | null>(null);

  // init map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: DARK_STYLE,
      center,
      zoom: 11,
      attributionControl: false,
      pitchWithRotate: false,
      dragRotate: false,
    });
    mapRef.current = map;
    map.on("load", () => map.resize());
    // Resize when container becomes visible/sized
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(mapContainer.current);
    // safety: resize after layout settles
    const t = setTimeout(() => map.resize(), 200);
    return () => {
      clearTimeout(t);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // recenter when profile loads
  useEffect(() => {
    if (!mapRef.current || !me?.lat_snap || !me?.lng_snap) return;
    mapRef.current.easeTo({ center: [me.lng_snap, me.lat_snap], zoom: 12, duration: 600 });
  }, [me?.lat_snap, me?.lng_snap]);

  // render markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // clear
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // self marker (white ring)
    if (me?.lat_snap && me?.lng_snap) {
      const el = document.createElement("div");
      el.className = "self-marker";
      el.style.cssText = `
        width:16px;height:16px;border-radius:9999px;
        background:#fff;
        box-shadow:0 0 0 3px rgba(255,255,255,0.18),0 0 18px rgba(255,255,255,0.5);
      `;
      const m = new maplibregl.Marker({ element: el }).setLngLat([me.lng_snap, me.lat_snap]).addTo(map);
      markersRef.current.push(m);
    }

    (nearby ?? []).forEach((p) => {
      const el = document.createElement("button");
      el.type = "button";
      el.style.cssText = `
        width:22px;height:22px;border-radius:9999px;cursor:pointer;border:0;padding:0;
        background:radial-gradient(circle at 35% 30%, oklch(0.88 0.18 85), oklch(0.64 0.24 28) 70%);
        box-shadow:0 0 14px oklch(0.7 0.22 45 / 0.9), 0 0 0 2px #0a0a0a;
      `;
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelected(p);
        map.easeTo({ center: [p.lng_snap, p.lat_snap], duration: 400 });
      });
      const m = new maplibregl.Marker({ element: el }).setLngLat([p.lng_snap, p.lat_snap]).addTo(map);
      markersRef.current.push(m);
    });
  }, [nearby, me?.lat_snap, me?.lng_snap]);

  const zoom = (delta: number) => mapRef.current?.zoomTo((mapRef.current.getZoom() ?? 11) + delta, { duration: 200 });
  const recenter = () => {
    if (me?.lat_snap && me?.lng_snap) {
      mapRef.current?.easeTo({ center: [me.lng_snap, me.lat_snap], zoom: 13, duration: 500 });
    }
  };
  const fit = () => {
    if (!mapRef.current) return;
    const pts: [number, number][] = [];
    if (me?.lat_snap && me?.lng_snap) pts.push([me.lng_snap, me.lat_snap]);
    (nearby ?? []).forEach((p) => pts.push([p.lng_snap, p.lat_snap]));
    if (pts.length < 2) return;
    const b = new maplibregl.LngLatBounds(pts[0], pts[0]);
    pts.forEach((p) => b.extend(p));
    mapRef.current.fitBounds(b, { padding: 60, duration: 600, maxZoom: 13 });
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Próximos</p>
          <h1 className="text-2xl font-semibold tracking-tight">Mapa de brasas</h1>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">{nearby?.length ?? 0} por perto</span>
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
            <div ref={mapContainer} style={{ height: 480, width: "100%" }} className="bg-[#0a0a0a]" />

            {/* subtle warm tint — não escurece o mapa */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                boxShadow:
                  "inset 0 0 40px oklch(0.06 0 0 / 0.25)",
              }}
            />

            {/* top-right controls */}
            <div className="absolute right-3 top-3 flex flex-col gap-1.5">
              <ControlBtn onClick={() => zoom(1)} label="Aproximar"><Plus className="h-4 w-4" /></ControlBtn>
              <ControlBtn onClick={() => zoom(-1)} label="Afastar"><Minus className="h-4 w-4" /></ControlBtn>
              <ControlBtn onClick={recenter} label="Minha localização"><Locate className="h-4 w-4" /></ControlBtn>
              <ControlBtn onClick={fit} label="Ver tudo"><Maximize2 className="h-4 w-4" /></ControlBtn>
            </div>

            {/* selected popup */}
            {selected && (
              <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-border bg-card/95 p-3 backdrop-blur">
                <div className="flex items-center gap-3">
                  {selected.avatar_url ? (
                    <img src={selected.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-secondary" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{selected.display_name}</p>
                    <p className="truncate text-xs text-muted-foreground">@{selected.handle} · ~{selected.km.toFixed(1)} km</p>
                  </div>
                  <Link
                    to={"/u/$handle" as never}
                    params={{ handle: selected.handle } as never}
                    className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-secondary"
                  >
                    Ver
                  </Link>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="ml-1 rounded-full p-1 text-muted-foreground hover:bg-secondary"
                    aria-label="Fechar"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}
          </div>
          <p className="mt-3 px-1 text-[11px] leading-relaxed text-muted-foreground">
            Posições arredondadas a ~500m + offset aleatório fixo por usuário. Ninguém vê a localização exata.
          </p>
        </>
      )}
    </div>
  );
}

function ControlBtn({ onClick, children, label }: { onClick: () => void; children: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card/90 text-foreground backdrop-blur transition hover:bg-secondary"
    >
      {children}
    </button>
  );
}
