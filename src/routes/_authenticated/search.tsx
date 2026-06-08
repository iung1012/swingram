import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile } from "@/hooks/use-profile";
import { distanceKm } from "@/lib/geo";
import { VerifiedAvatar } from "@/components/verified-avatar";
import { VerifiedBadge } from "@/components/verified-badge";
import { SignedMedia } from "@/components/signed-media";
import {
  Search as SearchIcon,
  ChevronRight,
  Filter,
  List,
  LayoutGrid,
  X,
  Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SpiralLoaderBlock } from "@/components/spiral-loader";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/_authenticated/search")({
  ssr: false,
  head: () => ({ meta: [{ title: "Buscar — Brasa Swing" }] }),
  validateSearch: zodValidator(searchSchema),
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
  { v: "100", label: "100 km" },
];
const INTERESTS = [
  "Casual",
  "Swing",
  "Exibicionismo",
  "Voyeurismo",
  "Encontros",
  "Festas",
  "Fetiches",
  "BDSM",
  "Fotografia íntima",
  "Online",
];

function Search() {
  const { user } = useAuth();
  const { data: me } = useMyProfile(user?.id);
  const { q: qInit } = Route.useSearch();
  const [q, setQ] = useState(qInit);
  const [type, setType] = useState<string>("all");
  const [radius, setRadius] = useState<string>("0");
  const [city, setCity] = useState("");
  const [selInterests, setSelInterests] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  useEffect(() => setQ(qInit), [qInit]);

  const trimmed = q.trim();
  const isHashtag = trimmed.startsWith("#");
  const tag = isHashtag ? trimmed.replace(/^#+/, "").toLowerCase() : "";

  const toggleInterest = (i: string) =>
    setSelInterests((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i],
    );

  const activeFilterCount =
    (type !== "all" ? 1 : 0) +
    (radius !== "0" ? 1 : 0) +
    (city.trim() ? 1 : 0) +
    selInterests.length;

  const { data: results, isLoading } = useQuery({
    enabled: !isHashtag,
    queryKey: ["search-profiles", q, type, radius, city, selInterests, me?.lat_snap, me?.lng_snap],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select(
          "user_id, handle, display_name, avatar_url, verified, city, profile_type, interests, lat_snap, lng_snap, invisible_mode",
        )
        .eq("banned", false)
        .eq("shadow_banned", false)
        .limit(60);
      if (q)
        query = query.or(
          `handle.ilike.%${q}%,display_name.ilike.%${q}%,city.ilike.%${q}%`,
        );
      if (type !== "all") query = query.eq("profile_type", type as never);
      if (city.trim()) query = query.ilike("city", `%${city.trim()}%`);
      if (selInterests.length > 0)
        query = query.overlaps("interests", selInterests);
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

  const { data: tagResults, isLoading: tagLoading } = useQuery({
    enabled: isHashtag && tag.length > 0,
    queryKey: ["search-hashtag", tag],
    queryFn: async () => {
      const { data: postsData } = await supabase
        .from("posts")
        .select("id, caption, user_id, created_at, post_media(url, order, kind)")
        .contains("hashtags", [tag])
        .eq("moderation_status", "approved")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(60);
      const rows = postsData ?? [];
      const ids = Array.from(new Set(rows.map((r: any) => r.user_id)));
      let authors = new Map<string, any>();
      if (ids.length) {
        const { data: ps } = await supabase
          .from("profiles")
          .select("user_id, handle, display_name, avatar_url, verified")
          .in("user_id", ids);
        authors = new Map((ps ?? []).map((p: any) => [p.user_id, p]));
      }
      return rows.map((r: any) => ({ ...r, author: authors.get(r.user_id) }));
    },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 pb-8 pt-6">
      <header className="mb-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Explorar
        </p>
        <h1 className="mt-1 text-[26px] font-semibold tracking-tight">
          Buscar
        </h1>
      </header>

      <div className="flex items-center gap-2">
        <label className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 transition-colors focus-within:border-foreground/25">
          {isHashtag ? (
            <Hash className="h-4 w-4 text-primary" strokeWidth={2.4} />
          ) : (
            <SearchIcon
              className="h-4 w-4 text-muted-foreground"
              strokeWidth={2.2}
            />
          )}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Perfis, #tag, cidade…"
            className="h-full flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground"
          />
        </label>
        {!isHashtag && (
          <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card transition-colors hover:bg-secondary/60"
              >
                <Filter
                  className="h-[18px] w-[18px] text-muted-foreground"
                  strokeWidth={2}
                />
                {activeFilterCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl pb-8">
              <SheetHeader>
                <SheetTitle className="text-left text-base font-semibold tracking-tight">
                  Filtros
                </SheetTitle>
              </SheetHeader>
              <div className="mt-5 space-y-5">
                <div>
                  <label className="mb-1.5 block px-1 text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Cidade
                  </label>
                  <div className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 transition-colors focus-within:border-foreground/25">
                    <input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Filtrar por cidade"
                      className="h-full flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
                    />
                    {city && (
                      <button
                        type="button"
                        onClick={() => setCity("")}
                        className="text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        limpar
                      </button>
                    )}
                  </div>
                </div>

                <ChipGroup label="Tipo" value={type} onChange={setType} options={TYPES} />
                <ChipGroup label="Distância" value={radius} onChange={setRadius} options={RADII} />
                <div>
                  <p className="mb-1.5 px-1 text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Interesses {selInterests.length > 0 && `(${selInterests.length})`}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {INTERESTS.map((i) => {
                      const active = selInterests.includes(i);
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => toggleInterest(i)}
                          className={cn(
                            "h-7 rounded-full border px-2.5 text-[12px] font-medium tracking-tight transition-colors",
                            active
                              ? "border-foreground/40 bg-secondary text-foreground"
                              : "border-border bg-card text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {i}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full rounded-xl"
                  onClick={() => {
                    setType("all");
                    setRadius("0");
                    setCity("");
                    setSelInterests([]);
                  }}
                >
                  <X className="mr-1.5 h-3.5 w-3.5" strokeWidth={2.2} />
                  Limpar filtros
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>

      <p className="mt-2 px-1 text-[11.5px] text-muted-foreground">
        Dica: comece com <span className="font-medium text-foreground">#</span> para buscar posts por hashtag.
      </p>

      {isHashtag ? (
        <section className="mt-5">
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="inline-flex items-center gap-1.5 text-[13px] font-semibold tracking-tight">
              <Hash className="h-3.5 w-3.5 text-primary" strokeWidth={2.4} />
              {tag || "tag"}
              <span className="text-[11px] font-normal text-muted-foreground">
                {tagLoading ? "…" : (tagResults ?? []).length}
              </span>
            </h2>
          </div>
          {tagLoading ? (
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <SpiralLoaderBlock />
            </div>
          ) : !tagResults || tagResults.length === 0 ? (
            <div className="overflow-hidden rounded-2xl border border-border bg-card px-3 py-10 text-center text-[13px] text-muted-foreground">
              Nenhum post com #{tag || "…"}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {tagResults.map((p: any) => {
                const first = (p.post_media ?? []).sort((a: any, b: any) => a.order - b.order)[0];
                const kind: "image" | "video" | "text" = first ? first.kind ?? "image" : "text";
                const handle = p.author?.handle;
                const inner =
                  kind === "text" ? (
                    <div className="flex aspect-square w-full items-center justify-center bg-secondary/40 p-2">
                      <p className="line-clamp-5 text-center text-[11px] leading-snug text-foreground/90">
                        {p.caption || "(sem texto)"}
                      </p>
                    </div>
                  ) : (
                    <SignedMedia
                      bucket="posts"
                      path={first?.url}
                      kind={kind}
                      alt=""
                      controls={false}
                      muted
                      className="aspect-square w-full object-cover"
                    />
                  );
                return handle ? (
                  <Link
                    key={p.id}
                    to={"/u/$handle" as never}
                    params={{ handle } as never}
                    className="group relative overflow-hidden rounded-lg border border-border bg-card"
                  >
                    {inner}
                    {kind === "video" && (
                      <span className="pointer-events-none absolute right-1.5 top-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                        ▶
                      </span>
                    )}
                  </Link>
                ) : (
                  <div key={p.id} className="relative overflow-hidden rounded-lg border border-border bg-card">
                    {inner}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <>
          <div className="mt-5 flex items-center justify-between px-1">
            <h2 className="inline-flex items-center gap-1.5 text-[13px] font-semibold tracking-tight">
              Resultados
              <span className="text-[11px] font-normal text-muted-foreground">
                {isLoading ? "…" : (results ?? []).length}
              </span>
            </h2>
            <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                  viewMode === "list"
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-label="Visualização em lista"
              >
                <List className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                  viewMode === "grid"
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-label="Visualização em grade"
              >
                <LayoutGrid className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="mt-2.5 overflow-hidden rounded-2xl border border-border bg-card">
              <SpiralLoaderBlock />
            </div>
          ) : !results || results.length === 0 ? (
            <div className="mt-2.5 overflow-hidden rounded-2xl border border-border bg-card px-3 py-10 text-center text-[13px] text-muted-foreground">
              Nenhum resultado.
            </div>
          ) : viewMode === "list" ? (
            <section className="mt-2.5 overflow-hidden rounded-2xl border border-border bg-card">
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
                          {(p.interests as string[]).slice(0, 3).map((i: string) => (
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
                    <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
                  </Link>
                ))}
              </div>
            </section>
          ) : (
            <section className="mt-2.5 grid grid-cols-2 gap-3">
              {results.map((p: any) => (
                <Link
                  key={p.user_id}
                  to={"/u/$handle" as never}
                  params={{ handle: p.handle } as never}
                  className="group overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:bg-secondary/30"
                >
                  <div className="relative">
                    <VerifiedAvatar
                      bucket="avatars"
                      path={p.avatar_url}
                      alt={p.display_name}
                      verified={p.verified}
                      className="h-full w-full rounded-none"
                    />
                    {p.verified && (
                      <div className="absolute right-1.5 top-1.5">
                        <VerifiedBadge />
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="truncate text-[13px] font-semibold tracking-tight">
                      {p.display_name}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      @{p.handle}
                    </p>
                    {p.city && (
                      <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground/80">
                        {p.city}
                      </p>
                    )}
                    {(p.interests ?? []).length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {(p.interests as string[]).slice(0, 2).map((i: string) => (
                          <span
                            key={i}
                            className="rounded-md border border-border bg-secondary/60 px-1.5 py-0.5 text-[9px] font-medium text-foreground/85"
                          >
                            {i}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </section>
          )}
        </>
      )}
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
