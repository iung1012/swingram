import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile } from "@/hooks/use-profile";
import { PostCard } from "@/components/post-card";
import { SpiralLoaderBlock } from "@/components/spiral-loader";
import { fetchPostById } from "@/lib/post-fetcher";

export const Route = createFileRoute("/_authenticated/post/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Post — Brasa Swing" }] }),
  component: PostDetail,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-4 py-12 text-center text-sm text-muted-foreground">
      {error.message || "Erro ao carregar."}
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-4 py-12 text-center text-sm text-muted-foreground">
      Post não encontrado.
    </div>
  ),
});

function PostDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { data: me } = useMyProfile(user?.id);
  const { data: post, isLoading } = useQuery({
    queryKey: ["post", id, user?.id ?? null],
    queryFn: () => fetchPostById(id, user?.id ?? null),
  });

  return (
    <div className="mx-auto max-w-2xl px-3 pb-12 pt-3">
      <Link
        to="/home"
        className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={2.2} />
        Voltar
      </Link>

      {isLoading ? (
        <SpiralLoaderBlock />
      ) : !post ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Post não encontrado ou removido.
        </p>
      ) : (
        <PostCard
          post={post}
          currentUserId={user?.id ?? null}
          defaultBlur={me?.nsfw_blur_default ?? true}
        />
      )}
    </div>
  );
}
