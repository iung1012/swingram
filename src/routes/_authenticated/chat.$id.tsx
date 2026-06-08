import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile } from "@/hooks/use-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SignedImage } from "@/components/signed-image";
import { ReportDialog } from "@/components/report-dialog";
import { detectScamSignals, accountIsTrusted } from "@/lib/anti-scam";
import { toast } from "sonner";
import { ArrowLeft, Send } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { SpiralLoaderBlock } from "@/components/spiral-loader";

export const Route = createFileRoute("/_authenticated/chat/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Conversa — Brasa Swing" }] }),
  component: ChatRoom,
});

function ChatRoom() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { data: me } = useMyProfile(user?.id);
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const { data: conv } = useQuery({
    queryKey: ["conv", id],
    queryFn: async () => {
      const { data } = await supabase.from("conversations").select("id, user_a, user_b, unlocked").eq("id", id).maybeSingle();
      return data;
    },
  });

  const otherId = conv ? (conv.user_a === user?.id ? conv.user_b : conv.user_a) : null;

  const { data: other } = useQuery({
    queryKey: ["chat-other", otherId],
    enabled: !!otherId,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("handle, display_name, avatar_url, verified").eq("user_id", otherId!).maybeSingle();
      return data;
    },
  });

  const { data: messages } = useQuery({
    queryKey: ["msgs", id],
    queryFn: async () => {
      const { data } = await supabase.from("messages").select("*").eq("conversation_id", id).order("created_at");
      return data ?? [];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`conv:${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["msgs", id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, qc]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages?.length]);

  async function send() {
    if (!user || !text.trim() || !me) return;
    const trusted = accountIsTrusted({ verified: me.verified, createdAt: me.created_at });
    if (!trusted) {
      const warn = detectScamSignals(text);
      if (warn) return toast.error(warn);
    }
    const body = text;
    setText("");
    const { error } = await supabase.from("messages").insert({ conversation_id: id, sender_id: user.id, body });
    if (error) toast.error("Falha ao enviar");
  }

  if (!conv) return <p className="p-6 text-center">Carregando...</p>;

  return (
    <div className="mx-auto flex h-[calc(100vh-5rem)] max-w-md flex-col px-2 pt-2">
      <header className="flex items-center gap-2 border-b border-border pb-2">
        <Link to="/chat" className="rounded-md p-2 hover:bg-secondary"><ArrowLeft className="h-4 w-4" /></Link>
        {other && (
          <Link to={"/u/$handle" as never} params={{ handle: other.handle } as never} className="flex flex-1 items-center gap-2">
            <SignedImage bucket="avatars" path={other.avatar_url} alt={other.display_name} className="h-9 w-9 rounded-full object-cover" />
            <div><p className="text-sm font-semibold">{other.display_name}</p><p className="text-xs text-muted-foreground">@{other.handle}</p></div>
          </Link>
        )}
        <ReportDialog targetType="chat" targetId={id} />
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto py-3">
        {(messages ?? []).map((m: any) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-1.5 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                {m.status === "removed" ? <em className="text-xs opacity-70">[removida pela moderação]</em> : m.body}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2 border-t border-border py-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Mensagem..." maxLength={2000} />
        <Button type="submit" size="icon"><Send className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}
