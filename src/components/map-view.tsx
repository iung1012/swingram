import type { Feature as GJFeature, FeatureCollection, Point } from "geojson";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Plus, Minus, Locate, Maximize2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile } from "@/hooks/use-profile";
import { distanceKm } from "@/lib/geo";
import { Card } from "@/components/ui/card";

const DARK_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const SRC_ID = "profiles-src";
const CLUSTER_LAYER = "profiles-clusters";
const CLUSTER_COUNT_LAYER = "profiles-cluster-count";
const POINT_LAYER = "profiles-point";

type NearbyProfile = {
  user_id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  verified: boolean | null;
  city: string | null;
  lat_snap: number;
  lng_snap: number;
};

type SelectedProfile = NearbyProfile & { km: number };

type Feature = GJFeature<Point, NearbyProfile>;

// region cache: avoid refetching same area repeatedly
const regionCache = new Map<string, { ts: number; rows: NearbyProfile[] }>();
const CACHE_TTL_MS = 60_000;

function bboxKey(b: maplibregl.LngLatBounds) {
  // round to ~0.1° grid (~11km) so small pans hit the same cache key
  const r = (n: number) => Math.round(n * 10) / 10;
  return `${r(b.getWest())},${r(b.getSouth())},${r(b.getEast())},${r(b.getNorth())}`;
}

async function fetchProfilesInBounds(
  b: maplibregl.LngLatBounds,
  excludeUserId: string | null,
): Promise<NearbyProfile[]> {
  const key = `${excludeUserId ?? "anon"}:${bboxKey(b)}`;
  const cached = regionCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.rows;

  // pad bounds ~20% so panning has data ready at the edges
  const padLng = (b.getEast() - b.getWest()) * 0.2;
  const padLat = (b.getNorth() - b.getSouth()) * 0.2;
  const west = b.getWest() - padLng;
  const east = b.getEast() + padLng;
  const south = b.getSouth() - padLat;
  const north = b.getNorth() + padLat;

  let q = supabase
    .from("profiles")
    .select("user_id, handle, display_name, avatar_url, verified, city, lat_snap, lng_snap")
    .gte("lat_snap", south)
    .lte("lat_snap", north)
    .gte("lng_snap", west)
    .lte("lng_snap", east)
    .eq("invisible_mode", false)
    .eq("banned", false)
    .eq("shadow_banned", false)
    .not("lat_snap", "is", null)
    .not("lng_snap", "is", null)
    .limit(500);

  if (excludeUserId) q = q.neq("user_id", excludeUserId);

  const { data } = await q;
  const rows = (data ?? []) as NearbyProfile[];
  regionCache.set(key, { ts: Date.now(), rows });
  return rows;
}

export default function MapView() {
  const { user } = useAuth();
  const { data: me } = useMyProfile(user?.id);

  const center = useMemo<[number, number]>(
    () => (me?.lng_snap && me?.lat_snap ? [me.lng_snap, me.lat_snap] : [-51.9253, -14.235]),
    [me?.lat_snap, me?.lng_snap]
  );

  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const selfMarkerRef = useRef<maplibregl.Marker | null>(null);
  const moveTimerRef = useRef<number | null>(null);
  const reqIdRef = useRef(0);
  const profilesRef = useRef<Map<string, NearbyProfile>>(new Map());
  const [selected, setSelected] = useState<SelectedProfile | null>(null);
  const [visibleCount, setVisibleCount] = useState(0);

  const refreshSource = useCallback(async () => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource(SRC_ID) as maplibregl.GeoJSONSource | undefined;
    if (!src) return;

    const myId = reqIdRef.current + 1;
    reqIdRef.current = myId;

    const rows = await fetchProfilesInBounds(map.getBounds(), user?.id ?? null);
    if (myId !== reqIdRef.current) return; // a newer request superseded this one

    // merge into ref so we can resolve selection by id
    rows.forEach((r) => profilesRef.current.set(r.user_id, r));

    const features: Feature[] = rows.map((r) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [r.lng_snap, r.lat_snap] },
      properties: r,
    }));
    src.setData({ type: "FeatureCollection", features });
    setVisibleCount(rows.length);
  }, [user?.id]);

  const scheduleRefresh = useCallback(() => {
    if (moveTimerRef.current) window.clearTimeout(moveTimerRef.current);
    moveTimerRef.current = window.setTimeout(() => {
      void refreshSource();
    }, 250);
  }, [refreshSource]);

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

    map.on("load", () => {
      map.resize();

      map.addSource(SRC_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoom: 14,
      });

      map.addLayer({
        id: CLUSTER_LAYER,
        type: "circle",
        source: SRC_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            "#f97316", 10,
            "#ef4444", 50,
            "#dc2626",
          ],
          "circle-radius": [
            "step",
            ["get", "point_count"],
            16, 10, 22, 50, 28,
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#0a0a0a",
          "circle-opacity": 0.9,
        },
      });

      map.addLayer({
        id: CLUSTER_COUNT_LAYER,
        type: "symbol",
        source: SRC_ID,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 12,
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
        },
        paint: { "text-color": "#fff" },
      });

      map.addLayer({
        id: POINT_LAYER,
        type: "circle",
        source: SRC_ID,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": 8,
          "circle-color": "#f59e0b",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#0a0a0a",
          "circle-blur": 0.05,
        },
      });

      // click cluster → zoom in
      map.on("click", CLUSTER_LAYER, (e) => {
        const feat = e.features?.[0];
        if (!feat) return;
        const clusterId = (feat.properties as any)?.cluster_id;
        const src = map.getSource(SRC_ID) as maplibregl.GeoJSONSource;
        src.getClusterExpansionZoom(clusterId).then((zoom) => {
          const coords = (feat.geometry as Point).coordinates as [number, number];
          map.easeTo({ center: coords, zoom: zoom + 0.001, duration: 500 });
        }).catch(() => {});
      });

      // click point → open card
      map.on("click", POINT_LAYER, (e) => {
        const feat = e.features?.[0];
        if (!feat) return;
        const props = feat.properties as any;
        // properties come back stringified for nested fields; flat strings are fine
        const profile: NearbyProfile = {
          user_id: String(props.user_id),
          handle: String(props.handle),
          display_name: String(props.display_name),
          avatar_url: props.avatar_url ? String(props.avatar_url) : null,
          verified: props.verified === "true" || props.verified === true,
          city: props.city ? String(props.city) : null,
          lat_snap: Number(props.lat_snap),
          lng_snap: Number(props.lng_snap),
        };
        const km = me?.lat_snap && me?.lng_snap
          ? distanceKm({ lat: me.lat_snap, lng: me.lng_snap }, { lat: profile.lat_snap, lng: profile.lng_snap })
          : 0;
        setSelected({ ...profile, km });
        const coords = (feat.geometry as Point).coordinates as [number, number];
        map.easeTo({ center: coords, duration: 350 });
      });

      const setPointer = (cursor: string) => () => { map.getCanvas().style.cursor = cursor; };
      map.on("mouseenter", CLUSTER_LAYER, setPointer("pointer"));
      map.on("mouseleave", CLUSTER_LAYER, setPointer(""));
      map.on("mouseenter", POINT_LAYER, setPointer("pointer"));
      map.on("mouseleave", POINT_LAYER, setPointer(""));

      // region-based loading
      map.on("moveend", scheduleRefresh);
      map.on("zoomend", scheduleRefresh);

      // first load
      void refreshSource();
    });

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(mapContainer.current);
    const t = setTimeout(() => map.resize(), 200);
    return () => {
      clearTimeout(t);
      if (moveTimerRef.current) window.clearTimeout(moveTimerRef.current);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // self marker + recenter when profile loads
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !me?.lat_snap || !me?.lng_snap) return;

    if (!selfMarkerRef.current) {
      const el = document.createElement("div");
      el.style.cssText = `
        width:16px;height:16px;border-radius:9999px;background:#fff;
        box-shadow:0 0 0 3px rgba(255,255,255,0.18),0 0 18px rgba(255,255,255,0.5);
      `;
      selfMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([me.lng_snap, me.lat_snap])
        .addTo(map);
    } else {
      selfMarkerRef.current.setLngLat([me.lng_snap, me.lat_snap]);
    }

    map.easeTo({ center: [me.lng_snap, me.lat_snap], zoom: 12, duration: 600 });
  }, [me?.lat_snap, me?.lng_snap]);

  const zoom = (delta: number) =>
    mapRef.current?.zoomTo((mapRef.current.getZoom() ?? 11) + delta, { duration: 200 });
  const recenter = () => {
    if (me?.lat_snap && me?.lng_snap) {
      mapRef.current?.easeTo({ center: [me.lng_snap, me.lat_snap], zoom: 13, duration: 500 });
    }
  };
  const fit = () => {
    const map = mapRef.current;
    if (!map) return;
    const pts: [number, number][] = [];
    if (me?.lat_snap && me?.lng_snap) pts.push([me.lng_snap, me.lat_snap]);
    profilesRef.current.forEach((p) => pts.push([p.lng_snap, p.lat_snap]));
    if (pts.length < 2) return;
    const b = new maplibregl.LngLatBounds(pts[0], pts[0]);
    pts.forEach((p) => b.extend(p));
    map.fitBounds(b, { padding: 60, duration: 600, maxZoom: 13 });
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Próximos</p>
          <h1 className="text-2xl font-semibold tracking-tight">Mapa de brasas</h1>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">{visibleCount} na região</span>
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

            <div
              className="pointer-events-none absolute inset-0"
              style={{ boxShadow: "inset 0 0 40px oklch(0.06 0 0 / 0.25)" }}
            />

            <div className="absolute right-3 top-3 flex flex-col gap-1.5">
              <ControlBtn onClick={() => zoom(1)} label="Aproximar"><Plus className="h-4 w-4" /></ControlBtn>
              <ControlBtn onClick={() => zoom(-1)} label="Afastar"><Minus className="h-4 w-4" /></ControlBtn>
              <ControlBtn onClick={recenter} label="Minha localização"><Locate className="h-4 w-4" /></ControlBtn>
              <ControlBtn onClick={fit} label="Ver tudo"><Maximize2 className="h-4 w-4" /></ControlBtn>
            </div>

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
                    <p className="truncate text-xs text-muted-foreground">
                      @{selected.handle}{selected.km ? ` · ~${selected.km.toFixed(1)} km` : ""}
                    </p>
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
