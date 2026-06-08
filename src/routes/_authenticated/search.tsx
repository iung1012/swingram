import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile } from "@/hooks/use-profile";
import { distanceKm } from "@/lib/geo";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SignedImage } from "@/components/signed-image";
import { VerifiedBadge } from "@/components/verified-badge";

export const Route = createFileRoute("/_authenticated/search")({
  ssr: false,
  head: () => ({ meta: [{ title: "Buscar — Brasa Swing" }] }),
  component: Search,
});

function Search() {
  const { user } = useAuth();
  const { data: me } = useMyProfile(user?.id);
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("all");
  const [radius, setRadius] = useState<string>("0");

  const { data: results } = useQuery({
    queryKey: ["search", q, type, radius, me?.lat_snap, me?.lng_snap],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("user_id, handle, display_name, avatar_url, verified, city, profile_type, interests, lat_snap, lng_snap, invisible_mode")
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
          return distanceKm({ lat: me.lat_snap!, lng: me.lng_snap! }, { lat: p.lat_snap, lng: p.lng_snap }) <= r;
        });
      }
      return rows;
    },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6">
      <h1 className="mb-3 text-xl font-bold">Buscar perfis</h1>
      <div className="space-y-2">
        <Input placeholder="@ ou nome ou cidade" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="single_m">Homem</SelectItem>
              <SelectItem value="single_f">Mulher</SelectItem>
              <SelectItem value="single_nb">Não-binário</SelectItem>
              <SelectItem value="couple_mf">Casal H+M</SelectItem>
              <SelectItem value="couple_mm">Casal H+H</SelectItem>
              <SelectItem value="couple_ff">Casal M+M</SelectItem>
            </SelectContent>
          </Select>
          <Select value={radius} onValueChange={setRadius}>
            <SelectTrigger><SelectValue placeholder="Raio" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Qualquer distância</SelectItem>
              <SelectItem value="5">Até 5 km</SelectItem>
              <SelectItem value="10">Até 10 km</SelectItem>
              <SelectItem value="25">Até 25 km</SelectItem>
              <SelectItem value="50">Até 50 km</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {(results ?? []).map((p: any) => (
          <Link key={p.user_id} to={"/u/$handle" as never} params={{ handle: p.handle } as never} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:bg-secondary">
            <SignedImage bucket="avatars" path={p.avatar_url} alt={p.display_name} className="h-12 w-12 rounded-full object-cover" />
            <div className="flex-1">
              <p className="text-sm font-semibold">{p.display_name} {p.verified && <VerifiedBadge />}</p>
              <p className="text-xs text-muted-foreground">@{p.handle} {p.city && `• ${p.city}`}</p>
              {(p.interests ?? []).length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {(p.interests as string[]).slice(0, 3).map((i) => <Badge key={i} variant="outline" className="text-[10px]">{i}</Badge>)}
                </div>
              )}
            </div>
          </Link>
        ))}
        {results && results.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum resultado.</p>}
      </div>
    </div>
  );
}
