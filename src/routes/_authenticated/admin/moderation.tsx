import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/integrations/api/client";
import { requireStaff } from "@/lib/admin-guard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SignedImage } from "@/components/signed-image";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/moderation")({
  ssr: false,
  beforeLoad: () => requireStaff(),
  component: ModerationQueue,
});

type QueueItem = {
  id: string;
  item_type: "post" | "comment" | "message" | "verification";
  item_id: string;
  priority: number;
  source?: string;
  reason?: string | null;
  created_at: string;
  context: any;
};

const TYPE_LABEL: Record<QueueItem["item_type"], string> = {
  post: "Post",
  comment: "Comentário",
  message: "Mensagem",
  verification: "Verificação",
};

function ModerationQueue() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["adm-modqueue"],
    queryFn: async (): Promise<QueueItem[]> => {
      const { data: rows } = await api
        .from("moderation_queue")
        .select("*")
        .eq("status", "pending")
        .order("priority")
        .order("created_at")
        .limit(100);
      const items = (rows ?? []) as QueueItem[];
      if (items.length === 0) return [];

      const idsOf = (t: QueueItem["item_type"]) =>
        items.filter((i) => i.item_type === t).map((i) => i.item_id);
      const fetchIn = (table: string, select: string, ids: string[]) =>
        ids.length
          ? api.from(table).select(select).in("id", ids)
          : Promise.resolve({ data: [] as any[] });

      const [posts, vers, comments, messages] = await Promise.all([
        fetchIn("posts", "*, post_media(url, order), profiles(handle, display_name)", idsOf("post")),
        fetchIn("verification_requests", "*, profiles(handle, display_name)", idsOf("verification")),
        fetchIn("comments", "*", idsOf("comment")),
        fetchIn("messages", "*", idsOf("message")),
      ]);
      const toMap = (arr: any[] | null | undefined) =>
        new Map((arr ?? []).map((x: any) => [String(x.id), x]));
      const byType: Record<QueueItem["item_type"], Map<string, any>> = {
        post: toMap(posts.data),
        verification: toMap(vers.data),
        comment: toMap(comments.data),
        message: toMap(messages.data),
      };
      return items.map((i) => ({ ...i, context: byType[i.item_type]?.get(String(i.item_id)) ?? null }));
    },
    refetchInterval: 20000,
  });

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Fila de moderação</h1>
      <p className="text-sm text-muted-foreground">
        Conteúdo aguardando revisão — novos posts/verificações e itens denunciados, em ordem de prioridade.
      </p>
      {(data ?? []).map((item) => (
        <QueueRow
          key={item.id}
          item={item}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ["adm-modqueue"] });
            qc.invalidateQueries({ queryKey: ["admin-stats"] });
          }}
        />
      ))}
      {data && data.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">Fila vazia 🎉</p>
      )}
    </div>
  );
}

function QueueRow({ item, onDone }: { item: QueueItem; onDone: () => void }) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function resolve(decision: "approved" | "rejected") {
    setBusy(true);
    try {
      const { data: { user } } = await api.auth.getUser();
      const now = new Date().toISOString();

      // Apply the effect to the underlying item FIRST. Some items (verification)
      // require a higher privilege than the queue itself; doing this first means
      // a permission failure aborts before the queue row is touched, so the
      // queue never ends up resolved while the item stayed pending.
      if (item.item_type === "post") {
        await api
          .from("posts")
          .update(
            decision === "approved"
              ? { moderation_status: "approved" }
              : { deleted_at: now, moderation_status: "rejected" },
          )
          .eq("id", item.item_id);
      } else if (item.item_type === "verification") {
        await api
          .from("verification_requests")
          .update({ status: decision, reviewed_by: user!.id, reviewed_at: now, notes: notes || null })
          .eq("id", item.item_id);
        if (decision === "approved" && item.context?.user_id) {
          await api.from("profiles").update({ verified: true, verified_at: now }).eq("user_id", item.context.user_id);
        }
      } else if (decision === "rejected" && (item.item_type === "comment" || item.item_type === "message")) {
        await api.from(item.item_type === "comment" ? "comments" : "messages").update({ status: "removed" }).eq("id", item.item_id);
      }

      // Close/annotate the queue row last (the sync triggers may already have
      // flipped its status; this records the reviewer and notes).
      await api
        .from("moderation_queue")
        .update({ status: decision, resolved_by: user!.id, resolved_at: now, notes: notes || null })
        .eq("id", item.id);

      // admin_id and ip are stamped server-side.
      await api.from("audit_logs").insert({ action: `mod_${item.item_type}_${decision}`, target_type: item.item_type, target_id: item.item_id });
      toast.success(decision === "approved" ? "Aprovado" : "Rejeitado");
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao processar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded bg-secondary px-2 py-0.5 text-[11px] font-medium">{TYPE_LABEL[item.item_type]}</span>
        {item.priority <= 2 && <span className="rounded bg-destructive px-1.5 text-[10px] text-destructive-foreground">URGENTE</span>}
        {item.source === "report" && <span className="rounded bg-accent px-1.5 text-[10px] text-accent-foreground">Denúncia</span>}
        <span className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString("pt-BR")}</span>
      </div>
      {item.reason && <p className="mb-2 text-sm"><span className="text-muted-foreground">Motivo:</span> {item.reason}</p>}

      <ItemContext item={item} />

      <Textarea className="mt-3" placeholder="Notas (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="mt-3 flex gap-2">
        <Button className="flex-1" disabled={busy} onClick={() => resolve("approved")}>Aprovar</Button>
        <Button variant="destructive" className="flex-1" disabled={busy} onClick={() => resolve("rejected")}>Rejeitar</Button>
      </div>
    </Card>
  );
}

function ItemContext({ item }: { item: QueueItem }) {
  const ctx = item.context;
  if (!ctx) {
    return <p className="text-sm text-muted-foreground">Item não encontrado (pode já ter sido removido).</p>;
  }

  if (item.item_type === "post") {
    const media = (ctx.post_media ?? []).slice().sort((a: any, b: any) => a.order - b.order);
    return (
      <div>
        <p className="mb-2 text-sm"><strong>{ctx.profiles?.display_name}</strong> <span className="text-muted-foreground">@{ctx.profiles?.handle}</span> {ctx.nsfw && <span className="ml-1 rounded bg-destructive px-1.5 text-[10px] text-destructive-foreground">NSFW</span>}</p>
        {media.length > 0 && (
          <div className="grid grid-cols-3 gap-1">
            {media.map((m: any) => <SignedImage key={m.url} bucket="posts" path={m.url} alt="" className="aspect-square w-full rounded object-cover" />)}
          </div>
        )}
        {ctx.caption && <p className="mt-2 text-sm">{ctx.caption}</p>}
      </div>
    );
  }

  if (item.item_type === "verification") {
    return (
      <div>
        <p className="mb-2 text-sm"><strong>{ctx.profiles?.display_name}</strong> <span className="text-muted-foreground">@{ctx.profiles?.handle}</span></p>
        <div className="grid grid-cols-3 gap-2">
          <div><p className="mb-1 text-xs text-muted-foreground">Frente</p><SignedImage bucket="verification" path={ctx.doc_front_path} alt="Frente" className="aspect-square w-full rounded object-cover" /></div>
          {ctx.doc_back_path && <div><p className="mb-1 text-xs text-muted-foreground">Verso</p><SignedImage bucket="verification" path={ctx.doc_back_path} alt="Verso" className="aspect-square w-full rounded object-cover" /></div>}
          <div><p className="mb-1 text-xs text-muted-foreground">Selfie</p><SignedImage bucket="verification" path={ctx.selfie_path} alt="Selfie" className="aspect-square w-full rounded object-cover" /></div>
        </div>
      </div>
    );
  }

  // comment / message
  return <p className="rounded bg-muted/50 p-2 text-sm">{ctx.body}</p>;
}
