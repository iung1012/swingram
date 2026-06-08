"use client";

import * as React from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Pause,
  Trash2,
  Eye,
  Send,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SpiralLoader } from "@/components/spiral-loader";
import { SignedImage } from "@/components/signed-image";

export interface Story {
  id: string;
  type: "image" | "video";
  src: string;
  duration?: number;
}

export interface StoryPerson {
  id: string;
  name: string;
  avatar?: string | null;
  emoji?: string | null;
}

export interface StoryReplyInfo {
  id: string;
  name: string;
  avatar?: string | null;
  body: string;
}

const DEFAULT_IMAGE_DURATION = 5000;
const QUICK_EMOJIS = ["🔥", "❤️", "😍", "😮", "😂", "👏"];

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? "-100%" : "100%", opacity: 0 }),
};

function fmtTime(ts?: string) {
  if (!ts) return "";
  const d = new Date(ts);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export interface StoryViewerProps {
  stories: Story[];
  username: string;
  avatar?: string | null;
  timestamp?: string;
  initialIndex?: number;
  onClose: () => void;
  onStoryView?: (id: string) => void;
  onDeleteStory?: (id: string) => void | Promise<void>;
  canDelete?: boolean;
  isOwner?: boolean;
  onReact?: (storyId: string, emoji: string) => void;
  onReply?: (storyId: string, body: string) => void;
  myReactions?: Record<string, string>;
  viewersByStory?: Record<string, StoryPerson[]>;
  repliesByStory?: Record<string, StoryReplyInfo[]>;
}

export function StoryViewer({
  stories,
  username,
  avatar,
  timestamp,
  initialIndex = 0,
  onClose,
  onStoryView,
  onDeleteStory,
  canDelete = false,
  isOwner = false,
  onReact,
  onReply,
  myReactions,
  viewersByStory,
  repliesByStory,
}: StoryViewerProps) {
  const [currentIndex, setCurrentIndex] = React.useState(initialIndex);
  const [progress, setProgress] = React.useState(0);
  const [isPaused, setIsPaused] = React.useState(false);
  const [showInsights, setShowInsights] = React.useState(false);
  const [replyText, setReplyText] = React.useState("");
  const [duration, setDuration] = React.useState(DEFAULT_IMAGE_DURATION);
  const [direction, setDirection] = React.useState(0);
  const [isReady, setIsReady] = React.useState(false);
  const [isBuffering, setIsBuffering] = React.useState(false);

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = React.useRef(0);
  const elapsedRef = React.useRef(0);

  const story = stories[currentIndex];

  const goNext = React.useCallback(() => {
    if (currentIndex < stories.length - 1) {
      setDirection(1);
      setCurrentIndex((i) => i + 1);
      setProgress(0);
      elapsedRef.current = 0;
    } else {
      onClose();
    }
  }, [currentIndex, stories.length, onClose]);

  const goPrev = React.useCallback(() => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex((i) => i - 1);
    }
    setProgress(0);
    elapsedRef.current = 0;
  }, [currentIndex]);

  const lastViewedRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!story?.id) return;
    if (lastViewedRef.current === story.id) return;
    lastViewedRef.current = story.id;
    onStoryView?.(story.id);
  }, [story?.id, onStoryView]);

  React.useEffect(() => {
    setProgress(0);
    elapsedRef.current = 0;
    startRef.current = Date.now();
    setIsReady(false);
    setIsBuffering(false);
    if (story.type === "image") setDuration(story.duration ?? DEFAULT_IMAGE_DURATION);
  }, [currentIndex, story.type, story.duration]);

  // image progress
  React.useEffect(() => {
    if (story.type !== "image") return;
    if (isPaused || !isReady) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    startRef.current = Date.now() - elapsedRef.current;
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      elapsedRef.current = elapsed;
      const p = Math.min((elapsed / duration) * 100, 100);
      setProgress(p);
      if (p >= 100) goNext();
    }, 50);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPaused, isReady, duration, story.type, goNext]);

  // video pause/play
  React.useEffect(() => {
    if (story.type !== "video" || !videoRef.current) return;
    if (isPaused) videoRef.current.pause();
    else if (isReady) videoRef.current.play().catch(() => {});
  }, [isPaused, isReady, story.type]);

  // keys
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "Escape") onClose();
      else if (e.key === " ") {
        e.preventDefault();
        setIsPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, onClose]);

  React.useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleTap = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 2) goPrev();
    else goNext();
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 60 || Math.abs(info.velocity.x) > 500) {
      if (info.offset.x > 0) goPrev();
      else goNext();
    }
    if (info.offset.y > 120 || info.velocity.y > 500) onClose();
  };

  const showSpinner = !isReady || isBuffering;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black">
      <div
        ref={containerRef}
        className="relative h-full w-full max-w-md overflow-hidden bg-black sm:my-4 sm:h-[min(92vh,820px)] sm:rounded-3xl"
      >
        {/* Progress */}
        <div className="absolute left-2 right-2 top-2 z-30 flex gap-1">
          {stories.map((_, i) => (
            <div key={i} className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
              <div
                className="absolute inset-y-0 left-0 bg-white"
                style={{
                  width: i < currentIndex ? "100%" : i === currentIndex ? `${progress}%` : "0%",
                  transition: i === currentIndex ? "none" : "width 0.2s linear",
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute left-3 right-3 top-6 z-30 flex items-center gap-3">
          {avatar ? (
            <SignedImage bucket="avatars" path={avatar} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-white/70" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-white/20" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white drop-shadow">{username}</p>
            {timestamp && <p className="text-[11px] text-white/70">{fmtTime(timestamp)}</p>}
          </div>
          {canDelete && onDeleteStory && (
            <button
              onClick={async (e) => {
                e.stopPropagation();
                if (!confirm("Excluir este story?")) return;
                await onDeleteStory(story.id);
              }}
              aria-label="Excluir story"
              className="rounded-full p-1.5 text-white/90 hover:bg-white/15"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Fechar"
            className="rounded-full p-1.5 text-white/90 hover:bg-white/15"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Slide */}
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ x: { type: "spring", stiffness: 300, damping: 32 }, opacity: { duration: 0.15 } }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            onPointerDown={() => setIsPaused(true)}
            onPointerUp={() => setIsPaused(false)}
            onPointerCancel={() => setIsPaused(false)}
            onClick={handleTap}
            className="absolute inset-0 flex items-center justify-center"
          >
            {showSpinner && (
              <div className="absolute inset-0 z-10 flex items-center justify-center">
                <SpiralLoader size={28} />
              </div>
            )}
            {story.type === "video" ? (
              <video
                ref={videoRef}
                src={story.src}
                className="h-full w-full object-contain"
                autoPlay
                playsInline
                muted
                onLoadedData={(e) => {
                  setDuration(e.currentTarget.duration * 1000);
                  setIsReady(true);
                }}
                onTimeUpdate={(e) => {
                  const v = e.currentTarget;
                  if (v.duration > 0) setProgress((v.currentTime / v.duration) * 100);
                }}
                onWaiting={() => setIsBuffering(true)}
                onPlaying={() => setIsBuffering(false)}
                onEnded={goNext}
              />
            ) : (
              <img
                src={story.src}
                alt=""
                draggable={false}
                onLoad={() => setIsReady(true)}
                className="h-full w-full select-none object-contain"
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Pause indicator */}
        {isPaused && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/60 px-3 py-1.5 text-[11px] text-white">
            <span className="inline-flex items-center gap-1.5">
              <Pause className="h-3 w-3" /> Pausado
            </span>
          </div>
        )}

        {/* Side controls (desktop) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          disabled={currentIndex === 0}
          aria-label="Anterior"
          className="absolute left-2 top-1/2 z-30 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 disabled:opacity-30 sm:flex"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          aria-label="Próximo"
          className="absolute right-2 top-1/2 z-30 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 sm:flex"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        {/* Footer de engajamento */}
        <div
          className="absolute inset-x-0 bottom-0 z-30 p-3"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {isOwner ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowInsights((s) => !s);
                setIsPaused(true);
              }}
              className="mx-auto flex items-center gap-2 rounded-full bg-black/55 px-4 py-2 text-sm text-white backdrop-blur"
            >
              <Eye className="h-4 w-4" />
              {viewersByStory?.[story.id]?.length ?? 0} visualizações
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-1.5">
                {QUICK_EMOJIS.map((em) => {
                  const active = myReactions?.[story.id] === em;
                  return (
                    <button
                      key={em}
                      onClick={(e) => {
                        e.stopPropagation();
                        onReact?.(story.id, em);
                      }}
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full text-xl transition",
                        active ? "scale-110 bg-white/25" : "bg-black/40 hover:bg-black/60"
                      )}
                    >
                      {em}
                    </button>
                  );
                })}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = replyText.trim();
                  if (!v) return;
                  onReply?.(story.id, v);
                  setReplyText("");
                }}
                className="flex items-center gap-2"
              >
                <input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onFocus={() => setIsPaused(true)}
                  onBlur={() => setIsPaused(false)}
                  placeholder={`Responder para ${username}…`}
                  maxLength={500}
                  className="h-10 flex-1 rounded-full border border-white/25 bg-black/40 px-4 text-sm text-white outline-none backdrop-blur placeholder:text-white/60"
                />
                <button
                  type="submit"
                  aria-label="Enviar resposta"
                  disabled={!replyText.trim()}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Painel de atividade (autor do story) */}
        {isOwner && showInsights && (
          <div
            className="absolute inset-x-0 bottom-0 top-1/3 z-40 overflow-y-auto rounded-t-3xl bg-background p-4 text-foreground"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Atividade do story</h3>
              <button
                onClick={() => {
                  setShowInsights(false);
                  setIsPaused(false);
                }}
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Eye className="h-3.5 w-3.5" /> Visualizações (
              {viewersByStory?.[story.id]?.length ?? 0})
            </p>
            <ul className="mb-4 space-y-2">
              {(viewersByStory?.[story.id] ?? []).map((p) => (
                <li key={p.id} className="flex items-center gap-2.5">
                  {p.avatar ? (
                    <SignedImage
                      bucket="avatars"
                      path={p.avatar}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-secondary" />
                  )}
                  <span className="flex-1 truncate text-sm">{p.name}</span>
                  {p.emoji && <span className="text-lg">{p.emoji}</span>}
                </li>
              ))}
              {(viewersByStory?.[story.id]?.length ?? 0) === 0 && (
                <li className="text-sm text-muted-foreground">Ninguém viu ainda.</li>
              )}
            </ul>

            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <MessageCircle className="h-3.5 w-3.5" /> Respostas (
              {repliesByStory?.[story.id]?.length ?? 0})
            </p>
            <ul className="space-y-2.5">
              {(repliesByStory?.[story.id] ?? []).map((r) => (
                <li key={r.id} className="flex items-start gap-2.5">
                  {r.avatar ? (
                    <SignedImage
                      bucket="avatars"
                      path={r.avatar}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-8 w-8 shrink-0 rounded-full bg-secondary" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium">{r.name}</p>
                    <p className="break-words text-sm text-muted-foreground">{r.body}</p>
                  </div>
                </li>
              ))}
              {(repliesByStory?.[story.id]?.length ?? 0) === 0 && (
                <li className="text-sm text-muted-foreground">Sem respostas ainda.</li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// === Thumbnail ring ===
export function StoryRingButton({
  segments,
  viewed,
  avatar,
  label,
  onClick,
  highlight,
}: {
  segments: number;
  viewed: boolean;
  avatar?: string | null;
  label: string;
  onClick: () => void;
  highlight?: boolean;
}) {
  const gap = segments > 1 ? 10 : 0;
  const seg = (360 - gap * segments) / segments;
  return (
    <button onClick={onClick} className="group flex w-16 shrink-0 flex-col items-center gap-1.5 outline-none">
      <span className="relative block h-16 w-16">
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
          {Array.from({ length: segments }).map((_, i) => {
            const start = i * (seg + gap);
            const end = start + seg;
            const r = 46;
            const s = (start * Math.PI) / 180;
            const e = (end * Math.PI) / 180;
            const x1 = 50 + r * Math.cos(s);
            const y1 = 50 + r * Math.sin(s);
            const x2 = 50 + r * Math.cos(e);
            const y2 = 50 + r * Math.sin(e);
            const large = seg > 180 ? 1 : 0;
            return (
              <path
                key={i}
                d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`}
                fill="none"
                stroke={viewed ? "hsl(var(--border))" : highlight ? "oklch(0.74 0.2 55)" : "oklch(0.85 0.18 85)"}
                strokeWidth={3}
                strokeLinecap="round"
              />
            );
          })}
        </svg>
        <span className="absolute inset-[6px] overflow-hidden rounded-full bg-secondary ring-2 ring-background">
          {avatar ? (
            <SignedImage bucket="avatars" path={avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase text-muted-foreground">
              {label.slice(0, 2)}
            </span>
          )}
        </span>
      </span>
      <span className="line-clamp-1 max-w-[64px] text-[11px] text-muted-foreground group-hover:text-foreground">
        {label}
      </span>
    </button>
  );
}
