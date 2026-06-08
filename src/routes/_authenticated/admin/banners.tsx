import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { uploadToBucket } from "@/lib/storage";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SignedImage } from "@/components/signed-image";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/banners")({
  ssr: false,
  component: BannersAdmin,
});

function BannersAdmin() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [position, setPosition] = useState("home_top");

  const { data } = useQuery({
    queryKey: ["adm-banners"],
    queryFn: async () => {
      const { data } = await supabase.from("banners").select("*").order("order");
      return data ?? [];
    },
  });

  async function add() {
    if (!file || !user) return;
    const path = await uploadToBucket("banners", user.id, file, "banner");
    // banners bucket is private; show via signed url
    await supabase.from("banners").insert({ image_url: path, link: link || null, position, active: true, order: (data?.length ?? 0) });
    toast.success("Banner adicionado");
    setFile(null); setLink("");
    qc.invalidateQueries({ queryKey: ["adm-banners"] });
  }

  async function toggle(id: string, active: boolean) {
    await supabase.from("banners").update({ active }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["adm-banners"] });
  }

  async function remove(id: string) {
    await supabase.from("banners").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["adm-banners"] });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Banners</h1>
      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Novo banner</h2>
        <div><Label>Imagem</Label><input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm" /></div>
        <div><Label>Link (opcional)</Label><Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." /></div>
        <div><Label>Posição</Label><Input value={position} onChange={(e) => setPosition(e.target.value)} /></div>
        <Button onClick={add}>Adicionar</Button>
      </Card>

      <div className="space-y-2">
        {(data ?? []).map((b: any) => (
          <Card key={b.id} className="flex items-center gap-3 p-3">
            <SignedImage bucket="banners" path={b.image_url} alt="banner" className="h-16 w-28 rounded object-cover" />
            <div className="flex-1">
              <p className="text-sm">{b.position}</p>
              {b.link && <a href={b.link} className="text-xs text-muted-foreground underline">{b.link}</a>}
            </div>
            <Switch checked={b.active} onCheckedChange={(v) => toggle(b.id, v)} />
            <Button variant="ghost" size="sm" onClick={() => remove(b.id)}>Remover</Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
