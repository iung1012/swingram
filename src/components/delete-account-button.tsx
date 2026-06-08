"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Undo2, Trash2 } from "lucide-react";

type Props = {
  onConfirm: () => void | Promise<void>;
  countdownSeconds?: number;
  label?: string;
  cancelLabel?: string;
  className?: string;
};

export function DeleteAccountButton({
  onConfirm,
  countdownSeconds = 10,
  label = "Deletar minha conta",
  cancelLabel = "Cancelar exclusão",
  className,
}: Props) {
  const [isArmed, setIsArmed] = useState(false);
  const [count, setCount] = useState(countdownSeconds);
  const [isAnimating, setIsAnimating] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!isArmed) return;
    if (count === 0) {
      setConfirming(true);
      Promise.resolve(onConfirm()).finally(() => setConfirming(false));
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [isArmed, count, onConfirm]);

  function handleClick(next: boolean) {
    if (isAnimating || confirming) return;
    setIsAnimating(true);
    setIsArmed(next);
    if (next) setCount(countdownSeconds);
    setTimeout(() => setIsAnimating(false), 400);
  }

  return (
    <div className={className}>
      <AnimatePresence mode="wait" initial={false}>
        {!isArmed ? (
          <motion.button
            key="idle"
            layout
            type="button"
            onClick={() => handleClick(true)}
            whileTap={{ scale: 0.96 }}
            style={{ pointerEvents: isAnimating ? "none" : "auto" }}
            initial={{ filter: "blur(2px)", opacity: 0 }}
            animate={{ filter: "blur(0px)", opacity: 1 }}
            exit={{ filter: "blur(2px)", opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="inline-flex items-center gap-2 rounded-full bg-destructive px-5 py-3 text-sm font-semibold text-destructive-foreground shadow-sm transition hover:bg-destructive/90"
          >
            <Trash2 className="h-4 w-4" strokeWidth={2.2} />
            <span className="inline-flex overflow-hidden">
              {label.split("").map((c, i) => (
                <motion.span
                  key={`${c}-${i}`}
                  initial={{ y: 12, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: i * 0.015, duration: 0.2 }}
                >
                  {c === " " ? "\u00A0" : c}
                </motion.span>
              ))}
            </span>
          </motion.button>
        ) : (
          <motion.button
            key="armed"
            layout
            type="button"
            onClick={() => handleClick(false)}
            whileTap={{ scale: 0.96 }}
            style={{ pointerEvents: isAnimating || confirming ? "none" : "auto" }}
            initial={{ filter: "blur(2px)", opacity: 0 }}
            animate={{ filter: "blur(0px)", opacity: 1 }}
            exit={{ filter: "blur(2px)", opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="inline-flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-3 text-sm font-semibold text-destructive"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-destructive/15">
              <Undo2 className="h-4 w-4" strokeWidth={2.4} />
            </span>
            <span className="inline-flex overflow-hidden">
              {cancelLabel.split("").map((c, i) => (
                <motion.span
                  key={`${c}-${i}`}
                  initial={{ y: 12, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: i * 0.015, duration: 0.2 }}
                >
                  {c === " " ? "\u00A0" : c}
                </motion.span>
              ))}
            </span>
            <span className="ml-1 flex h-7 min-w-[28px] items-center justify-center rounded-full bg-destructive px-2 text-xs font-bold tabular-nums text-destructive-foreground">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={count}
                  initial={{ y: -10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 10, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  {count}
                </motion.span>
              </AnimatePresence>
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
