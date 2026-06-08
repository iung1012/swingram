import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile, useIsStaff } from "@/hooks/use-profile";
import { SignedImage } from "@/components/signed-image";
import { SignedMedia } from "@/components/signed-media";
import { VerifiedAvatar } from "@/components/verified-avatar";
import { VerifiedBadge } from "@/components/verified-badge";
import { PostCard, type PostCardData } from "@/components/post-card";
import { ZoomPostContent } from "@/components/zoom-post-content";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Settings,
  BadgeCheck,
  Shield,
  Heart,
  MapPin,
  ChevronRight,
  Sparkles,
  Camera,
  ImagePlus,
  Pencil,
  Check,
  X,
  Bookmark,
} from "lucide-react";




export const Route = createFileRoute("/_authenticated/profile")({
  ssr: false,
  head: () => ({ meta: [{ title: "Meu perfil — Brasa Swing" }] }),
  component: MyProfile,
});

function MyProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: profile } = useMyProfile(user?.id);
  const { data: roles } = useIsStaff(user?.id);
  const avatarInput = useRef<HTMLInputElement | null>(null);
  const bannerInput = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState<"avatar" | "banner" | null>(null);
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [savingBio, setSavingBio] = useState(false);
  const [tab, setTab] = useState<"posts" | "photos">("posts");
  const [zoomPost, setZoomPost] = useState<{ id: string; url: string | null; kind: "image" | "video" | "text"; caption: string } | null>(null);


  async function saveBio() {
    if (!user) return;
    setSavingBio(true);
    const { error } = await supabase
      .from("profiles")
      .update({ bio: bioDraft.trim() } as never)
      .eq("user_id", user.id);
    setSavingBio(false);
    if (error) {
      toast.error("Falha ao salvar descrição");
      return;
    }
    toast.success("Descrição atualizada");
    setEditingBio(false);
    qc.invalidateQueries({ queryKey: ["profile", user.id] });
    qc.invalidateQueries({ queryKey: ["my-profile", user.id] });
  }


  const { data: posts } = useQuery<
    Array<PostCardData & { moderation_status: string }>
  >({
    queryKey: ["my-posts", user?.id],
    enabled: !!user && !!profile,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("posts")
        .select(
          `id, user_id, caption, nsfw, created_at, moderation_status, post_media(url, order, kind)`,
        )
        .eq("user_id", user!.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      const postRows = rows ?? [];
      if (postRows.length === 0 || !profile) return [];

      const ids = postRows.map((r: any) => r.id);
      const [{ data: likes }, { data: comments }, savesRes] = await Promise.all([
        supabase.from("likes").select("post_id, user_id").in("post_id", ids),
        supabase.from("comments").select("post_id").in("post_id", ids),
        supabase.from("saves").select("post_id").eq("user_id", user!.id).in("post_id", ids),
      ]);

      const likesMap: Record<string, number> = {};
      const likesByMe = new Set<string>();
      (likes ?? []).forEach((l: any) => {
        likesMap[l.post_id] = (likesMap[l.post_id] ?? 0) + 1;
        if (l.user_id === user!.id) likesByMe.add(l.post_id);
      });
      const commentsMap: Record<string, number> = {};
      (comments ?? []).forEach((c: any) => {
        commentsMap[c.post_id] = (commentsMap[c.post_id] ?? 0) + 1;
      });
      const savedByMe = new Set<string>();
      (savesRes?.data ?? []).forEach((s: any) => savedByMe.add(s.post_id));

      const author = {
        handle: profile.handle,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        verified: profile.verified,
      };

      return postRows.map((r: any) => ({
        id: r.id,
        user_id: r.user_id,
        caption: r.caption,
        nsfw: r.nsfw,
        created_at: r.created_at,
        moderation_status: r.moderation_status,
        author,
        media: (r.post_media ?? [])
          .sort((a: any, b: any) => a.order - b.order)
          .map((m: any) => ({ url: m.url, order: m.order, kind: m.kind })),
        likes_count: likesMap[r.id] ?? 0,
        liked_by_me: likesByMe.has(r.id),
        saved_by_me: savedByMe.has(r.id),
        comments_count: commentsMap[r.id] ?? 0,
      }));
    },
  });


  async function uploadImage(
    kind: "avatar" | "banner",
    file: File,
  ) {
    if (!user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 8MB).");
      return;
    }
    setBusy(kind);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${kind}-${Date.now()}.${ext}`;
      const up = await supabase.storage.from("avatars").upload(path, file, {
        upsert: false,
        contentType: file.type,
      });
      if (up.error) throw up.error;
      const field = kind === "avatar" ? "avatar_url" : "banner_url";
      const { error } = await supabase
        .from("profiles")
        .update({ [field]: path } as never)
        .eq("user_id", user.id);
      if (error) throw error;
      toast.success(kind === "avatar" ? "Foto atualizada" : "Capa atualizada");
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
      qc.invalidateQueries({ queryKey: ["my-profile", user.id] });
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao enviar");
    } finally {
      setBusy(null);
    }
  }

  if (!profile)
    return (
      <div className="mx-auto max-w-2xl px-4 pt-10">
        <div className="h-44 animate-pulse rounded-2xl border border-border bg-card/60" />
      </div>
    );

  const approvedCount = (posts ?? []).filter((p: any) => p.moderation_status === "approved").length;
  const totalCount = (posts ?? []).length;
  const banner = (profile as any).banner_url as string | null | undefined;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-12 pt-6">
      <input
        ref={avatarInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) uploadImage("avatar", f);
        }}
      />
      <input
        ref={bannerInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) uploadImage("banner", f);
        }}
      />

      {/* Hero card */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card">
        {/* Banner / cover */}
        <div className="relative h-32 w-full overflow-hidden bg-secondary/40">
          {banner ? (
            <SignedImage
              bucket="avatars"
              path={banner}
              alt="Capa"
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              aria-hidden
              className="h-full w-full"
              style={{
                background:
                  "radial-gradient(120% 80% at 50% 0%, var(--fire) 0%, transparent 60%), oklch(0.18 0.02 30)",
              }}
            />
          )}
          <button
            type="button"
            onClick={() => bannerInput.current?.click()}
            disabled={busy === "banner"}
            className="absolute right-3 top-3 inline-flex h-8 items-center gap-1.5 rounded-full border border-border/60 bg-background/85 px-3 text-[12px] font-medium text-foreground backdrop-blur transition hover:bg-background disabled:opacity-50"
          >
            <ImagePlus className="h-3.5 w-3.5" strokeWidth={2.2} />
            {busy === "banner" ? "Enviando…" : banner ? "Trocar capa" : "Adicionar capa"}
          </button>
        </div>

        <div className="relative p-5 pt-0">
          <div className="-mt-10 flex items-end gap-4">
            <div className="relative">
              <VerifiedAvatar
                bucket="avatars"
                path={profile.avatar_url}
                alt={profile.display_name}
                verified={profile.verified}
                className="h-20 w-20 ring-4 ring-card"
              />
              <button
                type="button"
                onClick={() => avatarInput.current?.click()}
                disabled={busy === "avatar"}
                aria-label="Trocar foto de perfil"
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm transition hover:bg-secondary disabled:opacity-50"
              >
                <Camera className="h-3.5 w-3.5" strokeWidth={2.2} />
              </button>
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex items-center gap-1.5">
                <h1 className="truncate text-[19px] font-semibold tracking-tight">
                  {profile.display_name}
                </h1>
                {profile.verified && <VerifiedBadge />}
              </div>
              <p className="mt-0.5 text-[13px] text-muted-foreground">@{profile.handle}</p>
              {profile.city && (
                <p className="mt-1.5 inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                  <MapPin className="h-3 w-3" strokeWidth={2} />
                  {profile.city}
                </p>
              )}
            </div>
          </div>

          {editingBio ? (
            <div className="mt-4 space-y-2">
              <textarea
                value={bioDraft}
                onChange={(e) => setBioDraft(e.target.value)}
                maxLength={500}
                rows={4}
                placeholder="Conte um pouco sobre você..."
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-[14px] leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{bioDraft.length}/500</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingBio(false)}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-secondary/60 px-3 text-[12px] font-medium hover:bg-secondary"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2.2} />
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={saveBio}
                    disabled={savingBio}
                    className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={2.2} />
                    Salvar
                  </button>
                </div>
              </div>
            </div>
          ) : profile.bio ? (
            <div className="group mt-4 flex items-start gap-2">
              <p className="flex-1 whitespace-pre-wrap text-[14px] leading-relaxed text-foreground/90">
                {profile.bio}
              </p>
              <button
                type="button"
                onClick={() => {
                  setBioDraft(profile.bio ?? "");
                  setEditingBio(true);
                }}
                aria-label="Editar descrição"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={2.2} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setBioDraft("");
                setEditingBio(true);
              }}
              className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-border bg-card/40 px-3 text-[13px] font-medium text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={2.2} />
              Adicionar descrição
            </button>
          )}


          {(profile.interests ?? []).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {profile.interests.map((i: string) => (
                <span
                  key={i}
                  className="rounded-md border border-border bg-secondary/60 px-2 py-0.5 text-[11px] font-medium text-foreground/85"
                >
                  {i}
                </span>
              ))}
            </div>
          )}

          <div className="mt-5 grid grid-cols-3 divide-x divide-border overflow-hidden rounded-xl border border-border bg-secondary/40">
            <Stat label="Posts" value={totalCount} />
            <Stat label="Aprovados" value={approvedCount} />
            <Stat label="Status" value={profile.verified ? "Verificado" : "Padrão"} small />
          </div>

          {!profile.verified && (
            <Link
              to="/verify"
              className="mt-4 flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-primary text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <BadgeCheck className="h-4 w-4" strokeWidth={2.2} />
              Solicitar verificação
            </Link>
          )}
        </div>
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl border border-border bg-card">
        <Row to="/saved" icon={Bookmark} label="Posts salvos" />
        <Divider />
        <Row to="/settings" icon={Settings} label="Configurações" />
        <Divider />
        <Row to="/couple" icon={Heart} label="Vínculo de casal" />
        <Divider />
        <Row to="/interests" icon={Sparkles} label="Interesses" />
        {roles?.admin && (
          <>
            <Divider />
            <Row to="/admin" icon={Shield} label="Painel admin" accent />
          </>
        )}
      </section>

      <section className="mt-7">
        <div className="mb-3 flex items-center gap-1 rounded-xl border border-border bg-card/40 p-1">
          <button
            type="button"
            onClick={() => setTab("posts")}
            className={`flex-1 rounded-lg px-3 py-2 text-[12px] font-semibold tracking-tight transition-colors ${
              tab === "posts"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Postagens
            <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
              {(posts ?? []).length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab("photos")}
            className={`flex-1 rounded-lg px-3 py-2 text-[12px] font-semibold tracking-tight transition-colors ${
              tab === "photos"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Imagens
            <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
              {(posts ?? []).filter((p) => p.media.length > 0).length}
            </span>
          </button>
        </div>

        {tab === "posts" ? (
          !posts || posts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/40 px-4 py-10 text-center">
              <p className="text-[13px] text-muted-foreground">Nenhum post ainda.</p>
              <Link
                to="/create"
                className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-3 text-[13px] font-medium hover:bg-secondary"
              >
                Criar primeiro post
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((p) => (
                <div key={p.id} className="relative">
                  {p.moderation_status !== "approved" && (
                    <span className="absolute left-3 top-3 z-10 rounded-md border border-border bg-background/85 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground/90 backdrop-blur">
                      {p.moderation_status === "pending" ? "Em análise" : "Rejeitado"}
                    </span>
                  )}
                  <PostCard
                    post={p}
                    currentUserId={user?.id ?? null}
                    defaultBlur={(profile as any)?.nsfw_blur_default ?? true}
                    commentsAsDialog
                  />
                </div>
              ))}
            </div>
          )
        ) : !posts || posts.filter((p) => p.media.length > 0).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 px-4 py-10 text-center">
            <p className="text-[13px] text-muted-foreground">Nenhuma foto ou vídeo publicado.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {posts
              .filter((p) => p.media.length > 0)
              .map((p) => {
                const first = p.media[0];
                const kind = (first?.kind ?? "image") as "image" | "video";
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() =>
                      setZoomPost({
                        id: p.id,
                        url: first?.url ?? null,
                        kind: kind as "image" | "video" | "text",
                        caption: p.caption ?? "",
                      })
                    }
                    className="group relative overflow-hidden rounded-lg border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <SignedMedia
                      bucket="posts"
                      path={first?.url}
                      kind={kind}
                      alt=""
                      controls={false}
                      muted
                      className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
                    />
                    {kind === "video" && (
                      <span className="pointer-events-none absolute right-1.5 top-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                        ▶ vídeo
                      </span>
                    )}
                    {p.moderation_status !== "approved" && (
                      <span className="absolute left-1.5 top-1.5 rounded-md border border-border bg-background/85 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground/90 backdrop-blur">
                        {p.moderation_status === "pending" ? "Análise" : "Rejeitado"}
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, small }: { label: string; value: number | string; small?: boolean }) {
  return (
    <div className="px-3 py-3 text-center">
      <p
        className={
          small
            ? "truncate text-[13px] font-semibold tracking-tight text-foreground"
            : "text-[18px] font-semibold tracking-tight text-foreground"
        }
      >
        {value}
      </p>
      <p className="mt-0.5 text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function Row({
  to,
  icon: Icon,
  label,
  accent,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  accent?: boolean;
}) {
  return (
    <Link
      to={to as never}
      className="flex h-12 items-center gap-3 px-4 transition-colors hover:bg-secondary/50"
    >
      <span
        className={
          "flex h-7 w-7 items-center justify-center rounded-md border border-border " +
          (accent ? "" : "bg-secondary/60")
        }
        style={accent ? { background: "var(--gradient-brasa-h)" } : undefined}
      >
        <Icon
          className={"h-3.5 w-3.5 " + (accent ? "text-background" : "text-foreground/80")}
          strokeWidth={2.2}
        />
      </span>
      <span className="flex-1 text-[14px] font-medium tracking-tight text-foreground">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
    </Link>
  );
}

function Divider() {
  return <div className="mx-4 h-px bg-border" />;
}
