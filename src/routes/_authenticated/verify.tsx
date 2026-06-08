import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { uploadToBucket } from "@/lib/storage";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { ShieldCheck, Clock, XCircle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/verify")({
  ssr: false,
  head: () => ({ meta: [{ title: "Verificação — Brasa Swing" }] }),
  component: Verify,
});

function Verify() {
  const { user } = useAuth();
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: existing, refetch } = useQuery({
    queryKey: ["my-verification", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("verification_requests")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  async function submit() {
    if (!user || !front || !selfie) return toast.error("Frente do documento e selfie são obrigatórios");
    setSubmitting(true);
    try {
      const [frontPath, backPath, selfiePath] = await Promise.all([
        uploadToBucket("verification", user.id, front, "front"),
        back ? uploadToBucket("verification", user.id, back, "back") : Promise.resolve(null),
        uploadToBucket("verification", user.id, selfie, "selfie"),
      ]);
      const { error } = await supabase.from("verification_requests").insert({
        user_id: user.id,
        doc_front_path: frontPath,
        doc_back_path: backPath,
        selfie_path: selfiePath,
      });
      if (error) throw error;
      toast.success("Enviado! Você receberá o selo após análise.");
      refetch();
      setFront(null); setBack(null); setSelfie(null);
    } catch (e: any) { toast.error(e.message); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">Verificação de identidade</h1>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Envie RG ou CNH (frente e verso) + uma selfie segurando o documento. Vamos analisar e te dar o selo ✅.
          Os arquivos ficam em armazenamento privado, acessíveis apenas pela equipe.
        </p>

        {existing && existing.status === "pending" && (
          <Alert className="mb-4"><Clock className="h-4 w-4" /><AlertDescription>Aguardando análise.</AlertDescription></Alert>
        )}
        {existing && existing.status === "approved" && (
          <Alert className="mb-4"><CheckCircle2 className="h-4 w-4" /><AlertDescription>Aprovado!</AlertDescription></Alert>
        )}
        {existing && existing.status === "rejected" && (
          <Alert variant="destructive" className="mb-4"><XCircle className="h-4 w-4" /><AlertDescription>Rejeitado: {existing.notes || "envie novamente"}</AlertDescription></Alert>
        )}

        {(!existing || existing.status !== "pending") && (
          <div className="space-y-3">
            <div><Label>Documento — frente</Label><input type="file" accept="image/*" onChange={(e) => setFront(e.target.files?.[0] ?? null)} className="block w-full text-sm" /></div>
            <div><Label>Documento — verso (opcional)</Label><input type="file" accept="image/*" onChange={(e) => setBack(e.target.files?.[0] ?? null)} className="block w-full text-sm" /></div>
            <div><Label>Selfie segurando o documento</Label><input type="file" accept="image/*" onChange={(e) => setSelfie(e.target.files?.[0] ?? null)} className="block w-full text-sm" /></div>
            <Button className="w-full" onClick={submit} disabled={submitting}>{submitting ? "Enviando..." : "Enviar para análise"}</Button>
          </div>
        )}
      </Card>
    </div>
  );
}
