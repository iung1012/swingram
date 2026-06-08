import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile } from "@/hooks/use-profile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PostCard, type PostCardData } from "@/components/post-card";
import { Flame, Search, Bell, Loader2 } from "lucide-react";
import { SpiralLoaderBlock } from "@/components/spiral-loader";
import { StoriesRail } from "@/components/stories-rail";
import { useRealtimeNotifications } from "@/hooks/use-realtime";

export const Route = createFileRoute("/_authenticated/home")({
  ssr: false,
  head: () => ({ meta: [{ title: "Início — Brasa Swing" }] }),
  component: Home,
});

type FeedMode = "all" | "recommended" | "following";

const PAGE_SIZE = 12;

async function fetchFollowingIds(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from("interests_sent")
    .select("to_user")
    .eq("from_user", userId)
    .eq("status", "accepted");
  return (data ?? []).map((r) => r.to_user);
}

async function fetchFeedPage(
  currentUserId: string | null,
  mode: FeedMode,
  interests: string[],
  cursor: string | null,
): Promise<{ items: PostCardData[]; nextCursor: string | null }> {
  let followingIds: string[] = [];
  if (mode === "following") {
    if (!currentUserId) return { items: [], nextCursor: null };
    followingIds = await fetchFollowingIds(currentUserId);
    if (followingIds.length === 0) return { items: [], nextCursor: null };
  }

  let q = supabase
    .from("posts")
    .select(`id, user_id, caption, nsfw, created_at, post_media(url, order, kind)`)
    .eq("moderation_status", "approved")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (mode === "following") q = q.in("user_id", followingIds);
  if (cursor) q = q.lt("created_at", cursor);

  const { data, error } = await q;
  if (error) {
    console.error("[feed] posts query failed", error);
    return { items: [], nextCursor: null };
  }
  const allRows = data ?? [];
  const hasMore = allRows.length > PAGE_SIZE;
  const postRows = hasMore ? allRows.slice(0, PAGE_SIZE) : allRows;
  if (postRows.length === 0) return { items: [], nextCursor: null };

  const authorIds = Array.from(new Set(postRows.map((p) => p.user_id)));
  const { data: authorsData } = await supabase
    .from("profiles")
    .select("user_id, handle, display_name, avatar_url, verified, interests, shadow_banned, banned")
    .in("user_id", authorIds);
  type AuthorRow = NonNullable<typeof authorsData>[number];
  const authors = new Map<string, AuthorRow>();
  (authorsData ?? []).forEach((a) => authors.set(a.user_id, a));

  let rows = postRows
    .map((p) => ({ ...p, profiles: authors.get(p.user_id) }))
    .filter((p) => p.profiles && !p.profiles.shadow_banned && !p.profiles.banned);

  if (mode === "recommended" && interests.length > 0) {
    rows = rows.filter((p) =>
      (p.profiles!.interests ?? []).some((i: string) => interests.includes(i)),
    );
  }

  const ids = rows.map((r) => r.id);
  const likesByMe = new Set<string>();
  const savedByMe = new Set<string>();
  const likesMap: Record<string, number> = {};
  const commentsMap: Record<string, number> = {};
  if (ids.length > 0) {
    const [{ data: likes }, { data: comments }, savesRes] = await Promise.all([
      supabase.from("likes").select("post_id, user_id").in("post_id", ids),
      supabase.from("comments").select("post_id").in("post_id", ids),
      currentUserId
        ? supabase.from("saves").select("post_id").eq("user_id", currentUserId).in("post_id", ids)
        : Promise.resolve({ data: [] as Array<{ post_id: string }> }),
    ]);
    (likes ?? []).forEach((l) => {
      likesMap[l.post_id] = (likesMap[l.post_id] ?? 0) + 1;
      if (currentUserId && l.user_id === currentUserId) likesByMe.add(l.post_id);
    });
    (comments ?? []).forEach((c) => {
      commentsMap[c.post_id] = (commentsMap[c.post_id] ?? 0) + 1;
    });
    (savesRes?.data ?? []).forEach((s) => savedByMe.add(s.post_id));
  }

  const mediaPaths: string[] = [];
  rows.forEach((r) => (r.post_media ?? []).forEach((m) => m?.url && mediaPaths.push(m.url)));
  const signedMedia = new Map<string, string>();
  if (mediaPaths.length > 0) {
    const { data: signed } = await supabase.storage.from("posts").createSignedUrls(mediaPaths, 3600);
    (signed ?? []).forEach((s) => {
      if (s.path && s.signedUrl) signedMedia.set(s.path, s.signedUrl);
    });
  }

  const items: PostCardData[] = rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    caption: r.caption,
    nsfw: r.nsfw,
    created_at: r.created_at,
    author: {
      handle: r.profiles!.handle,
      display_name: r.profiles!.display_name,
      avatar_url: r.profiles!.avatar_url,
      verified: r.profiles!.verified,
    },
    media: (r.post_media ?? [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((m) => ({
        url: signedMedia.get(m.url) ?? m.url,
        order: m.order,
        kind: (m.kind ?? "image") as "image" | "video",
      })),
    likes_count: likesMap[r.id] ?? 0,
    liked_by_me: likesByMe.has(r.id),
    saved_by_me: savedByMe.has(r.id),
    comments_count: commentsMap[r.id] ?? 0,
  }));

  return {
    items,
    nextCursor: hasMore ? postRows[postRows.length - 1].created_at : null,
  };
}

function Home() {
  const { user } = useAuth();
  const { data: profile } = useMyProfile(user?.id);
  useRealtimeNotifications(user?.id);

  const { data: unread } = useQuery({
    queryKey: ["notifications-unread", user?.id ?? null],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .is("read_at", null);
      return count ?? 0;
    },
  });

  return (
    <div className="mx-auto max-w-2xl px-3 pt-3">
      <header className="mb-3 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Flame className="text-primary" /> Brasa Swing
        </h1>
        <div className="flex items-center gap-2">
          <Link
            to="/notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Notificações"
          >
            <Bell className="h-[18px] w-[18px]" strokeWidth={2.2} />
            {unread && unread > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
          </Link>
          <Link
            to="/search"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Buscar"
          >
            <Search className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </Link>
        </div>
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

function Feed({
  mode,
  userId,
  interests,
  defaultBlur,
}: {
  mode: FeedMode;
  userId: string | null;
  interests: string[];
  defaultBlur: boolean;
}) {
  const interestsKey = interests.join(",");
  const {
    data,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["feed", mode, userId, interestsKey],
    initialPageParam: null as string | null,
    getNextPageParam: (last: { items: PostCardData[]; nextCursor: string | null }) => last.nextCursor,
    queryFn: ({ pageParam }) => fetchFeedPage(userId, mode, interests, pageParam),
  });

  const items = useMemo<PostCardData[]>(
    () => (data?.pages ?? []).flatMap((p: { items: PostCardData[]; nextCursor: string | null }) => p.items),
    [data],
  );

  // Infinite scroll sentinel.
  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "400px" },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, items.length]);

  if (isLoading) return <SpiralLoaderBlock />;
  if (items.length === 0) {
    const msg =
      mode === "following"
        ? "Você ainda não segue ninguém com posts. Explore Recomendados ou Todos."
        : "Sem posts por enquanto. Volte em breve ou crie o primeiro.";
    return <p className="py-12 text-center text-sm text-muted-foreground">{msg}</p>;
  }

  return (
    <div className="space-y-4 pt-3">
      {items.map((p) => (
        <PostCard
          key={p.id}
          post={p}
          currentUserId={userId}
          defaultBlur={defaultBlur}
          commentsAsDialog
        />
      ))}
      <div ref={sentinel} className="h-1" />
      {isFetchingNextPage && (
        <div className="flex items-center justify-center gap-2 py-4 text-[12px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Carregando mais…
        </div>
      )}
      {!hasNextPage && items.length > 0 && (
        <p className="py-6 text-center text-[11px] text-muted-foreground">
          Você chegou ao fim.
        </p>
      )}
    </div>
  );
}
