"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const emojis = ["❤️", "💕", "💖", "💗", "🩷", "💝", "💘"];

type Heart = {
  id: number;
  x: number;
  y: number;
  emoji: string;
  size: number;
  rotation: number;
  dx: number;
  dy: number;
};

let nextId = 0;

const isInteractive = (el: EventTarget | null): boolean => {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "button" || tag === "a" || tag === "input" || tag === "textarea" || tag === "select") return true;
  if (el.getAttribute("role") === "button") return true;
  if (el.closest("button, a, input, textarea, select, [role='button']")) return true;
  return false;
};

export default function ClickHearts() {
  const [hearts, setHearts] = useState<Heart[]>([]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const addHearts = useCallback((x: number, y: number) => {
    const count = 4 + Math.floor(Math.random() * 5);
    const newHearts: Heart[] = [];
    for (let i = 0; i < count; i++) {
      newHearts.push({
        id: nextId++,
        x: x + (Math.random() - 0.5) * 40,
        y: y + (Math.random() - 0.5) * 20,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        size: 14 + Math.random() * 18,
        rotation: (Math.random() - 0.5) * 60,
        dx: (Math.random() - 0.5) * 2,
        dy: -(2 + Math.random() * 2),
      });
    }
    setHearts((prev) => [...prev, ...newHearts]);
    const timer = setTimeout(() => {
      setHearts((prev) => prev.filter((h) => h.id < nextId - count - 10));
    }, 1200);
    timersRef.current.push(timer);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (isInteractive(e.target)) return;
      addHearts(e.clientX, e.clientY);
    };
    document.addEventListener("click", handler);
    return () => {
      document.removeEventListener("click", handler);
      timersRef.current.forEach(clearTimeout);
    };
  }, [addHearts]);

  return (
    <div className="pointer-events-none fixed inset-0" aria-hidden="true" style={{ zIndex: 9999 }}>
      <AnimatePresence>
        {hearts.map((heart) => (
          <motion.span
            key={heart.id}
            initial={{ x: heart.x, y: heart.y, opacity: 1, scale: 1, rotate: heart.rotation }}
            animate={{
              y: heart.y + heart.dy * 40,
              x: heart.x + heart.dx * 30,
              opacity: 0,
              scale: 0.3,
              rotate: heart.rotation + heart.dx * 20,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9 + Math.random() * 0.3, ease: "easeOut" }}
            style={{
              position: "fixed",
              left: 0,
              top: 0,
              fontSize: heart.size,
              pointerEvents: "none",
              willChange: "transform",
            }}
          >
            {heart.emoji}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}
