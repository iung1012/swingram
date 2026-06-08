import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile } from "@/hooks/use-profile";
import { distanceKm } from "@/lib/geo";
import { VerifiedAvatar } from "@/components/verified-avatar";
import { VerifiedBadge } from "@/components/verified-badge";
import { Search as SearchIcon, ChevronRight, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { SpiralLoaderBlock } from "@/components/spiral-loader";

export const Route = createFileRoute("/_authenticated/search")({
  ssr: false,
  head: () => ({ meta: [{ title: "Buscar — Brasa Swing" }] }),
  component: Search,
});

const TYPES = [
  { v: "all", label: "Todos" },
  { v: "single_m", label: "Homem" },
  { v: "single_f", label: "Mulher" },
  { v: "single_nb", label: "Não-bin" },
  { v: "couple_mf", label: "Casal H+M" },
  { v: "couple_mm", label: "Casal H+H" },
  { v: "couple_ff", label: "Casal M+M" },
];
const RADII = [
  { v: "0", label: "Qualquer" },
  { v: "5", label: "5 km" },
  { v: "10", label: "10 km" },
  { v: "25", label: "25 km" },
  { v: "50", label: "50 km" },
];

function Search() {
  const { user } = useAuth();
  const { data: me } = useMyProfile(user?.id);
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("all");
  const [radius, setRadius] = useState<string>("0");

  const { data: results, isLoading } = useQuery({
    queryKey: ["search", q, type, radius, me?.lat_snap, me?.lng_snap],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select(
          "user_id, handle, display_name, avatar_url, verified, city, profile_type, interests, lat_snap, lng_snap, invisible_mode",
        )
        .eq("banned", false)
        .eq("shadow_banned", false)
        .limit(60);
      if (q) query = query.or(`handle.ilike.%${q}%,display_name.ilike.%${q}%,city.ilike.%${q}%`);
      if (type !== "all") query = query.eq("profile_type", type as never);
      const { data } = await query;
      let rows = (data ?? []).filter((p: any) => !p.invisible_mode);
      const r = parseInt(radius);
      if (r > 0 && me?.lat_snap && me?.lng_snap) {
        rows = rows.filter((p: any) => {
          if (!p.lat_snap || !p.lng_snap) return false;
          return (
            distanceKm(
              { lat: me.lat_snap!, lng: me.lng_snap! },
              { lat: p.lat_snap, lng: p.lng_snap },
            ) <= r
          );
        });
      }
      return rows;
    },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 pb-8 pt-6">
      <header className="mb-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Explorar
        </p>
        <h1 className="mt-1 text-[26px] font-semibold tracking-tight">Buscar perfis</h1>
      </header>

      <label className="flex h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 transition-colors focus-within:border-foreground/25">
        <SearchIcon className="h-4 w-4 text-muted-foreground" strokeWidth={2.2} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="@ handle, nome ou cidade"
          className="h-full flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground"
        />
      </label>

      <div className="mt-4 space-y-3">
        <ChipGroup label="Tipo" value={type} onChange={setType} options={TYPES} />
        <ChipGroup label="Distância" value={radius} onChange={setRadius} options={RADII} />
      </div>

      <div className="mt-5 flex items-center justify-between px-1">
        <h2 className="inline-flex items-center gap-1.5 text-[13px] font-semibold tracking-tight">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} />
          Resultados
        </h2>
        <span className="text-[11px] text-muted-foreground">
          {isLoading ? "…" : (results ?? []).length}
        </span>
      </div>

      <section className="mt-2.5 overflow-hidden rounded-2xl border border-border bg-card">
        {isLoading ? (
          <SpiralLoaderBlock />
        ) : !results || results.length === 0 ? (
          <div className="px-3 py-10 text-center text-[13px] text-muted-foreground">
            Nenhum resultado.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {results.map((p: any) => (
              <Link
                key={p.user_id}
                to={"/u/$handle" as never}
                params={{ handle: p.handle } as never}
                className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-secondary/40"
              >
                <VerifiedAvatar
                  bucket="avatars"
                  path={p.avatar_url}
                  alt={p.display_name}
                  verified={p.verified}
                  className="h-11 w-11"
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate text-[14px] font-medium tracking-tight">
                    {p.display_name}
                    {p.verified && <VerifiedBadge />}
                  </p>
                  <p className="truncate text-[12px] text-muted-foreground">
                    @{p.handle}
                    {p.city && ` · ${p.city}`}
                  </p>
                  {(p.interests ?? []).length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {(p.interests as string[]).slice(0, 3).map((i) => (
                        <span
                          key={i}
                          className="rounded-md border border-border bg-secondary/60 px-1.5 py-0.5 text-[10px] font-medium text-foreground/85"
                        >
                          {i}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <ChevronRight
                  className="h-4 w-4 text-muted-foreground"
                  strokeWidth={2}
                />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ChipGroup({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; label: string }[];
}) {
  return (
    <div>
      <p className="mb-1.5 px-1 text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = o.v === value;
          return (
            <button
              key={o.v}
              type="button"
              onClick={() => onChange(o.v)}
              className={cn(
                "h-7 rounded-full border px-2.5 text-[12px] font-medium tracking-tight transition-colors",
                active
                  ? "border-foreground/40 bg-secondary text-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
