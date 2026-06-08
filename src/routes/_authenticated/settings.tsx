import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile } from "@/hooks/use-profile";
import { snapAndFuzz } from "@/lib/geo";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  ssr: false,
  head: () => ({ meta: [{ title: "Configurações — Spark" }] }),
  component: Settings,
});

function Settings() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { data: profile, refetch } = useMyProfile(user?.id);
  if (!profile) return <p className="p-6 text-center">Carregando...</p>;

  async function toggle(field: "share_location" | "invisible_mode" | "nsfw_blur_default", value: boolean) {
    await supabase.from("profiles").update({ [field]: value } as never).eq("user_id", user!.id);
    refetch();
  }

  function refreshLocation() {
    if (!navigator.geolocation) return toast.error("Geolocalização indisponível");
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const snap = snapAndFuzz(user!.id, pos.coords.latitude, pos.coords.longitude);
      await supabase.from("profiles").update({ ...snap, share_location: true }).eq("user_id", user!.id);
      refetch();
      toast.success("Localização atualizada (fuzzy)");
    });
  }

  async function deleteAccount() {
    if (!confirm("Tem certeza? Sua conta e dados serão removidos.")) return;
    await supabase.from("profiles").update({ banned: true }).eq("user_id", user!.id);
    await supabase.auth.signOut();
    nav({ to: "/auth" });
  }

  return (
    <div className="mx-auto max-w-md px-4 py-6 space-y-3">
      <h1 className="text-xl font-bold">Configurações</h1>

      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Privacidade</h2>
        <Row label="Compartilhar localização" desc="Posição arredondada para ~500m" checked={profile.share_location} onChange={(v) => toggle("share_location", v)} />
        <Row label="Modo invisível" desc="Some do mapa mas vê os outros" checked={profile.invisible_mode} onChange={(v) => toggle("invisible_mode", v)} />
        <Row label="Blur em NSFW por padrão" desc="Conteúdo +18 começa borrado" checked={profile.nsfw_blur_default} onChange={(v) => toggle("nsfw_blur_default", v)} />
        <Button variant="outline" size="sm" className="w-full" onClick={refreshLocation}>Atualizar minha localização</Button>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="font-semibold text-destructive">Zona perigosa</h2>
        <Button variant="destructive" className="w-full" onClick={deleteAccount}>Deletar minha conta</Button>
      </Card>
    </div>
  );
}

function Row({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
