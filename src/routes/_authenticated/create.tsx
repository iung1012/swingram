import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { uploadToBucket } from "@/lib/storage";
import { extractHashtags } from "@/lib/hashtags";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { X, ImagePlus, Eye, ShieldCheck, Play, Hash } from "lucide-react";

const MAX_IMAGE_MB = 8;
const MAX_VIDEO_MB = 100;
const MAX_FILES = 10;

type Picked = { file: File; kind: "image" | "video"; preview: string };

export const Route = createFileRoute("/_authenticated/create")({
  ssr: false,
  head: () => ({ meta: [{ title: "Postar — Brasa Swing" }] }),
  component: CreatePost,
});

function CreatePost() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [files, setFiles] = useState<Picked[]>([]);
  const [caption, setCaption] = useState("");
  const [nsfw, setNsfw] = useState(true);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const tags = useMemo(() => extractHashtags(caption), [caption]);
  const hasMedia = files.length > 0;

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []).slice(0, MAX_FILES);
    const next: Picked[] = [];
    for (const f of list) {
      const isImage = f.type.startsWith("image/");
      const isVideo = f.type.startsWith("video/");
      if (!isImage && !isVideo) {
        toast.error(`${f.name}: tipo não suportado`);
        continue;
      }
      const limit = isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB;
      if (f.size > limit * 1024 * 1024) {
        toast.error(`${f.name}: arquivo maior que ${limit}MB`);
        continue;
      }
      next.push({
        file: f,
        kind: isVideo ? "video" : "image",
        preview: URL.createObjectURL(f),
      });
    }
    setFiles(next);
    e.target.value = "";
  }

  function removeAt(i: number) {
    setFiles((s) => {
      const item = s[i];
      if (item) URL.revokeObjectURL(item.preview);
      return s.filter((_, idx) => idx !== i);
    });
  }

  async function submit() {
    if (!user) return;
    if (!hasMedia && !caption.trim()) {
      return toast.error("Adicione mídia ou texto");
    }
    if (hasMedia && !consent) {
      return toast.error("Confirme a declaração de idade e consentimento");
    }
    setSubmitting(true);
    try {
      const { data: post, error } = await supabase
        .from("posts")
        .insert({
          user_id: user.id,
          caption,
          nsfw,
          moderation_status: hasMedia ? "pending" : "approved",
        })
        .select()
        .single();
      if (error) throw error;

      if (hasMedia) {
        const uploads = await Promise.all(
          files.map(async (p, idx) => {
            const path = await uploadToBucket("posts", user.id, p.file, post.id);
            return { post_id: post.id, url: path, order: idx, kind: p.kind };
          }),
        );
        await supabase.from("post_media").insert(uploads);

        await supabase.from("age_consent_records").insert({
          post_id: post.id,
          user_id: user.id,
          attestation_text:
            "Declaro ter 18+ e ter consentimento de todas as pessoas retratadas.",
          user_agent: navigator.userAgent,
        });
      }

      toast.success(
        hasMedia
          ? "Enviado. Aguardando aprovação da moderação."
          : "Publicado",
      );
      nav({ to: "/profile" });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao postar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-12 pt-6">
      <header className="mb-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Publicação
        </p>
        <h1 className="mt-1 text-[26px] font-semibold tracking-tight">Novo post</h1>
      </header>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border p-4">
          <label className="block">
            <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Fotos ou vídeos · opcional · até {MAX_FILES}
            </span>
            <div className="flex h-28 cursor-pointer items-center justify-center rounded-xl border border-dashed border-border bg-secondary/40 transition-colors hover:bg-secondary/60">
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleFiles}
                className="sr-only"
              />
              <span className="inline-flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
                <ImagePlus className="h-4 w-4" strokeWidth={2} />
                Escolher fotos ou vídeos
              </span>
            </div>
          </label>
          {files.length > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {files.map((p, i) => (
                <div
                  key={i}
                  className="relative overflow-hidden rounded-md border border-border bg-black"
                >
                  {p.kind === "video" ? (
                    <>
                      <video
                        src={p.preview}
                        className="aspect-square w-full object-cover"
                        muted
                        playsInline
                      />
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <Play className="h-6 w-6 text-white drop-shadow" fill="white" />
                      </span>
                    </>
                  ) : (
                    <img
                      src={p.preview}
                      alt=""
                      className="aspect-square w-full object-cover"
                    />
                  )}
                  <button
                    onClick={() => removeAt(i)}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white backdrop-blur"
                    aria-label="Remover"
                  >
                    <X className="h-3 w-3" strokeWidth={2.4} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Imagens até {MAX_IMAGE_MB}MB · vídeos até {MAX_VIDEO_MB}MB. Sem mídia? Pode postar só texto.
          </p>
        </div>

        <div className="border-b border-border p-4">
          <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Descrição · use #tag para indexar
          </span>
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={2000}
            placeholder="Escreva algo… use #encontros #sp para aparecer nas buscas"
            className="min-h-[88px] resize-none rounded-lg border-border bg-secondary/40 text-[14px]"
          />
          <div className="mt-1.5 flex items-center justify-between">
            <div className="flex flex-wrap gap-1">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-0.5 rounded-md border border-border bg-secondary/60 px-1.5 py-0.5 text-[10.5px] font-medium text-foreground/85"
                >
                  <Hash className="h-2.5 w-2.5" strokeWidth={2.4} />
                  {t}
                </span>
              ))}
            </div>
            <p className="text-right text-[11px] text-muted-foreground tabular-nums">
              {caption.length} / 2000
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md border border-border bg-secondary/60">
              <Eye className="h-3.5 w-3.5 text-foreground/80" strokeWidth={2} />
            </span>
            <div>
              <p className="text-[14px] font-medium tracking-tight">Marcar como sensível</p>
              <p className="text-[12px] text-muted-foreground">
                Aplica blur por padrão até o usuário tocar
              </p>
            </div>
          </div>
          <Switch checked={nsfw} onCheckedChange={setNsfw} />
        </div>

        {hasMedia && (
          <label className="flex cursor-pointer items-start gap-3 px-4 py-3">
            <Checkbox
              checked={consent}
              onCheckedChange={(v) => setConsent(!!v)}
              className="mt-0.5"
            />
            <span className="flex items-start gap-3 text-[13px] leading-relaxed">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-secondary/60">
                <ShieldCheck
                  className="h-3.5 w-3.5 text-foreground/80"
                  strokeWidth={2}
                />
              </span>
              <span>
                Declaro que <strong className="font-semibold">todos os retratados têm 18+</strong>{" "}
                e consentiram a publicação. Esta declaração é registrada com timestamp.
              </span>
            </span>
          </label>
        )}
      </section>

      <button
        onClick={submit}
        disabled={submitting}
        className="mt-4 flex h-11 w-full items-center justify-center rounded-xl text-[14px] font-medium text-primary-foreground transition active:scale-[0.99] disabled:opacity-60"
        style={{ background: "var(--gradient-brasa-h)" }}
      >
        {submitting
          ? "Enviando…"
          : hasMedia
            ? "Publicar · vai para revisão"
            : "Publicar"}
      </button>
    </div>
  );
}
