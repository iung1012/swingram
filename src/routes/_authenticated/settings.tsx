import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile } from "@/hooks/use-profile";
import { snapAndFuzz } from "@/lib/geo";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  MapPin, EyeOff, Eye, Navigation, ShieldCheck, Download, LogOut, Trash2, ChevronRight, ChevronLeft,
} from "lucide-react";
import { SpiralLoaderBlock } from "@/components/spiral-loader";

export const Route = createFileRoute("/_authenticated/settings")({
  ssr: false,
  head: () => ({ meta: [{ title: "Ajustes — Brasa Swing" }] }),
  component: Settings,
});

function Settings() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { data: profile, refetch } = useMyProfile(user?.id);
  if (!profile) return <p className="p-6 text-center text-sm text-muted-foreground">Carregando...</p>;

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
      toast.success("Localização atualizada");
    });
  }

  async function exportData() {
    if (!user) return;
    const [{ data: prof }, { data: posts }, { data: msgs }, { data: likes }, { data: comments }] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("posts").select("*, post_media(*)").eq("user_id", user.id),
      supabase.from("messages").select("*").eq("sender_id", user.id),
      supabase.from("likes").select("*").eq("user_id", user.id),
      supabase.from("comments").select("*").eq("user_id", user.id),
    ]);
    const payload = { exported_at: new Date().toISOString(), profile: prof, posts, messages: msgs, likes, comments };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `brasa-meus-dados-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Download iniciado");
  }

  async function logout() {
    await supabase.auth.signOut();
    nav({ to: "/auth" });
  }

  async function deleteAccount() {
    if (!confirm("Tem certeza? Sua conta e dados serão removidos.")) return;
    await supabase.from("profiles").update({ banned: true }).eq("user_id", user!.id);
    await supabase.auth.signOut();
    nav({ to: "/auth" });
  }

  return (
    <div className="mx-auto max-w-md px-4 pt-4 pb-6">
      {/* Header bar */}
      <div className="mb-6 flex items-center justify-between">
        <Link to="/profile" className="flex items-center gap-1 text-sm text-primary">
          <ChevronLeft className="h-5 w-5" /> Perfil
        </Link>
        <h1 className="text-base font-semibold">Ajustes</h1>
        <div className="w-12" />
      </div>

      <Group title="Privacidade">
        <ToggleRow
          icon={MapPin} iconBg="from-orange-400 to-red-500"
          label="Compartilhar localização"
          desc="Posição arredondada a ~500m"
          checked={!!profile.share_location} onChange={(v) => toggle("share_location", v)}
        />
        <Divider />
        <ToggleRow
          icon={profile.invisible_mode ? EyeOff : Eye} iconBg="from-slate-400 to-slate-600"
          label="Modo invisível"
          desc="Some do mapa mas vê os outros"
          checked={!!profile.invisible_mode} onChange={(v) => toggle("invisible_mode", v)}
        />
        <Divider />
        <ToggleRow
          icon={Eye} iconBg="from-amber-400 to-orange-500"
          label="Blur em NSFW por padrão"
          desc="Conteúdo +18 começa borrado"
          checked={!!profile.nsfw_blur_default} onChange={(v) => toggle("nsfw_blur_default", v)}
        />
        <Divider />
        <ActionRow icon={Navigation} iconBg="from-yellow-400 to-orange-500" label="Atualizar minha localização" onClick={refreshLocation} />
      </Group>

      <Group title="Segurança">
        <ActionRow icon={ShieldCheck} iconBg="from-orange-500 to-red-600" label="Autenticação em 2 fatores" to="/security" />
      </Group>

      <Group title="Dados pessoais (LGPD)">
        <ActionRow icon={Download} iconBg="from-amber-500 to-orange-600" label="Exportar meus dados" onClick={exportData} />
      </Group>

      <Group title="Conta">
        <ActionRow icon={LogOut} iconBg="from-zinc-500 to-zinc-700" label="Sair" onClick={logout} />
        <Divider />
        <ActionRow icon={Trash2} iconBg="from-red-500 to-red-700" label="Deletar minha conta" onClick={deleteAccount} danger />
      </Group>

      <p className="mt-8 text-center text-[11px] text-muted-foreground">Brasa Swing · v1.0</p>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</h2>
      <div className="overflow-hidden rounded-2xl border border-border bg-card/60 backdrop-blur">{children}</div>
    </div>
  );
}

function Divider() { return <div className="ml-14 h-px bg-border" />; }

function IconBadge({ icon: Icon, bg }: { icon: React.ComponentType<{ className?: string }>; bg: string }) {
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${bg} shadow-sm`}>
      <Icon className="h-4.5 w-4.5 text-white" />
    </span>
  );
}

function ToggleRow({ icon, iconBg, label, desc, checked, onChange }: {
  icon: React.ComponentType<{ className?: string }>; iconBg: string;
  label: string; desc: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-3">
      <IconBadge icon={icon} bg={iconBg} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function ActionRow({ icon, iconBg, label, onClick, to, danger }: {
  icon: React.ComponentType<{ className?: string }>; iconBg: string; label: string;
  onClick?: () => void; to?: string; danger?: boolean;
}) {
  const inner = (
    <>
      <IconBadge icon={icon} bg={iconBg} />
      <span className={`flex-1 text-sm font-medium ${danger ? "text-destructive" : ""}`}>{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </>
  );
  if (to) return <Link to={to as never} className="flex items-center gap-3 px-3.5 py-3 transition active:bg-secondary/50">{inner}</Link>;
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition active:bg-secondary/50">
      {inner}
    </button>
  );
}
