"use client";

import * as React from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Pause, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SpiralLoader } from "@/components/spiral-loader";

export interface Story {
  id: string;
  type: "image" | "video";
  src: string;
  duration?: number;
}

const DEFAULT_IMAGE_DURATION = 5000;

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
}: StoryViewerProps) {
  const [currentIndex, setCurrentIndex] = React.useState(initialIndex);
  const [progress, setProgress] = React.useState(0);
  const [isPaused, setIsPaused] = React.useState(false);
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

  React.useEffect(() => {
    onStoryView?.(story.id);
  }, [story.id, onStoryView]);

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
            <img src={avatar} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-white/70" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-white/20" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white drop-shadow">{username}</p>
            {timestamp && <p className="text-[11px] text-white/70">{fmtTime(timestamp)}</p>}
          </div>
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
            <img src={avatar} alt="" className="h-full w-full object-cover" />
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
