import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/integrations/api/client";
import { useAuth } from "@/hooks/use-auth";
import { uploadToBucket } from "@/lib/storage";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  ShieldCheck,
  Clock,
  XCircle,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Camera,
  IdCard,
  UserCheck,
  RotateCcw,
  Upload,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/verify")({
  ssr: false,
  head: () => ({ meta: [{ title: "Verificação — Brasa Swing" }] }),
  component: Verify,
});

const STEPS = [
  { id: 1, label: "Documento frente", icon: IdCard },
  { id: 2, label: "Documento verso", icon: IdCard },
  { id: 3, label: "Selfie", icon: Camera },
  { id: 4, label: "Revisar", icon: UserCheck },
];

function Verify() {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: existing, refetch } = useQuery({
    queryKey: ["my-verification", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await api
        .from("verification_requests")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (front) {
      const url = URL.createObjectURL(front);
      setFrontPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setFrontPreview(null);
    }
  }, [front]);

  useEffect(() => {
    if (back) {
      const url = URL.createObjectURL(back);
      setBackPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setBackPreview(null);
    }
  }, [back]);

  useEffect(() => {
    if (selfie) {
      const url = URL.createObjectURL(selfie);
      setSelfiePreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setSelfiePreview(null);
    }
  }, [selfie]);

  async function submit() {
    if (!user || !front || !selfie) return toast.error("Frente do documento e selfie são obrigatórios");
    setSubmitting(true);
    try {
      const [frontPath, backPath, selfiePath] = await Promise.all([
        uploadToBucket("verification", user.id, front, "front"),
        back ? uploadToBucket("verification", user.id, back, "back") : Promise.resolve(null),
        uploadToBucket("verification", user.id, selfie, "selfie"),
      ]);
      const { error } = await api.from("verification_requests").insert({
        user_id: user.id,
        doc_front_path: frontPath,
        doc_back_path: backPath,
        selfie_path: selfiePath,
      });
      if (error) throw error;
      toast.success("Enviado! Você receberá o selo após análise.");
      refetch();
      setFront(null); setBack(null); setSelfie(null);
      setStep(1);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const canNext =
    (step === 1 && !!front) ||
    (step === 2) ||
    (step === 3 && !!selfie) ||
    step === 4;

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <Card className="overflow-hidden rounded-2xl border border-border bg-card p-0 shadow-sm">
        {/* Header */}
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 px-5 pt-6 pb-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">Verificação de identidade</h1>
          </div>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Envie seu documento e uma selfie para receber o selo de verificado. Seus dados ficam em armazenamento privado e só a equipe de moderação tem acesso.
          </p>
        </div>

        {/* Status */}
        {existing && existing.status === "pending" && (
          <div className="mx-5 mt-4">
            <Alert className="rounded-xl border-amber-500/20 bg-amber-500/10">
              <Clock className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-[13px] text-amber-700">
                Solicitação em análise. Você será notificado quando for revisada.
              </AlertDescription>
            </Alert>
          </div>
        )}
        {existing && existing.status === "approved" && (
          <div className="mx-5 mt-4">
            <Alert className="rounded-xl border-emerald-500/20 bg-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-[13px] text-emerald-700">
                Conta verificada! O selo já aparece no seu perfil.
              </AlertDescription>
            </Alert>
          </div>
        )}
        {existing && existing.status === "rejected" && (
          <div className="mx-5 mt-4">
            <Alert variant="destructive" className="rounded-xl">
              <XCircle className="h-4 w-4" />
              <AlertDescription className="text-[13px]">
                Rejeitado: {existing.notes || "Envie novamente com imagens mais nítidas."}
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Stepper */}
        {(!existing || existing.status !== "pending") && (
          <div className="mx-5 mt-5">
            <div className="flex items-center justify-between">
              {STEPS.map((s, idx) => {
                const active = step === s.id;
                const done = step > s.id;
                const isLast = idx === STEPS.length - 1;
                return (
                  <div key={s.id} className="flex flex-1 items-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full border-2 text-[11px] font-bold transition-colors",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : done
                              ? "border-primary/60 bg-primary/10 text-primary"
                              : "border-border bg-card text-muted-foreground"
                        )}
                      >
                        {done ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <s.icon className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <span
                        className={cn(
                          "text-[10px] font-medium",
                          active ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {s.label}
                      </span>
                    </div>
                    {!isLast && (
                      <div
                        className={cn(
                          "mx-1 h-[2px] flex-1 rounded-full transition-colors",
                          done ? "bg-primary/40" : "bg-border"
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step content */}
        {(!existing || existing.status !== "pending") && (
          <div className="px-5 pt-5 pb-6">
            {step === 1 && (
              <StepUpload
                title="Frente do documento"
                subtitle="RG ou CNH — foto nítida, sem reflexos ou cortes."
                required
                file={front}
                preview={frontPreview}
                onSelect={(f) => setFront(f)}
                onClear={() => setFront(null)}
              />
            )}
            {step === 2 && (
              <StepUpload
                title="Verso do documento"
                subtitle="Opcional, mas ajuda na análise."
                file={back}
                preview={backPreview}
                onSelect={(f) => setBack(f)}
                onClear={() => setBack(null)}
              />
            )}
            {step === 3 && (
              <StepUpload
                title="Selfie com o documento"
                subtitle="Segure o documento aberto ao lado do rosto, com boa iluminação."
                required
                file={selfie}
                preview={selfiePreview}
                onSelect={(f) => setSelfie(f)}
                onClear={() => setSelfie(null)}
              />
            )}
            {step === 4 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Revise antes de enviar</h3>
                <ReviewItem label="Frente do documento" file={front} preview={frontPreview} required />
                <ReviewItem label="Verso do documento" file={back} preview={backPreview} />
                <ReviewItem label="Selfie" file={selfie} preview={selfiePreview} required />
                <p className="text-[12px] text-muted-foreground">
                  Ao enviar, você declara que as imagens são verdadeiras e concorda com a análise pela moderação.
                </p>
              </div>
            )}

            {/* Navigation */}
            <div className="mt-6 flex items-center justify-between gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                disabled={step === 1 || submitting}
                className="rounded-xl"
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
              </Button>
              {step < 4 ? (
                <Button
                  size="sm"
                  onClick={() => setStep((s) => s + 1)}
                  disabled={!canNext || submitting}
                  className="rounded-xl"
                >
                  Próximo <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={submit}
                  disabled={submitting}
                  className="rounded-xl"
                >
                  {submitting ? "Enviando..." : "Enviar para análise"}
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function StepUpload({
  title,
  subtitle,
  required,
  file,
  preview,
  onSelect,
  onClear,
}: {
  title: string;
  subtitle: string;
  required?: boolean;
  file: File | null;
  preview: string | null;
  onSelect: (f: File) => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-sm font-semibold">
          {title}
          {required && <span className="ml-1 text-destructive">*</span>}
        </Label>
        <p className="mt-0.5 text-[12px] text-muted-foreground">{subtitle}</p>
      </div>

      {preview ? (
        <div className="relative overflow-hidden rounded-xl border border-border">
          <img
            src={preview}
            alt={title}
            className="aspect-[4/3] w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent px-3 py-2">
            <span className="text-[11px] font-medium text-white">{file?.name}</span>
            <button
              type="button"
              onClick={onClear}
              className="flex items-center gap-1 rounded-lg bg-white/20 px-2 py-1 text-[11px] font-medium text-white backdrop-blur transition hover:bg-white/30"
            >
              <RotateCcw className="h-3 w-3" /> Trocar
            </button>
          </div>
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-secondary/30 px-4 py-8 transition-colors hover:bg-secondary/50">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Upload className="h-5 w-5 text-primary" />
          </div>
          <span className="text-[13px] font-medium text-foreground">Toque para escolher arquivo</span>
          <span className="text-[11px] text-muted-foreground">JPG, PNG ou HEIC</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onSelect(f);
            }}
          />
        </label>
      )}
    </div>
  );
}

function ReviewItem({
  label,
  file,
  preview,
  required,
}: {
  label: string;
  file: File | null;
  preview: string | null;
  required?: boolean;
}) {
  if (!file) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/30 px-3 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
          <Eye className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <p className="text-[13px] font-medium">{label}</p>
          <p className="text-[11px] text-muted-foreground">
            {required ? "Obrigatório — volte para adicionar" : "Não enviado (opcional)"}
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
      <img
        src={preview!}
        alt={label}
        className="h-12 w-12 rounded-lg object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">{label}</p>
        <p className="truncate text-[11px] text-muted-foreground">{file.name}</p>
      </div>
      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
    </div>
  );
}

