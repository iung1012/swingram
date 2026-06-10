import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { api } from "@/integrations/api/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { uploadToBucket } from "@/lib/storage";
import { snapAndFuzz } from "@/lib/geo";
import { PROFILE_VISIBILITY_OPTIONS, type ProfileVisibility } from "@/lib/privacy";

export const Route = createFileRoute("/_authenticated/onboarding")({
  ssr: false,
  head: () => ({ meta: [{ title: "Onboarding — Brasa Swing" }] }),
  component: Onboarding,
});

const INTERESTS = ["Casual", "Swing", "Exibicionismo", "Voyeurismo", "Encontros", "Festas", "Fetiches", "BDSM", "Fotografia íntima", "Online"];

function Onboarding() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [profileType, setProfileType] = useState<string>("single_m");
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [city, setCity] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [shareLocation, setShareLocation] = useState(false);
  const [profileVisibility, setProfileVisibility] = useState<ProfileVisibility>("public");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleInterest(i: string) {
    setInterests((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
  }

  function requestLocation() {
    if (!navigator.geolocation) return toast.error("Geolocalização indisponível");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setShareLocation(true); toast.success("Localização capturada"); },
      () => toast.error("Permissão negada"),
    );
  }

  async function finish() {
    if (!user) return;
    if (!handle.match(/^[a-z0-9_]{3,24}$/)) return toast.error("@ inválido. Use 3-24 caracteres: a-z, 0-9, _");
    if (!displayName.trim()) return toast.error("Nome obrigatório");
    if (!birthDate) return toast.error("Data de nascimento obrigatória");

    setSaving(true);
    try {
      let avatarPath: string | null = null;
      if (avatarFile) avatarPath = await uploadToBucket("avatars", user.id, avatarFile);

      const snap = coords && shareLocation ? snapAndFuzz(user.id, coords.lat, coords.lng) : { lat_snap: null, lng_snap: null };

      const { error } = await api.from("profiles").upsert({
        user_id: user.id,
        handle: handle.toLowerCase(),
        display_name: displayName,
        bio,
        birth_date: birthDate,
        profile_type: profileType as never,
        interests,
        city: city || null,
        avatar_url: avatarPath,
        profile_visibility: profileVisibility,
        share_location: shareLocation,
        lat_snap: snap.lat_snap,
        lng_snap: snap.lng_snap,
        onboarding_complete: true,
        terms_version: "v1",
        terms_accepted_at: new Date().toISOString(),
      });

      if (error) throw error;
      toast.success("Perfil pronto! Bem-vindo(a) ao Brasa Swing");
      nav({ to: "/home" });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <Card className="p-6">
        <div className="mb-4">
          <h1 className="text-xl font-bold">Configure seu perfil</h1>
          <p className="text-sm text-muted-foreground">Passo {step + 1} de 4</p>
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <div>
              <Label>Tipo de perfil</Label>
              <Select value={profileType} onValueChange={setProfileType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single_m">Homem solteiro</SelectItem>
                  <SelectItem value="single_f">Mulher solteira</SelectItem>
                  <SelectItem value="single_nb">Pessoa não-binária</SelectItem>
                  <SelectItem value="couple_mf">Casal H+M</SelectItem>
                  <SelectItem value="couple_mm">Casal H+H</SelectItem>
                  <SelectItem value="couple_ff">Casal M+M</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>@ (único)</Label><Input value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase())} placeholder="seunome" maxLength={24} /></div>
            <div><Label>Nome de exibição</Label><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={50} /></div>
            <div><Label>Data de nascimento</Label><Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} /></div>
            <Button className="w-full" onClick={() => setStep(1)}>Continuar</Button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div><Label>Avatar</Label><Input type="file" accept="image/*" onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)} /></div>
            <div><Label>Bio</Label><Textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} placeholder="Conte um pouco sobre você..." /></div>
            <div><Label>Cidade</Label><Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ex: São Paulo" /></div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(0)}>Voltar</Button>
              <Button className="flex-1" onClick={() => setStep(2)}>Continuar</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Label>Seus interesses</Label>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((i) => (
                <Badge key={i} onClick={() => toggleInterest(i)} variant={interests.includes(i) ? "default" : "outline"} className="cursor-pointer px-3 py-1.5">{i}</Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Voltar</Button>
              <Button className="flex-1" onClick={() => setStep(3)}>Continuar</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border p-3">
              <p className="mb-2 text-sm font-semibold">Visibilidade do perfil</p>
              <Select value={profileVisibility} onValueChange={(v) => setProfileVisibility(v as ProfileVisibility)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROFILE_VISIBILITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex flex-col items-start">
                        <span>{opt.label}</span>
                        <span className="text-[11px] text-muted-foreground">{opt.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Compartilhar localização</p>
                  <p className="text-xs text-muted-foreground">Sua posição é arredondada para ~500m com offset aleatório. Nunca exibimos a real.</p>
                </div>
                <Switch checked={shareLocation} onCheckedChange={(v) => v ? requestLocation() : setShareLocation(false)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Depois você pode pedir verificação de identidade pra ganhar o selo ✅.</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>Voltar</Button>
              <Button className="flex-1" onClick={finish} disabled={saving}>Concluir</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

