import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, ChevronLeft } from "lucide-react";
import { api } from "@/integrations/api/client";
import { useAuth } from "@/hooks/use-auth";
import { SignedMedia } from "@/components/signed-media";
import { SpiralLoaderBlock } from "@/components/spiral-loader";

export const Route = createFileRoute("/_authenticated/saved")({
  ssr: false,
  head: () => ({ meta: [{ title: "Salvos — Brasa Swing" }] }),
  component: SavedPosts,
});

function SavedPosts() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["saved-posts", user?.id ?? null],
    enabled: !!user,
    queryFn: async () => {
      const { data: rows } = await api
        .from("saves")
        .select("post_id, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      const ids = (rows ?? []).map((r) => r.post_id);
      if (!ids.length) return [];
      const { data: posts } = await api
        .from("posts")
        .select("id, caption, user_id, post_media(url, order, kind)")
        .in("id", ids)
        .is("deleted_at", null);
      const order = new Map(ids.map((id, i) => [id, i]));
      return (posts ?? []).sort(
        (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
      );
    },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 pb-12 pt-6">
      <Link
        to="/profile"
        className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={2.2} />
        Voltar
      </Link>

      <header className="mb-5 flex items-center gap-2">
        <Bookmark className="h-5 w-5 text-primary" strokeWidth={2.2} />
        <h1 className="text-[22px] font-semibold tracking-tight">Salvos</h1>
      </header>

      {isLoading ? (
        <SpiralLoaderBlock />
      ) : !data || data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 px-4 py-12 text-center text-[13px] text-muted-foreground">
          Você ainda não salvou nenhum post.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {data.map((p) => {
            const first = (p.post_media ?? [])
              .slice()
              .sort((a, b) => a.order - b.order)[0];
            const kind: "image" | "video" | "text" = first
              ? ((first.kind ?? "image") as "image" | "video")
              : "text";
            return (
              <Link
                key={p.id}
                to={"/post/$id" as never}
                params={{ id: p.id } as never}
                className="group relative overflow-hidden rounded-lg border border-border bg-card"
              >
                {kind === "text" ? (
                  <div className="flex aspect-square w-full items-center justify-center bg-secondary/40 p-2">
                    <p className="line-clamp-5 text-center text-[11px] leading-snug text-foreground/90">
                      {p.caption || "(sem texto)"}
                    </p>
                  </div>
                ) : (
                  <SignedMedia
                    bucket="posts"
                    path={first?.url}
                    kind={kind}
                    alt=""
                    controls={false}
                    muted
                    className="aspect-square w-full object-cover"
                  />
                )}
                {kind === "video" && (
                  <span className="pointer-events-none absolute right-1.5 top-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                    ▶
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

