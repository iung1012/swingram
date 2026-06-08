import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile } from "@/hooks/use-profile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VerifiedAvatar } from "@/components/verified-avatar";
import { ReportDialog } from "@/components/report-dialog";
import { detectScamSignals, accountIsTrusted } from "@/lib/anti-scam";
import { SpiralLoaderBlock } from "@/components/spiral-loader";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy,
  Flag,
  MoreHorizontal,
  MoreVertical,
  Reply,
  Send,
  Trash2,
  UserMinus2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/chat/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Conversa — Brasa Swing" }] }),
  component: ChatRoom,
});

function formatTime(iso: string | null | undefined) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

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
      const { data } = await supabase
        .from("conversations")
        .select("id, user_a, user_b, unlocked")
        .eq("id", id)
        .maybeSingle();
      return data;
    },
  });

  const otherId = conv ? (conv.user_a === user?.id ? conv.user_b : conv.user_a) : null;

  const { data: other } = useQuery({
    queryKey: ["chat-other", otherId],
    enabled: !!otherId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("handle, display_name, avatar_url, verified")
        .eq("user_id", otherId!)
        .maybeSingle();
      return data;
    },
  });

  const { data: messages } = useQuery({
    queryKey: ["msgs", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", id)
        .order("created_at");
      return data ?? [];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`conv:${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["msgs", id] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, qc]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  async function send() {
    if (!user || !text.trim() || !me) return;
    const trusted = accountIsTrusted({ verified: me.verified, createdAt: me.created_at });
    if (!trusted) {
      const warn = detectScamSignals(text);
      if (warn) return toast.error(warn);
    }
    const body = text;
    setText("");
    const { error } = await supabase.from("messages").insert({
      conversation_id: id,
      sender_id: user.id,
      body,
    });
    if (error) toast.error("Falha ao enviar");
  }

  async function deleteMessage(mid: string) {
    const { error } = await supabase.from("messages").delete().eq("id", mid);
    if (error) return toast.error("Falha ao excluir");
    qc.invalidateQueries({ queryKey: ["msgs", id] });
  }

  async function copyText(body: string) {
    try {
      await navigator.clipboard.writeText(body);
      toast.success("Copiado");
    } catch {
      toast.error("Falha ao copiar");
    }
  }

  if (!conv) return <SpiralLoaderBlock />;

  return (
    <div className="mx-auto flex h-[calc(100vh-5rem)] max-w-md flex-col px-2 pt-2 pb-2">
      <Card className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <CardHeader className="flex flex-row items-center gap-3 border-b border-border px-3 py-2.5 space-y-0">
          <Link to="/chat" className="rounded-md p-1.5 hover:bg-secondary">
            <ArrowLeft className="h-4 w-4" />
          </Link>

          {other ? (
            <Link
              to={"/u/$handle" as never}
              params={{ handle: other.handle } as never}
              className="flex flex-1 items-center gap-3 min-w-0"
            >
              <div className="relative">
                <VerifiedAvatar
                  bucket="avatars"
                  path={other.avatar_url}
                  alt={other.display_name}
                  verified={other.verified}
                  className="h-10 w-10"
                />
                <span
                  aria-label="online"
                  className="absolute -bottom-0.5 -right-0.5 inline-block size-3 rounded-full border-2 border-background bg-green-500"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{other.display_name}</p>
                <p className="truncate text-xs text-muted-foreground">@{other.handle}</p>
              </div>
            </Link>
          ) : (
            <div className="flex-1" />
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem className="text-destructive focus:text-destructive">
                <UserMinus2 className="mr-2 h-4 w-4" />
                Bloquear usuário
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir conversa
              </DropdownMenuItem>
              <ReportDialog
                targetType="chat"
                targetId={id}
                trigger={
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <Flag className="mr-2 h-4 w-4" />
                    Denunciar
                  </DropdownMenuItem>
                }
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>

        {/* Messages */}
        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full">
            <div className="flex flex-col gap-3 px-3 py-4">
              {(messages ?? []).map((m: any) => {
                const mine = m.sender_id === user?.id;
                const removed = m.status === "removed";
                return (
                  <div
                    key={m.id}
                    className={cn("group flex items-end gap-2", mine ? "justify-end" : "justify-start")}
                  >
                    {!mine && other && (
                      <VerifiedAvatar
                        bucket="avatars"
                        path={other.avatar_url}
                        alt={other.display_name}
                        verified={other.verified}
                        className="h-7 w-7 shrink-0"
                      />
                    )}

                    <div className={cn("flex max-w-[75%] flex-col", mine ? "items-end" : "items-start")}>
                      <div
                        className={cn(
                          "rounded-2xl px-3 py-2 text-sm leading-snug break-words",
                          mine
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-secondary text-secondary-foreground rounded-bl-md"
                        )}
                      >
                        {removed ? (
                          <em className="text-xs opacity-70">[removida pela moderação]</em>
                        ) : (
                          m.body
                        )}
                      </div>
                      <div
                        className={cn(
                          "mt-1 flex items-center gap-1 text-[10px] text-muted-foreground",
                          mine ? "flex-row-reverse" : "flex-row"
                        )}
                      >
                        <span>{formatTime(m.created_at)}</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="rounded p-0.5 opacity-0 transition-opacity hover:bg-secondary group-hover:opacity-100 focus:opacity-100"
                              aria-label="Ações da mensagem"
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align={mine ? "end" : "start"}
                            className="w-40"
                          >
                            <DropdownMenuItem
                              onSelect={() => setText((t) => (t ? t : `> ${m.body}\n`))}
                            >
                              <Reply className="mr-2 h-4 w-4" />
                              Responder
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => copyText(m.body ?? "")}>
                              <Copy className="mr-2 h-4 w-4" />
                              Copiar
                            </DropdownMenuItem>
                            {mine && !removed && (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={() => deleteMessage(m.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir
                              </DropdownMenuItem>
                            )}
                            {!mine && (
                              <ReportDialog
                                targetType="message"
                                targetId={m.id}
                                trigger={
                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                    <Flag className="mr-2 h-4 w-4" />
                                    Denunciar
                                  </DropdownMenuItem>
                                }
                              />
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
          </ScrollArea>
        </CardContent>

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-center gap-2 border-t border-border px-3 py-2.5"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Mensagem..."
            maxLength={2000}
            className="h-10 flex-1 rounded-full border border-border bg-secondary/40 px-4 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground/25"
          />
          <Button type="submit" size="icon" className="h-10 w-10 rounded-full shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </Card>
    </div>
  );
}
