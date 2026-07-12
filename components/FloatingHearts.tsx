"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const EMOJIS = ["💕", "💖", "💗", "💝", "💞", "✨", "🌸", "🌺", "🌷", "🦋", "💫", "🌟"];
const COLORS = [
  "text-pink-300",
  "text-pink-400",
  "text-rose-300",
  "text-rose-400",
  "text-purple-300",
  "text-fuchsia-300",
  "text-amber-200",
  "text-red-300",
];

type FloatingHeart = {
  id: number;
  x: number;
  emoji: string;
  colorClass: string;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
  drift: number;
};

export default function FloatingHearts({ active = true }: { active?: boolean }) {
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number | null>(null);

  const addHeart = useCallback(() => {
    const newHeart: FloatingHeart = {
      id: Date.now() + Math.random(),
      x: 5 + Math.random() * 90,
      emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
      colorClass: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 14 + Math.random() * 24,
      duration: 4 + Math.random() * 4,
      delay: Math.random() * 0.3,
      opacity: 0.35 + Math.random() * 0.45,
      drift: (Math.random() - 0.5) * 12,
    };
    setHearts((prev) => [...prev.slice(-16), newHeart]);

    setTimeout(() => {
      setHearts((prev) => prev.filter((h) => h.id !== newHeart.id));
    }, (newHeart.duration + newHeart.delay + 0.5) * 1000);
  }, []);

  useEffect(() => {
    if (!active) return;

    function startLoop() {
      stopLoop();
      addHeart();
      intervalRef.current = setInterval(addHeart, 1200);
    }

    function stopLoop() {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    startLoop();

    const onVisibilityChange = () => {
      if (document.hidden) stopLoop();
      else startLoop();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stopLoop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [active, addHeart]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      <AnimatePresence>
        {hearts.map((heart) => (
          <motion.div
            key={heart.id}
            initial={{
              opacity: 0,
              scale: 0,
              rotate: -10 + Math.random() * 20,
              x: `${heart.x}vw`,
              y: "103vh",
            }}
            animate={{
              opacity: [0, heart.opacity, heart.opacity, 0],
              scale: [0, 1.1, 1, 0.8],
              rotate: [0, heart.drift > 0 ? 8 : -8, heart.drift > 0 ? -4 : 4, 0],
              y: ["103vh", "-8vh"],
              x: [
                `${heart.x}vw`,
                `${heart.x + heart.drift * 0.3}vw`,
                `${heart.x + heart.drift * 0.7}vw`,
                `${heart.x + heart.drift}vw`,
              ],
            }}
            exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.3 } }}
            transition={{
              duration: heart.duration,
              delay: heart.delay,
              ease: ["easeInOut", "easeOut", "easeIn"],
              times: [0, 0.2, 0.7, 1],
            }}
            className={`select-none ${heart.colorClass}`}
          >
            <span
              className="block drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)] dark:drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
              style={{ fontSize: heart.size, lineHeight: 1 }}
            >
              {heart.emoji}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
