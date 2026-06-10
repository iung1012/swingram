import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/integrations/api/client";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile } from "@/hooks/use-profile";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Heart, Check, X, Unlink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/couple")({
  ssr: false,
  head: () => ({ meta: [{ title: "Vínculo de casal — Brasa Swing" }] }),
  component: CouplePage,
});

function CouplePage() {
  const { user } = useAuth();
  const { data: me } = useMyProfile(user?.id);
  const qc = useQueryClient();
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: link } = useQuery({
    queryKey: ["my-couple", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await api
        .from("couple_links")
        .select("*")
        .or(`user_a_id.eq.${user!.id},user_b_id.eq.${user!.id}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) return null;
      const otherId = data.user_a_id === user!.id ? data.user_b_id : data.user_a_id;
      const { data: other } = await api
        .from("profiles")
        .select("handle, display_name, avatar_url, verified")
        .eq("user_id", otherId)
        .maybeSingle();
      return { ...data, other, iAmInitiator: data.user_a_id === user!.id };
    },
  });

  async function invite() {
    if (!user || !me) return;
    const target = handle.trim().toLowerCase().replace(/^@/, "");
    if (!target) return toast.error("Informe o @ do parceiro(a)");
    if (target === me.handle) return toast.error("Você não pode se vincular a si mesmo");
    setBusy(true);
    try {
      const { data: other, error: e1 } = await api
        .from("profiles")
        .select("user_id, verified")
        .eq("handle", target)
        .maybeSingle();
      if (e1 || !other) throw new Error("Perfil não encontrado");
      const { error } = await api.from("couple_links").insert({
        user_a_id: user.id,
        user_b_id: other.user_id,
        status: "pending",
      });
      if (error) {
        if (error.code === "23505") throw new Error("Já existe um vínculo com este usuário");
        throw error;
      }
      toast.success("Convite enviado! Aguarde aceite do parceiro(a).");
      setHandle("");
      qc.invalidateQueries({ queryKey: ["my-couple"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function respond(accept: boolean) {
    if (!link || !user || !me) return;
    if (accept) {
      // Block if either side not verified
      const { data: a } = await api.from("profiles").select("verified").eq("user_id", link.user_a_id).maybeSingle();
      if (!a?.verified || !me.verified) {
        toast.error("Ambos precisam estar verificados antes de ativar o vínculo de casal.");
        return;
      }
      await api
        .from("couple_links")
        .update({ status: "active", confirmed_at: new Date().toISOString() })
        .eq("id", link.id);
      toast.success("Vínculo ativado 💞");
    } else {
      await api.from("couple_links").delete().eq("id", link.id);
      toast("Convite recusado");
    }
    qc.invalidateQueries({ queryKey: ["my-couple"] });
  }

  async function dissolve() {
    if (!link) return;
    if (!confirm("Dissolver o vínculo de casal?")) return;
    await api.from("couple_links").update({ status: "dissolved" }).eq("id", link.id);
    toast("Vínculo dissolvido");
    qc.invalidateQueries({ queryKey: ["my-couple"] });
  }

  return (
    <div className="mx-auto max-w-md px-4 py-6 space-y-3">
      <h1 className="flex items-center gap-2 text-xl font-bold"><Heart className="text-primary" /> Vínculo de casal</h1>
      <p className="text-sm text-muted-foreground">
        Conecte seu perfil ao do parceiro(a). Ambos precisam estar verificados para o vínculo ficar ativo.
      </p>

      {link && link.status === "active" && link.other && (
        <Card className="space-y-3 p-4">
          <Alert><Check className="h-4 w-4" /><AlertDescription>Vinculado(a) com <strong>@{link.other.handle}</strong></AlertDescription></Alert>
          <Button variant="destructive" size="sm" className="w-full" onClick={dissolve}>
            <Unlink className="mr-1 h-4 w-4" /> Dissolver vínculo
          </Button>
        </Card>
      )}

      {link && link.status === "pending" && link.other && (
        <Card className="space-y-3 p-4">
          {link.iAmInitiator ? (
            <Alert><AlertDescription>Aguardando @{link.other.handle} aceitar o convite.</AlertDescription></Alert>
          ) : (
            <>
              <Alert><AlertDescription><strong>@{link.other.handle}</strong> quer se vincular a você.</AlertDescription></Alert>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => respond(true)}><Check className="mr-1 h-4 w-4" /> Aceitar</Button>
                <Button variant="outline" className="flex-1" onClick={() => respond(false)}><X className="mr-1 h-4 w-4" /> Recusar</Button>
              </div>
            </>
          )}
        </Card>
      )}

      {(!link || link.status === "dissolved") && (
        <Card className="space-y-3 p-4">
          <Label>Convide pelo @</Label>
          <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@parceiro" maxLength={25} />
          <Button className="w-full" onClick={invite} disabled={busy}>Enviar convite</Button>
        </Card>
      )}
    </div>
  );
}

