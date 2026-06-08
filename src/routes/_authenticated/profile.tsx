import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile, useIsStaff } from "@/hooks/use-profile";
import { SignedImage } from "@/components/signed-image";
import { VerifiedAvatar } from "@/components/verified-avatar";
import { VerifiedBadge } from "@/components/verified-badge";
import {
  Settings,
  BadgeCheck,
  Shield,
  LogOut,
  Heart,
  MapPin,
  ChevronRight,
  Grid3x3,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  ssr: false,
  head: () => ({ meta: [{ title: "Meu perfil — Brasa Swing" }] }),
  component: MyProfile,
});

function MyProfile() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { data: profile } = useMyProfile(user?.id);
  const { data: roles } = useIsStaff(user?.id);

  const { data: posts } = useQuery({
    queryKey: ["my-posts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("posts")
        .select("id, post_media(url, order), moderation_status")
        .eq("user_id", user!.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function logout() {
    await supabase.auth.signOut();
    nav({ to: "/auth" });
  }

  if (!profile)
    return (
      <div className="mx-auto max-w-2xl px-4 pt-10">
        <div className="h-44 animate-pulse rounded-2xl border border-border bg-card/60" />
      </div>
    );

  const approvedCount = (posts ?? []).filter((p: any) => p.moderation_status === "approved").length;
  const totalCount = (posts ?? []).length;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-12 pt-6">
      {/* Hero card — surface ladder, hairline border, no shadow */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card">
        {/* faint brasa wash at top — single decorative moment */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-[0.18]"
          style={{
            background:
              "radial-gradient(120% 80% at 50% 0%, var(--fire) 0%, transparent 60%)",
          }}
        />
        <div className="relative p-5">
          <div className="flex items-start gap-4">
          <VerifiedAvatar
            bucket="avatars"
            path={profile.avatar_url}
            alt={profile.display_name}
            verified={profile.verified}
            className="h-20 w-20"
          />
            <div className="min-w-0 flex-1 pt-1">
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

          {profile.bio && (
            <p className="mt-4 text-[14px] leading-relaxed text-foreground/90">{profile.bio}</p>
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

          {/* stat ladder — surface notch above the card */}
          <div className="mt-5 grid grid-cols-3 divide-x divide-border overflow-hidden rounded-xl border border-border bg-secondary/40">
            <Stat label="Posts" value={totalCount} />
            <Stat label="Aprovados" value={approvedCount} />
            <Stat label="Status" value={profile.verified ? "Verificado" : "Padrão"} small />
          </div>

          {/* primary action: single solid pill */}
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

      {/* Menu list — settings-style rows */}
      <section className="mt-5 overflow-hidden rounded-2xl border border-border bg-card">
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

      <button
        onClick={logout}
        className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card text-[14px] font-medium text-destructive transition-colors hover:bg-secondary/60"
      >
        <LogOut className="h-4 w-4" strokeWidth={2} />
        Sair da conta
      </button>

      {/* Posts grid */}
      <section className="mt-7">
        <div className="mb-2.5 flex items-center justify-between px-1">
          <h2 className="inline-flex items-center gap-1.5 text-[13px] font-semibold tracking-tight text-foreground">
            <Grid3x3 className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} />
            Seus posts
          </h2>
          <span className="text-[11px] text-muted-foreground">{totalCount}</span>
        </div>
        {!posts || posts.length === 0 ? (
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
          <div className="grid grid-cols-3 gap-1.5">
            {posts.map((p: any) => {
              const first = (p.post_media ?? []).sort((a: any, b: any) => a.order - b.order)[0];
              return (
                <div
                  key={p.id}
                  className="group relative overflow-hidden rounded-lg border border-border"
                >
                  <SignedImage
                    bucket="posts"
                    path={first?.url}
                    alt=""
                    className="aspect-square w-full object-cover"
                  />
                  {p.moderation_status !== "approved" && (
                    <span className="absolute left-1.5 top-1.5 rounded-md border border-border bg-background/85 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground/90 backdrop-blur">
                      {p.moderation_status === "pending" ? "Análise" : "Rejeitado"}
                    </span>
                  )}
                </div>
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
