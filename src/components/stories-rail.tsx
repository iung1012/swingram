"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile } from "@/hooks/use-profile";
import { toast } from "sonner";
import { StoryViewer, StoryRingButton, type Story } from "@/components/story-viewer";

type Row = {
  id: string;
  user_id: string;
  media_url: string;
  created_at: string;
  expires_at: string;
};

type Group = {
  user_id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  rows: Row[];
  resolved: Story[];
};

async function signMany(paths: string[]) {
  // Files stored as "userId/filename.ext" in `stories` bucket
  const { data } = await supabase.storage.from("stories").createSignedUrls(paths, 3600);
  const map = new Map<string, string>();
  (data ?? []).forEach((d: any) => {
    if (d?.path && d?.signedUrl) map.set(d.path, d.signedUrl);
  });
  return map;
}

export function StoriesRail() {
  const { user } = useAuth();
  const { data: me } = useMyProfile(user?.id);
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [openGroupIdx, setOpenGroupIdx] = useState<number | null>(null);
  const [viewed, setViewed] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      return new Set(JSON.parse(localStorage.getItem("brasa.viewedStories") ?? "[]"));
    } catch {
      return new Set();
    }
  });

  const { data: groups } = useQuery({
    queryKey: ["stories-rail", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("stories")
        .select("id, user_id, media_url, created_at, expires_at")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: true });
      const list = (rows ?? []) as Row[];
      const userIds = Array.from(new Set(list.map((r) => r.user_id)));
      if (userIds.length === 0) return [] as Group[];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, handle, display_name, avatar_url")
        .in("user_id", userIds);
      const pmap = new Map<string, any>((profs ?? []).map((p: any) => [p.user_id, p]));
      const paths = list.map((r) => r.media_url);
      const signed = await signMany(paths);
      const byUser = new Map<string, Row[]>();
      list.forEach((r) => {
        const arr = byUser.get(r.user_id) ?? [];
        arr.push(r);
        byUser.set(r.user_id, arr);
      });
      const out: Group[] = [];
      byUser.forEach((rows, uid) => {
        const p = pmap.get(uid);
        if (!p) return;
        out.push({
          user_id: uid,
          handle: p.handle,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          rows,
          resolved: rows.map((r) => {
            const isVideo = /\.(mp4|webm|mov)$/i.test(r.media_url);
            return {
              id: r.id,
              type: isVideo ? "video" : "image",
              src: signed.get(r.media_url) ?? "",
            } as Story;
          }),
        });
      });
      // Put self first
      out.sort((a, b) => (a.user_id === user!.id ? -1 : b.user_id === user!.id ? 1 : 0));
      return out;
    },
  });

  const myGroup = useMemo(() => groups?.find((g) => g.user_id === user?.id), [groups, user?.id]);
  const otherGroups = useMemo(() => groups?.filter((g) => g.user_id !== user?.id) ?? [], [groups, user?.id]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx 25MB).");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const up = await supabase.storage.from("stories").upload(path, file, { upsert: false });
      if (up.error) throw up.error;
      const ins = await supabase.from("stories").insert({ user_id: user.id, media_url: path } as never);
      if (ins.error) throw ins.error;
      toast.success("Story publicado");
      qc.invalidateQueries({ queryKey: ["stories-rail"] });
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao publicar");
    } finally {
      setUploading(false);
    }
  }

  function open(idx: number) {
    setOpenGroupIdx(idx);
  }

  const markViewed = useCallback((id: string) => {
    setViewed((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem("brasa.viewedStories", JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }, []);

  const deleteStory = useCallback(
    async (id: string) => {
      if (!user) return;
      const grp = groups?.find((g) => g.user_id === user.id);
      const row = grp?.rows.find((r) => r.id === id);
      try {
        if (row?.media_url) {
          await supabase.storage.from("stories").remove([row.media_url]);
        }
        const { error } = await supabase.from("stories").delete().eq("id", id);
        if (error) throw error;
        toast.success("Story excluído");
        // If this was the last one, close the viewer
        if ((grp?.rows.length ?? 0) <= 1) setOpenGroupIdx(null);
        qc.invalidateQueries({ queryKey: ["stories-rail"] });
      } catch (err: any) {
        toast.error(err.message ?? "Falha ao excluir");
      }
    },
    [user, groups, qc]
  );

  const orderedGroups: Group[] = useMemo(() => {
    const list: Group[] = [];
    if (myGroup) list.push(myGroup);
    list.push(...otherGroups);
    return list;
  }, [myGroup, otherGroups]);

  const activeGroup = openGroupIdx !== null ? orderedGroups[openGroupIdx] : null;

  return (
    <div className="-mx-3 mb-3">
      <div className="flex gap-3 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Add / Your story */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="group flex w-16 shrink-0 flex-col items-center gap-1.5 outline-none"
        >
          <span className="relative block h-16 w-16">
            <span className="absolute inset-0 rounded-full border border-dashed border-border" />
            <span className="absolute inset-[6px] flex items-center justify-center rounded-full bg-secondary ring-2 ring-background">
              {me?.avatar_url ? (
                <img src={me.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
              ) : (
                <span className="text-[10px] uppercase text-muted-foreground">eu</span>
              )}
            </span>
            <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background">
              <Plus className="h-3 w-3" strokeWidth={3} />
            </span>
          </span>
          <span className="text-[11px] text-muted-foreground group-hover:text-foreground">
            {uploading ? "Enviando…" : "Seu story"}
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={onPick}
        />

        {orderedGroups.map((g, i) => {
          const allViewed = g.rows.every((r) => viewed.has(r.id));
          return (
            <StoryRingButton
              key={g.user_id}
              segments={g.rows.length}
              viewed={allViewed}
              avatar={g.avatar_url}
              label={g.user_id === user?.id ? "Você" : g.display_name || `@${g.handle}`}
              onClick={() => open(i)}
            />
          );
        })}
      </div>

      {activeGroup && (
        <StoryViewer
          key={activeGroup.user_id}
          stories={activeGroup.resolved}
          username={activeGroup.user_id === user?.id ? "Você" : activeGroup.display_name}
          avatar={activeGroup.avatar_url}
          timestamp={activeGroup.rows[0]?.created_at}
          onClose={() => setOpenGroupIdx(null)}
          onStoryView={markViewed}
          canDelete={activeGroup.user_id === user?.id}
          onDeleteStory={deleteStory}
        />
      )}
    </div>
  );
}
