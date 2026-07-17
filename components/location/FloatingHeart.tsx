"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { FloatingHeartEvent } from "@/hooks/useLocation";

type HeartRender = {
  id: string;
  event: FloatingHeartEvent;
  x: number;
  path: "straight" | "zigzag" | "curve";
};

const PATHS: HeartRender["path"][] = ["straight", "zigzag", "curve"];

export default function FloatingHeart({
  event,
  onDone,
}: {
  event: FloatingHeartEvent | null;
  onDone: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [hearts, setHearts] = useState<HeartRender[]>([]);
  const counterRef = useRef(0);
  const heartCountRef = useRef(0);

  const scheduleClear = useCallback(
    (id: string, duration: number) => {
      setTimeout(() => {
        setHearts((prev) => {
          const next = prev.filter((h) => h.id !== id);
          heartCountRef.current = next.length;
          if (next.length === 0) {
            onDone();
          }
          return next;
        });
      }, duration);
    },
    [onDone],
  );

  useEffect(() => {
    if (!event) return;
    const id = `heart-${++counterRef.current}`;
    const x = (Math.random() - 0.5) * 120;
    const path = PATHS[Math.floor(Math.random() * PATHS.length)];

    setHearts((prev) => {
      const next = [...prev, { id, event, x, path }];
      heartCountRef.current = next.length;
      return next;
    });

    scheduleClear(id, reduceMotion ? 200 : 2600);
  }, [event, onDone, reduceMotion, scheduleClear]);

  if (hearts.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <AnimatePresence>
        {hearts.map((h) => (
          <motion.div
            key={h.id}
            initial={{ opacity: 0, y: 0, scale: 0.3, x: 0 }}
            animate={
              reduceMotion
                ? { opacity: [0, 1, 0], y: 0, x: 0 }
                : h.path === "zigzag"
                  ? {
                      opacity: [0, 1, 1, 0],
                      y: -200,
                      x: [h.x, h.x * 1.5, h.x * 0.5, h.x * 2],
                      scale: [0.3, 1.4, 1.2, 0.8],
                    }
                  : h.path === "curve"
                    ? {
                        opacity: [0, 1, 1, 0],
                        y: -240,
                        x: [h.x, h.x * 0.3, h.x * 1.8, h.x * 0.8],
                        scale: [0.3, 1.2, 1.4, 0.7],
                      }
                    : {
                        opacity: [0, 1, 1, 0],
                        y: -180,
                        x: [0, h.x * 0.5, h.x * 0.3, h.x],
                        scale: [0.3, 1.3, 1.1, 0.9],
                      }
            }
            exit={{ opacity: 0, scale: 0.3 }}
            transition={{ duration: reduceMotion ? 0.6 : 2.4, ease: "easeOut" }}
            className="absolute bottom-6 left-1/2 text-4xl"
            style={{ translateX: "-50%" }}
          >
            {h.event.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
