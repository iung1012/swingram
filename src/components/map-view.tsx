import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Plus, Minus, Locate, Maximize2 } from "lucide-react";
import { api } from "@/integrations/api/client";
import { useAuth } from "@/hooks/use-auth";
import { useIsStaff, useMyProfile } from "@/hooks/use-profile";
import { distanceKm, snapAndFuzz } from "@/lib/geo";
import { canViewProfile, fetchPrivacyState } from "@/lib/privacy";
import { Card } from "@/components/ui/card";
import { VerifiedAvatar } from "@/components/verified-avatar";
import { VerifiedBadge } from "@/components/verified-badge";
import { toast } from "sonner";

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

const regionCache = new Map<string, { ts: number; rows: NearbyProfile[] }>();
const CACHE_TTL_MS = 60_000;

function bboxKey(b: L.LatLngBounds) {
  const r = (n: number) => Math.round(n * 10) / 10;
  return `${r(b.getWest())},${r(b.getSouth())},${r(b.getEast())},${r(b.getNorth())}`;
}

async function fetchProfilesInBounds(
  b: L.LatLngBounds,
  excludeUserId: string | null,
  viewerUserId: string | null,
  isStaff: boolean,
): Promise<NearbyProfile[]> {
  const key = `${excludeUserId ?? "anon"}:${bboxKey(b)}`;
  const cached = regionCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    const privacyState = await fetchPrivacyState(viewerUserId, cached.rows.map((r) => r.user_id));
    return cached.rows.filter((row) => canViewProfile(row as any, viewerUserId, privacyState, isStaff));
  }

  const padLng = (b.getEast() - b.getWest()) * 0.2;
  const padLat = (b.getNorth() - b.getSouth()) * 0.2;
  const west = b.getWest() - padLng;
  const east = b.getEast() + padLng;
  const south = b.getSouth() - padLat;
  const north = b.getNorth() + padLat;

  let q = api
    .from("profiles")
    .select("user_id, handle, display_name, avatar_url, verified, city, lat_snap, lng_snap, invisible_mode, profile_visibility")
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
  const privacyState = await fetchPrivacyState(viewerUserId, rows.map((r) => r.user_id));
  return rows.filter((row) => canViewProfile(row as any, viewerUserId, privacyState, isStaff));
}

export default function MapView() {
  const { user } = useAuth();
  const { data: me } = useMyProfile(user?.id);
  const { data: roles } = useIsStaff(user?.id);
  const isStaff = !!roles && (roles.admin || roles.moderator || roles.support);

  // Live snapped position from the device geolocation API. Falls back to the
  // profile's stored lat_snap/lng_snap until the user grants permission.
  const [livePos, setLivePos] = useState<{ lat: number; lng: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  const selfPos = useMemo<{ lat: number; lng: number } | null>(() => {
    if (livePos) return livePos;
    if (me?.lat_snap && me?.lng_snap) return { lat: me.lat_snap, lng: me.lng_snap };
    return null;
  }, [livePos, me?.lat_snap, me?.lng_snap]);

  const center = useMemo<[number, number]>(
    () => (selfPos ? [selfPos.lat, selfPos.lng] : [-14.235, -51.9253]),
    [selfPos]
  );

  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const selfMarkerRef = useRef<L.Marker | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const moveTimerRef = useRef<number | null>(null);
  const reqIdRef = useRef(0);
  const profilesRef = useRef<Map<string, NearbyProfile>>(new Map());
  const [selected, setSelected] = useState<SelectedProfile | null>(null);
  const [visibleCount, setVisibleCount] = useState(0);

  // Request current device location, snap it and persist to the profile.
  const requestLocation = (opts: { silent?: boolean } = {}) => {
    if (!user?.id) return;
    if (!("geolocation" in navigator)) {
      if (!opts.silent) toast.error("Geolocalização não suportada neste dispositivo");
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const snapped = snapAndFuzz(user.id, pos.coords.latitude, pos.coords.longitude);
        const next = { lat: snapped.lat_snap, lng: snapped.lng_snap };
        setLivePos(next);
        setGeoLoading(false);
        try {
          await api
            .from("profiles")
            .update({ lat_snap: next.lat, lng_snap: next.lng })
            .eq("user_id", user.id);
        } catch (e) {
          console.warn("[MapView] failed to persist location", e);
        }
      },
      (err) => {
        setGeoLoading(false);
        console.warn("[MapView] geolocation error", err);
        if (!opts.silent) toast.error("Não foi possível obter sua localização");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  // Try to get a fresh position as soon as we know who the user is.
  useEffect(() => {
    if (!user?.id) return;
    requestLocation({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);



  // init map
  useEffect(() => {
    console.log("[MapView] init effect", { hasContainer: !!containerEl, hasMap: !!mapRef.current });
    if (!containerEl || mapRef.current) return;
    try {
      const map = L.map(containerEl, {
        center,
        zoom: 11,
        zoomControl: false,
        attributionControl: false,
      });
      mapRef.current = map;
      console.log("[MapView] L.map created");
    } catch (e) {
      console.error("[MapView] L.map failed", e);
      return;
    }
    const map = mapRef.current!;

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);

    const refresh = async () => {
      const myId = reqIdRef.current + 1;
      reqIdRef.current = myId;
      const rows = await fetchProfilesInBounds(map.getBounds(), user?.id ?? null, user?.id ?? null, isStaff);
      if (myId !== reqIdRef.current) return;

      // remove markers no longer present
      const next = new Set(rows.map((r) => r.user_id));
      markersRef.current.forEach((m, id) => {
        if (!next.has(id)) {
          m.remove();
          markersRef.current.delete(id);
        }
      });

      rows.forEach((r) => {
        profilesRef.current.set(r.user_id, r);
        if (markersRef.current.has(r.user_id)) return;
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:16px;height:16px;border-radius:9999px;background:#f59e0b;border:2px solid #0a0a0a;box-shadow:0 0 12px rgba(245,158,11,.7)"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        const marker = L.marker([r.lat_snap, r.lng_snap], { icon }).addTo(map);
        marker.on("click", () => {
          const km = selfPos
            ? distanceKm(selfPos, { lat: r.lat_snap, lng: r.lng_snap })
            : 0;
          setSelected({ ...r, km });
          map.panTo([r.lat_snap, r.lng_snap]);
        });
        markersRef.current.set(r.user_id, marker);
      });

      setVisibleCount(rows.length);
    };

    const scheduleRefresh = () => {
      if (moveTimerRef.current) window.clearTimeout(moveTimerRef.current);
      moveTimerRef.current = window.setTimeout(() => { void refresh(); }, 250);
    };

    map.on("moveend", scheduleRefresh);
    map.on("zoomend", scheduleRefresh);
    const onPrivacyChanged = () => {
      regionCache.clear();
      scheduleRefresh();
    };
    window.addEventListener("privacy:changed", onPrivacyChanged);

    setTimeout(() => {
      map.invalidateSize();
      void refresh();
    }, 100);

    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerEl);

    return () => {
      if (moveTimerRef.current) window.clearTimeout(moveTimerRef.current);
      window.removeEventListener("privacy:changed", onPrivacyChanged);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerEl, user?.id, isStaff]);

  // self marker + recenter whenever our position changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selfPos) return;

    const icon = L.divIcon({
      className: "",
      html: `<div style="width:16px;height:16px;border-radius:9999px;background:#fff;box-shadow:0 0 0 3px rgba(255,255,255,0.18),0 0 18px rgba(255,255,255,0.5)"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    if (!selfMarkerRef.current) {
      selfMarkerRef.current = L.marker([selfPos.lat, selfPos.lng], { icon }).addTo(map);
      map.setView([selfPos.lat, selfPos.lng], 12);
    } else {
      selfMarkerRef.current.setLatLng([selfPos.lat, selfPos.lng]);
    }
  }, [selfPos?.lat, selfPos?.lng]);

  const zoom = (delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.setZoom(map.getZoom() + delta);
  };
  const recenter = () => {
    requestLocation();
    if (selfPos) {
      mapRef.current?.setView([selfPos.lat, selfPos.lng], 13);
    }
  };
  const fit = () => {
    const map = mapRef.current;
    if (!map) return;
    const pts: L.LatLngTuple[] = [];
    if (selfPos) pts.push([selfPos.lat, selfPos.lng]);
    profilesRef.current.forEach((p) => pts.push([p.lat_snap, p.lng_snap]));
    if (pts.length < 2) return;
    map.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 13 });
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

      {!selfPos ? (
        <Card className="mb-4 p-5 text-sm">
          <p className="font-semibold">Compartilhe sua localização</p>
          <p className="mt-1 text-muted-foreground">
            Usamos sua posição atual arredondada a ~500m com offset aleatório. Ninguém vê o ponto exato.
          </p>
          <button
            type="button"
            onClick={() => requestLocation()}
            disabled={geoLoading}
            className="mt-3 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
          >
            {geoLoading ? "Obtendo..." : "Usar minha localização atual"}
          </button>
          <p className="mt-3 text-xs text-muted-foreground">
            Você também pode ajustar em <Link to="/settings" className="text-primary underline">Configurações</Link>.
          </p>
        </Card>
      ) : (
        <>
          <div className="relative overflow-hidden rounded-3xl border border-border shadow-2xl">
            <div ref={setContainerEl} style={{ height: 480, width: "100%" }} className="bg-[#0a0a0a]" />

            <div
              className="pointer-events-none absolute inset-0 z-[400]"
              style={{ boxShadow: "inset 0 0 40px oklch(0.06 0 0 / 0.25)" }}
            />

            <div className="absolute right-3 top-3 z-[500] flex flex-col gap-1.5">
              <ControlBtn onClick={() => zoom(1)} label="Aproximar"><Plus className="h-4 w-4" /></ControlBtn>
              <ControlBtn onClick={() => zoom(-1)} label="Afastar"><Minus className="h-4 w-4" /></ControlBtn>
              <ControlBtn onClick={recenter} label="Minha localização"><Locate className="h-4 w-4" /></ControlBtn>
              <ControlBtn onClick={fit} label="Ver tudo"><Maximize2 className="h-4 w-4" /></ControlBtn>
            </div>

            {selected && (
              <div className="absolute inset-x-3 bottom-3 z-[500] rounded-2xl border border-border bg-card/95 p-3 backdrop-blur">
                <div className="flex items-center gap-3">
                  <VerifiedAvatar
                    bucket="avatars"
                    path={selected.avatar_url}
                    alt={selected.display_name ?? ""}
                    verified={!!selected.verified}
                    className="h-10 w-10 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 truncate text-sm font-semibold">
                      <span className="truncate">{selected.display_name}</span>
                      {selected.verified && <VerifiedBadge />}
                    </p>
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

