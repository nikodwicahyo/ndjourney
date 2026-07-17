"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Heart, Share2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const CONFETTI = ["❤️", "✨", "💫", "🌟", "💖", "⭐", "🎉", "💕"];

export default function MeetBanner({ show, distance }: { show: boolean; distance?: number | null }) {
  const reduceMotion = useReducedMotion();
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    if (show) {
      setBurst(true);
      const t = setTimeout(() => setBurst(false), 2000);
      return () => clearTimeout(t);
    }
  }, [show]);

  const pieces = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        left: 3 + i * 6,
        delay: i * 0.08,
        emoji: CONFETTI[i % CONFETTI.length],
        drift: (Math.random() - 0.5) * 50,
        size: 14 + Math.random() * 12,
      })),
    [],
  );

  const handleShare = async () => {
    const distText = distance !== null && distance !== undefined
      ? `Jarak: ${distance < 1000 ? `${Math.round(distance)} m` : `${(distance / 1000).toFixed(2)} km`}`
      : "";
    const text = `Kami sedang bersama! 💕 ${distText}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "NdJourney", text });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("Momen disalin ke clipboard! 💕");
      }
    } catch {
      // User cancelled
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.96 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-r from-rose-500/15 via-primary/10 to-amber-400/15 p-4 text-center shadow-sm"
        >
          <motion.div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 50% 0%, rgba(244,63,94,0.18), transparent 70%)",
            }}
            animate={reduceMotion ? undefined : { opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />

          <div className="relative flex items-center justify-center gap-2">
            <motion.span
              animate={reduceMotion ? undefined : { scale: [1, 1.15, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            >
              <Heart className="h-5 w-5 fill-primary text-primary" />
            </motion.span>
            <span className="font-heading text-lg font-semibold text-foreground">
              Kalian berdua bertemu! 💕
            </span>
            <motion.button
              type="button"
              onClick={handleShare}
              className="ml-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              aria-label="Bagikan momen"
            >
              <Share2 className="h-3.5 w-3.5" />
            </motion.button>
          </div>

          {distance !== null && distance !== undefined && (
            <p className="relative mt-1 text-xs text-muted-foreground">
              Jarak{" "}
              {distance < 1000
                ? `${Math.round(distance)} meter`
                : `${(distance / 1000).toFixed(2)} km`}{" "}
              — waktu yang tepat untuk melewatkan momen bersama.
            </p>
          )}

          {!reduceMotion &&
            (burst || show) &&
            pieces.map((p, i) => (
              <motion.span
                key={`confetti-${i}`}
                className="pointer-events-none absolute top-1"
                style={{ left: `${p.left}%`, fontSize: p.size }}
                initial={{ y: 0, opacity: 0, scale: 0.4 }}
                animate={
                  burst
                    ? { y: "140%", opacity: [0, 1, 1, 0], x: p.drift, rotate: 360 }
                    : { y: "120%", opacity: [0, 1, 0], x: p.drift, rotate: 360 }
                }
                transition={{
                  duration: burst ? 2.5 : 3.5,
                  delay: p.delay,
                  repeat: burst ? 0 : Infinity,
                  ease: "easeIn",
                }}
              >
                {p.emoji}
              </motion.span>
            ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
