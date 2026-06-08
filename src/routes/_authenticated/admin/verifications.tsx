import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SignedImage } from "@/components/signed-image";
import { toast } from "sonner";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/admin/verifications")({
  ssr: false,
  component: VerificationsAdmin,
});

function VerificationsAdmin() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["adm-verifications"],
    queryFn: async () => {
      const { data } = await supabase
        .from("verification_requests")
        .select("*, profiles(handle, display_name)")
        .eq("status", "pending")
        .order("created_at");
      return data ?? [];
    },
  });

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Verificações pendentes</h1>
      {(data ?? []).map((v: any) => <Row key={v.id} v={v} onDone={() => qc.invalidateQueries({ queryKey: ["adm-verifications"] })} />)}
      {data && data.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Tudo certo!</p>}
    </div>
  );
}

function Row({ v, onDone }: { v: any; onDone: () => void }) {
  const [notes, setNotes] = useState("");

  async function decide(status: "approved" | "rejected") {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("verification_requests").update({
      status, reviewed_by: user!.id, reviewed_at: new Date().toISOString(), notes,
    }).eq("id", v.id);
    if (status === "approved") {
      await supabase.from("profiles").update({ verified: true, verified_at: new Date().toISOString() }).eq("user_id", v.user_id);
    }
    await supabase.from("audit_logs").insert({ admin_id: user!.id, action: `verify_${status}`, target_type: "verification", target_id: v.id });
    toast.success(`Verificação ${status === "approved" ? "aprovada" : "rejeitada"}`);
    onDone();
  }

  return (
    <Card className="p-4">
      <div className="mb-3">
        <p className="font-semibold">{v.profiles?.display_name} <span className="text-muted-foreground">@{v.profiles?.handle}</span></p>
        <p className="text-xs text-muted-foreground">Enviado em {new Date(v.created_at).toLocaleString("pt-BR")}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div><p className="mb-1 text-xs text-muted-foreground">Frente</p><SignedImage bucket="verification" path={v.doc_front_path} alt="Frente" className="aspect-square w-full rounded object-cover" /></div>
        {v.doc_back_path && <div><p className="mb-1 text-xs text-muted-foreground">Verso</p><SignedImage bucket="verification" path={v.doc_back_path} alt="Verso" className="aspect-square w-full rounded object-cover" /></div>}
        <div><p className="mb-1 text-xs text-muted-foreground">Selfie</p><SignedImage bucket="verification" path={v.selfie_path} alt="Selfie" className="aspect-square w-full rounded object-cover" /></div>
      </div>
      <Textarea className="mt-3" placeholder="Notas (visíveis ao usuário se rejeitado)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="mt-3 flex gap-2">
        <Button className="flex-1" onClick={() => decide("approved")}>Aprovar</Button>
        <Button variant="destructive" className="flex-1" onClick={() => decide("rejected")}>Rejeitar</Button>
      </div>
    </Card>
  );
}
