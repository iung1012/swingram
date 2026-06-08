import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
import { SignedMedia } from "@/components/signed-media";
import { uploadToBucket } from "@/lib/storage";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Copy,
  Flag,
  ImagePlus,
  Loader2,
  MoreHorizontal,
  MoreVertical,
  Reply,
  Send,
  Trash2,
  UserMinus2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_IMAGE_MB = 8;
const MAX_VIDEO_MB = 50;

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
  const nav = useNavigate();
  const [text, setText] = useState("");
  const [pending, setPending] = useState<{
    file: File;
    kind: "image" | "video";
    preview: string;
  } | null>(null);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

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
        { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["msgs", id] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, qc]);

  // Marca como lidas as mensagens recebidas assim que aparecem na tela.
  useEffect(() => {
    if (!user || !messages?.length) return;
    const hasUnreadIncoming = messages.some(
      (m) => m.sender_id !== user.id && !m.read_at
    );
    if (!hasUnreadIncoming) return;
    supabase
      .rpc("mark_messages_read", { p_conversation_id: id })
      .then(() => qc.invalidateQueries({ queryKey: ["msgs", id] }));
  }, [messages, user, id, qc]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  useEffect(() => {
    return () => {
      if (pending) URL.revokeObjectURL(pending.preview);
    };
  }, [pending]);

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const isImage = f.type.startsWith("image/");
    const isVideo = f.type.startsWith("video/");
    if (!isImage && !isVideo) return toast.error("Tipo não suportado");
    const limit = isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB;
    if (f.size > limit * 1024 * 1024)
      return toast.error(`Arquivo maior que ${limit}MB`);
    setPending((prev) => {
      if (prev) URL.revokeObjectURL(prev.preview);
      return {
        file: f,
        kind: isVideo ? "video" : "image",
        preview: URL.createObjectURL(f),
      };
    });
  }

  function clearPending() {
    setPending((prev) => {
      if (prev) URL.revokeObjectURL(prev.preview);
      return null;
    });
  }

  async function send() {
    if (!user || !me || sending) return;
    const body = text.trim();
    if (!body && !pending) return;

    const trusted = accountIsTrusted({ verified: me.verified, createdAt: me.created_at });
    if (!trusted && body) {
      const warn = detectScamSignals(body);
      if (warn) return toast.error(warn);
    }

    setSending(true);
    try {
      const { checkRateLimit } = await import("@/lib/rate-limit");
      if (!(await checkRateLimit("send_message"))) {
        setSending(false);
        return;
      }
      let media_path: string | null = null;
      let media_kind: "image" | "video" | null = null;
      if (pending) {
        media_path = await uploadToBucket("chat_media", user.id, pending.file, id);
        media_kind = pending.kind;
      }
      const { error } = await supabase.from("messages").insert({
        conversation_id: id,
        sender_id: user.id,
        body: body || null,
        media_path,
        media_kind,
      });
      if (error) throw error;
      setText("");
      clearPending();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar");
    } finally {
      setSending(false);
    }
  }

  async function blockUser() {
    if (!user || !otherId) return;
    const { error } = await supabase
      .from("blocks")
      .insert({ user_id: user.id, blocked_user_id: otherId });
    if (error) return toast.error("Falha ao bloquear");
    toast.success("Usuário bloqueado");
    nav({ to: "/chat" });
  }

  async function deleteConversation() {
    const { error } = await supabase.from("conversations").delete().eq("id", id);
    if (error) return toast.error("Falha ao excluir");
    toast.success("Conversa excluída");
    nav({ to: "/chat" });
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
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={blockUser}
              >
                <UserMinus2 className="mr-2 h-4 w-4" />
                Bloquear usuário
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={deleteConversation}
              >
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
              {(messages ?? []).map((m) => {
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
                      {removed ? (
                        <div
                          className={cn(
                            "rounded-2xl px-3 py-2 text-sm leading-snug",
                            mine
                              ? "bg-primary text-primary-foreground rounded-br-md"
                              : "bg-secondary text-secondary-foreground rounded-bl-md"
                          )}
                        >
                          <em className="text-xs opacity-70">[removida pela moderação]</em>
                        </div>
                      ) : (
                        <div
                          className={cn(
                            "overflow-hidden rounded-2xl text-sm leading-snug break-words",
                            mine
                              ? "bg-primary text-primary-foreground rounded-br-md"
                              : "bg-secondary text-secondary-foreground rounded-bl-md"
                          )}
                        >
                          {m.media_path && (
                            <SignedMedia
                              bucket="chat_media"
                              path={m.media_path}
                              kind={m.media_kind === "video" ? "video" : "image"}
                              alt="mídia da conversa"
                              className="block max-h-72 w-full max-w-[260px] object-cover"
                              controls={m.media_kind === "video"}
                            />
                          )}
                          {m.body && <div className="px-3 py-2">{m.body}</div>}
                        </div>
                      )}
                      <div
                        className={cn(
                          "mt-1 flex items-center gap-1 text-[10px] text-muted-foreground",
                          mine ? "flex-row-reverse" : "flex-row"
                        )}
                      >
                        <span>{formatTime(m.created_at)}</span>
                        {mine &&
                          !removed &&
                          (m.read_at ? (
                            <CheckCheck className="h-3 w-3 text-sky-500" aria-label="Lida" />
                          ) : (
                            <Check className="h-3 w-3 opacity-70" aria-label="Enviada" />
                          ))}
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
        <div className="border-t border-border">
          {pending && (
            <div className="flex items-center gap-2 px-3 pt-2.5">
              <div className="relative">
                {pending.kind === "video" ? (
                  <video
                    src={pending.preview}
                    className="h-16 w-16 rounded-lg object-cover"
                    muted
                    playsInline
                  />
                ) : (
                  <img
                    src={pending.preview}
                    alt=""
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                )}
                <button
                  type="button"
                  onClick={clearPending}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background"
                  aria-label="Remover anexo"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {pending.file.name}
              </span>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2 px-3 py-2.5"
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              onChange={pickFile}
              className="sr-only"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-full"
              onClick={() => fileRef.current?.click()}
              disabled={sending}
              aria-label="Anexar mídia"
            >
              <ImagePlus className="h-5 w-5" />
            </Button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Mensagem..."
              maxLength={2000}
              className="h-10 flex-1 rounded-full border border-border bg-secondary/40 px-4 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground/25"
            />
            <Button
              type="submit"
              size="icon"
              disabled={sending || (!text.trim() && !pending)}
              className="h-10 w-10 shrink-0 rounded-full"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
