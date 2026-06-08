import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { requireAdmin } from "@/lib/admin-guard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SignedImage } from "@/components/signed-image";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/admin/posts")({
  ssr: false,
  beforeLoad: () => requireAdmin(),
  component: PostsAdmin,
});

function PostsAdmin() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["adm-posts-pending"],
    queryFn: async () => {
      const { data } = await supabase
        .from("posts")
        .select("*, post_media(url, order), profiles(handle, display_name)")
        .eq("moderation_status", "pending")
        .is("deleted_at", null)
        .order("created_at")
        .limit(50);
      return data ?? [];
    },
  });

  async function decide(post: any, status: "approved" | "rejected") {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("posts").update({ moderation_status: status }).eq("id", post.id);
    if (status === "rejected") {
      await supabase.from("posts").update({ deleted_at: new Date().toISOString(), moderation_status: "rejected" }).eq("id", post.id);
    }
    await supabase.from("audit_logs").insert({ admin_id: user!.id, action: `post_${status}`, target_type: "post", target_id: post.id });
    toast.success(`Post ${status === "approved" ? "aprovado" : "rejeitado"}`);
    qc.invalidateQueries({ queryKey: ["adm-posts-pending"] });
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Posts aguardando aprovação</h1>
      {(data ?? []).map((p: any) => {
        const media = (p.post_media ?? []).sort((a: any, b: any) => a.order - b.order);
        return (
          <Card key={p.id} className="p-4">
            <p className="mb-2 text-sm"><strong>{p.profiles?.display_name}</strong> <span className="text-muted-foreground">@{p.profiles?.handle}</span> {p.nsfw && <span className="ml-1 rounded bg-destructive px-1.5 text-[10px] text-destructive-foreground">NSFW</span>}</p>
            <div className="grid grid-cols-3 gap-1">
              {media.map((m: any) => <SignedImage key={m.url} bucket="posts" path={m.url} alt="" className="aspect-square w-full rounded object-cover" />)}
            </div>
            {p.caption && <p className="mt-2 text-sm">{p.caption}</p>}
            <div className="mt-3 flex gap-2">
              <Button className="flex-1" onClick={() => decide(p, "approved")}>Aprovar</Button>
              <Button variant="destructive" className="flex-1" onClick={() => decide(p, "rejected")}>Rejeitar</Button>
            </div>
          </Card>
        );
      })}
      {data && data.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Fila vazia 🎉</p>}
    </div>
  );
}
