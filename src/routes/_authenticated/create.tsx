import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { uploadToBucket } from "@/lib/storage";
import { extractHashtags } from "@/lib/hashtags";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  X,
  ImagePlus,
  Eye,
  ShieldCheck,
  Play,
  Hash,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Sparkles,
  Upload,
  Send,
  Trash2,
} from "lucide-react";

const DRAFT_KEY_PREFIX = "brasa:create-draft:";
type Draft = { caption: string; nsfw: boolean; savedAt: number };

const MAX_IMAGE_MB = 8;
const MAX_VIDEO_MB = 100;
const MAX_FILES = 10;
const MAX_CAPTION = 2000;
const SUGGESTED_TAGS = [
  "encontros",
  "casal",
  "sp",
  "festa",
  "viagem",
  "lifestyle",
  "swing",
  "club",
];

type Picked = { id: string; file: File; kind: "image" | "video"; preview: string };

export const Route = createFileRoute("/_authenticated/create")({
  ssr: false,
  head: () => ({ meta: [{ title: "Postar — Brasa Swing" }] }),
  component: CreatePost,
});

function CreatePost() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [files, setFiles] = useState<Picked[]>([]);
  const [active, setActive] = useState(0);
  const [caption, setCaption] = useState("");
  const [nsfw, setNsfw] = useState(true);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const dragIndex = useRef<number | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const draftLoadedRef = useRef(false);
  const draftKey = user ? `${DRAFT_KEY_PREFIX}${user.id}` : null;

  // Load draft on mount (per user)
  useEffect(() => {
    if (!draftKey || draftLoadedRef.current) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw) as Draft;
        if (d && typeof d.caption === "string") {
          setCaption(d.caption);
          if (typeof d.nsfw === "boolean") setNsfw(d.nsfw);
          setDraftSavedAt(d.savedAt ?? null);
          if (d.caption.trim()) {
            toast.message("Rascunho restaurado", {
              description: "Continuamos de onde você parou.",
            });
          }
        }
      }
    } catch {
      // ignore
    }
    draftLoadedRef.current = true;
  }, [draftKey]);

  // Auto-save draft (debounced)
  useEffect(() => {
    if (!draftKey || !draftLoadedRef.current) return;
    const handle = setTimeout(() => {
      try {
        if (!caption.trim()) {
          localStorage.removeItem(draftKey);
          setDraftSavedAt(null);
          return;
        }
        const now = Date.now();
        const draft: Draft = { caption, nsfw, savedAt: now };
        localStorage.setItem(draftKey, JSON.stringify(draft));
        setDraftSavedAt(now);
      } catch {
        // ignore (quota, private mode, etc.)
      }
    }, 600);
    return () => clearTimeout(handle);
  }, [caption, nsfw, draftKey]);

  function clearDraft() {
    if (!draftKey) return;
    try {
      localStorage.removeItem(draftKey);
    } catch {
      // ignore
    }
    setDraftSavedAt(null);
  }

  function discardDraft() {
    setCaption("");
    clearDraft();
    toast.success("Rascunho descartado");
  }

  const tags = useMemo(() => extractHashtags(caption), [caption]);
  const hasMedia = files.length > 0;
  const remaining = MAX_FILES - files.length;
  const pct = Math.min(100, Math.round((caption.length / MAX_CAPTION) * 100));

  const canSubmit =
    !submitting &&
    (hasMedia || caption.trim().length > 0) &&
    (!hasMedia || consent);

  useEffect(() => {
    return () => {
      files.forEach((f) => URL.revokeObjectURL(f.preview));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (active >= files.length) setActive(Math.max(0, files.length - 1));
  }, [files.length, active]);

  function addFileList(list: FileList | File[]) {
    const arr = Array.from(list).slice(0, remaining);
    if (arr.length === 0) return;
    const next: Picked[] = [];
    for (const f of arr) {
      const isImage = f.type.startsWith("image/");
      const isVideo = f.type.startsWith("video/");
      if (!isImage && !isVideo) {
        toast.error(`${f.name}: tipo não suportado`);
        continue;
      }
      const limit = isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB;
      if (f.size > limit * 1024 * 1024) {
        toast.error(`${f.name}: maior que ${limit}MB`);
        continue;
      }
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file: f,
        kind: isVideo ? "video" : "image",
        preview: URL.createObjectURL(f),
      });
    }
    setFiles((s) => [...s, ...next]);
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFileList(e.target.files);
    e.target.value = "";
  }

  function removeAt(i: number) {
    setFiles((s) => {
      const item = s[i];
      if (item) URL.revokeObjectURL(item.preview);
      return s.filter((_, idx) => idx !== i);
    });
  }

  function reorder(from: number, to: number) {
    if (from === to) return;
    setFiles((s) => {
      const copy = s.slice();
      const [moved] = copy.splice(from, 1);
      copy.splice(to, 0, moved);
      return copy;
    });
    setActive(to);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFileList(e.dataTransfer.files);
  }

  function insertTag(tag: string) {
    const ta = textareaRef.current;
    const insert = ` #${tag}`;
    if (!ta) {
      setCaption((c) => (c + insert).slice(0, MAX_CAPTION));
      return;
    }
    const start = ta.selectionStart ?? caption.length;
    const end = ta.selectionEnd ?? caption.length;
    const next = (caption.slice(0, start) + insert + caption.slice(end)).slice(
      0,
      MAX_CAPTION,
    );
    setCaption(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + insert.length;
      ta.setSelectionRange(pos, pos);
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
    setProgress(0);
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
        const uploads: Array<{
          post_id: string;
          url: string;
          order: number;
          kind: "image" | "video";
        }> = [];
        for (let i = 0; i < files.length; i++) {
          const p = files[i];
          const path = await uploadToBucket("posts", user.id, p.file, post.id);
          uploads.push({ post_id: post.id, url: path, order: i, kind: p.kind });
          setProgress(Math.round(((i + 1) / files.length) * 100));
        }
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
        hasMedia ? "Enviado. Aguardando aprovação da moderação." : "Publicado",
      );
      clearDraft();
      nav({ to: "/profile" });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao postar");
    } finally {
      setSubmitting(false);
    }
  }

  const current = files[active];
  const captionParts = useMemo(() => renderCaption(caption), [caption]);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-32 pt-6">
      <header className="mb-5 flex items-end justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Publicação
          </p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight">
            Novo post
          </h1>
        </div>
        <span className="hidden text-[11px] text-muted-foreground sm:inline">
          {files.length}/{MAX_FILES} mídias
        </span>
      </header>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {/* MEDIA AREA */}
        <div className="border-b border-border p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Fotos ou vídeos · opcional
            </span>
            {hasMedia && (
              <button
                onClick={() => inputRef.current?.click()}
                disabled={remaining <= 0}
                className="text-[11px] font-medium text-foreground/80 underline-offset-2 hover:underline disabled:opacity-40"
              >
                + Adicionar ({remaining} restantes)
              </button>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleInput}
            className="sr-only"
          />

          {!hasMedia ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`flex h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed transition ${
                dragOver
                  ? "border-primary/60 bg-primary/5"
                  : "border-border bg-secondary/40 hover:bg-secondary/60"
              }`}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                <Upload className="h-4 w-4 text-foreground/70" strokeWidth={2} />
              </span>
              <span className="text-[14px] font-medium text-foreground/90">
                Arraste fotos/vídeos aqui
              </span>
              <span className="text-[12px] text-muted-foreground">
                ou clique para escolher · até {MAX_FILES} arquivos
              </span>
            </div>
          ) : (
            <div>
              {/* Carousel main */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={`relative overflow-hidden rounded-xl border bg-black ${
                  dragOver ? "border-primary/60" : "border-border"
                }`}
              >
                <div className="relative aspect-square w-full">
                  {current?.kind === "video" ? (
                    <video
                      key={current.id}
                      src={current.preview}
                      className="h-full w-full object-contain"
                      controls
                      playsInline
                    />
                  ) : current ? (
                    <img
                      src={current.preview}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  ) : null}
                </div>

                {files.length > 1 && (
                  <>
                    <button
                      onClick={() =>
                        setActive((a) => (a - 1 + files.length) % files.length)
                      }
                      className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur"
                      aria-label="Anterior"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setActive((a) => (a + 1) % files.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur"
                      aria-label="Próximo"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                )}

                <div className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider text-white backdrop-blur">
                  {current?.kind === "video" ? "Vídeo" : "Foto"} · {active + 1}/
                  {files.length}
                </div>

                <button
                  onClick={() => removeAt(active)}
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white backdrop-blur"
                  aria-label="Remover"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2.4} />
                </button>
              </div>

              {/* Thumbs */}
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {files.map((p, i) => (
                  <button
                    key={p.id}
                    draggable
                    onDragStart={() => (dragIndex.current = i)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const from = dragIndex.current;
                      if (from != null) reorder(from, i);
                      dragIndex.current = null;
                    }}
                    onClick={() => setActive(i)}
                    className={`group relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-black transition ${
                      i === active
                        ? "border-primary ring-2 ring-primary/40"
                        : "border-border opacity-70 hover:opacity-100"
                    }`}
                    aria-label={`Mídia ${i + 1}`}
                  >
                    {p.kind === "video" ? (
                      <>
                        <video
                          src={p.preview}
                          className="h-full w-full object-cover"
                          muted
                          playsInline
                        />
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                          <Play
                            className="h-4 w-4 text-white drop-shadow"
                            fill="white"
                          />
                        </span>
                      </>
                    ) : (
                      <img
                        src={p.preview}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                    <span className="absolute left-1 top-1 hidden h-4 w-4 items-center justify-center rounded bg-black/60 text-white group-hover:flex">
                      <GripVertical className="h-3 w-3" />
                    </span>
                  </button>
                ))}
                {remaining > 0 && (
                  <button
                    onClick={() => inputRef.current?.click()}
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-secondary/40 text-muted-foreground hover:bg-secondary/60"
                    aria-label="Adicionar mídia"
                  >
                    <ImagePlus className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          <p className="mt-2 text-[11px] text-muted-foreground">
            Imagens até {MAX_IMAGE_MB}MB · vídeos até {MAX_VIDEO_MB}MB · arraste
            as miniaturas para reordenar. Sem mídia? Pode postar só texto.
          </p>
        </div>

        {/* CAPTION */}
        <div className="border-b border-border p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Descrição
            </span>
            <div className="flex items-center gap-2">
              {draftSavedAt && (
                <span className="text-[11px] text-muted-foreground">
                  Rascunho salvo {formatSavedAt(draftSavedAt)}
                </span>
              )}
              {caption.length > 0 && (
                <button
                  type="button"
                  onClick={discardDraft}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
                  aria-label="Descartar rascunho"
                >
                  <Trash2 className="h-3 w-3" />
                  Descartar
                </button>
              )}
              <span
                className={`text-[11px] tabular-nums ${
                  pct >= 95
                    ? "text-destructive"
                    : pct >= 80
                      ? "text-amber-500"
                      : "text-muted-foreground"
                }`}
              >
                {caption.length} / {MAX_CAPTION}
              </span>
            </div>
          </div>
          <Textarea
            ref={textareaRef}
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION))}
            maxLength={MAX_CAPTION}
            placeholder="Conte algo sobre o post… use #hashtags para aparecer nas buscas e @usuario para mencionar"
            className="min-h-[110px] resize-none rounded-lg border-border bg-secondary/40 text-[14px] leading-relaxed"
          />

          {captionParts.hasHighlight && (
            <div className="mt-2 rounded-lg border border-border/60 bg-secondary/30 px-3 py-2 text-[13px] leading-relaxed">
              {captionParts.nodes}
            </div>
          )}

          <div className="mt-2.5">
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              <Sparkles className="h-3 w-3" /> Sugeridas
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_TAGS.filter((t) => !tags.includes(t)).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => insertTag(t)}
                  className="inline-flex items-center gap-0.5 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground/80 transition hover:border-primary/40 hover:text-foreground"
                >
                  <Hash className="h-2.5 w-2.5" strokeWidth={2.4} />
                  {t}
                </button>
              ))}
            </div>
          </div>

          {tags.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-0.5 rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary"
                >
                  <Hash className="h-2.5 w-2.5" strokeWidth={2.4} />
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* NSFW */}
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md border border-border bg-secondary/60">
              <Eye className="h-3.5 w-3.5 text-foreground/80" strokeWidth={2} />
            </span>
            <div>
              <p className="text-[14px] font-medium tracking-tight">
                Marcar como sensível
              </p>
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
                Declaro que{" "}
                <strong className="font-semibold">
                  todos os retratados têm 18+
                </strong>{" "}
                e consentiram a publicação. Esta declaração é registrada com
                timestamp.
              </span>
            </span>
          </label>
        )}
      </section>


      {/* FLOATING ACTION BUTTON */}
      {canSubmit && (
        <button
          onClick={submit}
          disabled={submitting}
          title="Publicar"
          className="fixed right-4 top-4 z-[60] flex h-12 items-center gap-2 rounded-full px-5 text-[14px] font-medium text-primary-foreground shadow-lg transition hover:scale-105 active:scale-95 disabled:opacity-70"
          style={{ background: "var(--gradient-brasa-h)" }}
        >
          <Send className="h-4 w-4" strokeWidth={2.2} />
          <span>Publicar</span>
        </button>
      )}
    </div>
  );
}

function formatSavedAt(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.floor(diff / 1000);
  if (s < 5) return "agora";
  if (s < 60) return `há ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  try {
    return new Date(ts).toLocaleDateString("pt-BR");
  } catch {
    return "";
  }
}

function renderCaption(text: string): {
  hasHighlight: boolean;
  nodes: React.ReactNode;
} {
  if (!text.trim()) return { hasHighlight: false, nodes: null };
  const parts = text.split(/(\s+)/);
  let highlight = false;
  const nodes = parts.map((p, i) => {
    if (/^#[\wÀ-ÿ]+/.test(p)) {
      highlight = true;
      return (
        <span key={i} className="font-medium text-primary">
          {p}
        </span>
      );
    }
    if (/^@[\w.]+/.test(p)) {
      highlight = true;
      return (
        <span key={i} className="font-medium text-foreground">
          {p}
        </span>
      );
    }
    return <span key={i}>{p}</span>;
  });
  return { hasHighlight: highlight, nodes };
}
