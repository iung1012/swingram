import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Flag } from "lucide-react";

type TargetType = "user" | "post" | "comment" | "message" | "chat";

const REASONS = [
  { v: "menor", label: "Suspeita de menor de idade" },
  { v: "ncii", label: "Conteúdo íntimo sem consentimento" },
  { v: "perfil_falso", label: "Perfil falso / catfish" },
  { v: "spam", label: "Spam ou golpe" },
  { v: "abuso", label: "Abuso, assédio ou ódio" },
  { v: "outro", label: "Outro" },
];

export function ReportDialog({
  targetType,
  targetId,
  trigger,
  open: openProp,
  onOpenChange,
}: {
  targetType: TargetType;
  targetId: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = (v: boolean) => {
    if (onOpenChange) onOpenChange(v);
    else setInternalOpen(v);
  };

  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Você precisa estar logado.");
      setSubmitting(false);
      return;
    }
    const priority = reason === "menor" || reason === "ncii" ? 1 : 5;
    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      target_type: targetType,
      target_id: targetId,
      reason,
      details,
      priority,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Não foi possível enviar a denúncia.");
      return;
    }
    toast.success("Denúncia enviada. Nossa equipe vai revisar.");
    setOpen(false);
    setDetails("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <Flag className="mr-1 h-4 w-4" /> Denunciar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Denunciar</DialogTitle>
          <DialogDescription>
            Use isso para conteúdo abusivo, golpe, perfis falsos ou suspeita de menor de idade.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {REASONS.map((r) => (
                <SelectItem key={r.v} value={r.v}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Descreva (opcional, max 500 caracteres)"
            maxLength={500}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={submitting}>Enviar denúncia</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
