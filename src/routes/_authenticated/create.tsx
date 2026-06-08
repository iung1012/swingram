import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { uploadToBucket } from "@/lib/storage";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/create")({
  ssr: false,
  head: () => ({ meta: [{ title: "Postar — Brasa Swing" }] }),
  component: CreatePost,
});

function CreatePost() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [caption, setCaption] = useState("");
  const [nsfw, setNsfw] = useState(true);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []).slice(0, 10);
    setFiles(list);
  }

  function removeAt(i: number) {
    setFiles((s) => s.filter((_, idx) => idx !== i));
  }

  async function submit() {
    if (!user) return;
    if (files.length === 0) return toast.error("Adicione pelo menos 1 foto");
    if (!consent) return toast.error("Você precisa confirmar a declaração de idade e consentimento");
    setSubmitting(true);
    try {
      const { data: post, error } = await supabase
        .from("posts")
        .insert({ user_id: user.id, caption, nsfw, moderation_status: "pending" })
        .select()
        .single();
      if (error) throw error;

      const uploads = await Promise.all(
        files.map(async (f, idx) => {
          const path = await uploadToBucket("posts", user.id, f, post.id);
          return { post_id: post.id, url: path, order: idx };
        }),
      );
      await supabase.from("post_media").insert(uploads);

      await supabase.from("age_consent_records").insert({
        post_id: post.id,
        user_id: user.id,
        attestation_text: "Declaro ter 18+ e ter consentimento de todas as pessoas retratadas.",
        user_agent: navigator.userAgent,
      });

      toast.success("Enviado! Aguardando aprovação da moderação.");
      nav({ to: "/profile" });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao postar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <Card className="p-5">
        <h1 className="mb-4 text-xl font-bold">Novo post</h1>
        <div className="space-y-4">
          <div>
            <Label>Fotos (até 10)</Label>
            <input type="file" accept="image/*" multiple onChange={handleFiles} className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground" />
            {files.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {files.map((f, i) => (
                  <div key={i} className="relative">
                    <img src={URL.createObjectURL(f)} alt="" className="aspect-square w-full rounded-md object-cover" />
                    <button onClick={() => removeAt(i)} className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-white"><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={2000} placeholder="O que rola hoje..." />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-semibold">Marcar como NSFW</p>
              <p className="text-xs text-muted-foreground">Aplica blur por padrão até o usuário tocar</p>
            </div>
            <Switch checked={nsfw} onCheckedChange={setNsfw} />
          </div>
          <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
            <Checkbox checked={consent} onCheckedChange={(v) => setConsent(!!v)} className="mt-0.5" />
            <span>Declaro que <strong>todos os retratados têm 18+</strong> e consentiram a publicação. Esta declaração é registrada com timestamp.</span>
          </label>
          <Button className="w-full" onClick={submit} disabled={submitting}>{submitting ? "Enviando..." : "Publicar (vai pra revisão)"}</Button>
        </div>
      </Card>
    </div>
  );
}
