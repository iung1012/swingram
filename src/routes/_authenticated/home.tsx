import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile } from "@/hooks/use-profile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PostCard, type PostCardData } from "@/components/post-card";
import { Flame, Search } from "lucide-react";
import { SpiralLoaderBlock } from "@/components/spiral-loader";
import { StoriesRail } from "@/components/stories-rail";

export const Route = createFileRoute("/_authenticated/home")({
  ssr: false,
  head: () => ({ meta: [{ title: "Início — Brasa Swing" }] }),
  component: Home,
});

type FeedMode = "all" | "recommended" | "following";

async function fetchFollowingIds(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from("interests_sent")
    .select("to_user")
    .eq("from_user", userId)
    .eq("status", "accepted");
  return (data ?? []).map((r: any) => r.to_user);
}

async function fetchFeed(currentUserId: string | null, mode: FeedMode, interests: string[]): Promise<PostCardData[]> {
  let followingIds: string[] = [];
  if (mode === "following") {
    if (!currentUserId) return [];
    followingIds = await fetchFollowingIds(currentUserId);
    if (followingIds.length === 0) return [];
  }

  let q = supabase
    .from("posts")
    .select(`
      id, user_id, caption, nsfw, created_at,
      profiles!inner(handle, display_name, avatar_url, verified, interests, shadow_banned, banned),
      post_media(url, order)
    `)
    .eq("moderation_status", "approved")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(40);

  if (mode === "following") q = q.in("user_id", followingIds);

  const { data } = await q;
  let rows = (data ?? []).filter((p: any) => !p.profiles.shadow_banned && !p.profiles.banned);

  if (mode === "recommended" && interests.length > 0) {
    rows = rows.filter((p: any) => (p.profiles.interests ?? []).some((i: string) => interests.includes(i)));
  }

  const ids = rows.map((r: any) => r.id);
  let likesByMe: Set<string> = new Set();
  let savedByMe: Set<string> = new Set();
  let likesMap: Record<string, number> = {};
  let commentsMap: Record<string, number> = {};
  if (ids.length > 0) {
    const [{ data: likes }, { data: comments }, savesRes] = await Promise.all([
      supabase.from("likes").select("post_id, user_id").in("post_id", ids),
      supabase.from("comments").select("post_id").in("post_id", ids),
      currentUserId
        ? supabase.from("saves").select("post_id").eq("user_id", currentUserId).in("post_id", ids)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    (likes ?? []).forEach((l: any) => {
      likesMap[l.post_id] = (likesMap[l.post_id] ?? 0) + 1;
      if (currentUserId && l.user_id === currentUserId) likesByMe.add(l.post_id);
    });
    (comments ?? []).forEach((c: any) => {
      commentsMap[c.post_id] = (commentsMap[c.post_id] ?? 0) + 1;
    });
    (savesRes?.data ?? []).forEach((s: any) => savedByMe.add(s.post_id));
  }


  return rows.map((r: any) => ({
    id: r.id,
    user_id: r.user_id,
    caption: r.caption,
    nsfw: r.nsfw,
    created_at: r.created_at,
    author: r.profiles,
    media: (r.post_media ?? []).sort((a: any, b: any) => a.order - b.order),
    likes_count: likesMap[r.id] ?? 0,
    liked_by_me: likesByMe.has(r.id),
    saved_by_me: savedByMe.has(r.id),
    comments_count: commentsMap[r.id] ?? 0,
  }));
}

function Home() {
  const { user } = useAuth();
  const { data: profile } = useMyProfile(user?.id);

  return (
    <div className="mx-auto max-w-2xl px-3 pt-3">
      <header className="mb-3 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Flame className="text-primary" /> Brasa Swing
        </h1>
        <Link
          to="/search"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Buscar"
        >
          <Search className="h-[18px] w-[18px]" strokeWidth={2.2} />
        </Link>
      </header>

      <StoriesRail />

      <Tabs defaultValue="all">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="recommended">Recomendados</TabsTrigger>
          <TabsTrigger value="following">Seguindo</TabsTrigger>
        </TabsList>

        <TabsContent value="recommended">
          <Feed mode="recommended" userId={user?.id ?? null} interests={profile?.interests ?? []} defaultBlur={profile?.nsfw_blur_default ?? true} />
        </TabsContent>
        <TabsContent value="following">
          <Feed mode="following" userId={user?.id ?? null} interests={profile?.interests ?? []} defaultBlur={profile?.nsfw_blur_default ?? true} />
        </TabsContent>
        <TabsContent value="all">
          <Feed mode="all" userId={user?.id ?? null} interests={profile?.interests ?? []} defaultBlur={profile?.nsfw_blur_default ?? true} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Feed({ mode, userId, interests, defaultBlur }: { mode: FeedMode; userId: string | null; interests: string[]; defaultBlur: boolean }) {
  const { data, isLoading } = useQuery({
    queryKey: ["feed", mode, userId, interests.join(",")],
    queryFn: () => fetchFeed(userId, mode, interests),
  });
  if (isLoading) return <SpiralLoaderBlock />;
  if (!data || data.length === 0) {
    const msg =
      mode === "following"
        ? "Você ainda não segue ninguém com posts. Explore Recomendados ou Todos."
        : "Sem posts por enquanto. Volte em breve ou crie o primeiro.";
    return <p className="py-12 text-center text-sm text-muted-foreground">{msg}</p>;
  }
  return (
    <div className="space-y-4 pt-3">
      {data.map((p) => <PostCard key={p.id} post={p} currentUserId={userId} defaultBlur={defaultBlur} />)}
    </div>
  );
}
