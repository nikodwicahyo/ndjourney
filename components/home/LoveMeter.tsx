"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Heart, Sparkles, Lightbulb } from "lucide-react";

type LoveMeterProps = {
  daysTogether?: number;
  milestoneCount?: number;
  noteCount?: number;
  letterCount?: number;
  wishProgress?: number;
  wishDone?: number;
  wishTotal?: number;
  photoCount?: number;
};

function getAdaptiveGoal(value: number): { goal: number; multiplier: string } {
  if (value === 0) return { goal: 3, multiplier: "+3" };
  if (value < 10) return { goal: Math.ceil(value * 1.1), multiplier: "10%" };
  if (value < 25) return { goal: Math.ceil(value * 1.3), multiplier: "30%" };
  if (value < 50) return { goal: Math.ceil(value * 1.5), multiplier: "50%" };
  if (value < 100) return { goal: Math.ceil(value * 1.7), multiplier: "70%" };
  if (value < 250) return { goal: Math.ceil(value * 2), multiplier: "100%" };
  if (value < 500) return { goal: Math.ceil(value * 2.5), multiplier: "150%" };
  return { goal: Math.ceil(value * 3), multiplier: "200%" };
}

export default function LoveMeter({
  daysTogether = 0,
  milestoneCount = 0,
  noteCount = 0,
  letterCount = 0,
  wishProgress = 0,
  wishDone = 0,
  wishTotal = 0,
  photoCount = 0,
}: LoveMeterProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const [isHovered, setIsHovered] = useState(false);

  const quantityMetrics = [
    { value: milestoneCount, key: "milestoneCount", icon: "📍", label: "Momen" },
    { value: noteCount, key: "noteCount", icon: "📝", label: "Catatan" },
    { value: letterCount, key: "letterCount", icon: "💌", label: "Surat" },
    { value: photoCount, key: "photoCount", icon: "📸", label: "Foto & Video" },
  ];

  const quantityProgress = quantityMetrics.map((m) => {
    const { goal, multiplier } = getAdaptiveGoal(m.value);
    return { ...m, goal, multiplier, pct: Math.min(Math.round((m.value / goal) * 100), 100) };
  });
  const avgProgress =
    quantityProgress.reduce((s, m) => s + m.pct, 0) / quantityProgress.length / 100;
  const nonZero = quantityMetrics.filter((m) => m.value > 0).length;

  const rawScore =
    avgProgress * 30 +
    (nonZero / quantityMetrics.length) * 20 +
    Math.min(daysTogether / 365, 1) * 12 +
    wishProgress * 13 +
    25;

  const targetPercent = Math.min(Math.round(rawScore), 100);
  const [displayPercent, setDisplayPercent] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const start = performance.now();
    const duration = 2000;
    const raf = () => {
      const elapsed = performance.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayPercent(Math.round(eased * targetPercent));
      if (progress < 1) requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }, [isInView, targetPercent]);

  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (displayPercent / 100) * circumference;
  const color =
    displayPercent < 40
      ? "#F43F5E"
      : displayPercent < 65
        ? "#F97316"
        : displayPercent < 85
          ? "#22C55E"
          : "#6366F1";

  const getLabel = () => {
    if (displayPercent < 30) return "Perlu dirawat 💪";
    if (displayPercent < 50) return "Mulai hangat 🌱";
    if (displayPercent < 65) return "Semakin kuat 🌻";
    if (displayPercent < 80) return "Harmonis 💞";
    if (displayPercent < 93) return "Hampir sempurna ✨";
    return "Soulmate! 💎";
  };

  const tips = [
    ...quantityProgress.map((m) => ({
      icon: m.icon,
      label: m.label,
      current: m.value,
      max: m.goal,
      pct: m.pct,
      multiplier: m.multiplier,
    })),
    {
      icon: "📅",
      label: "Hari Bersama",
      current: daysTogether,
      max: 365,
      pct: Math.min(Math.round((daysTogether / 365) * 100), 100),
      multiplier: "",
    },
    {
      icon: "✨",
      label: "Wish list Tercapai",
      current: wishDone,
      max: Math.max(wishTotal, 1),
      pct: Math.round(wishProgress * 100),
      multiplier: "",
    },
  ];

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, ease: "easeOut" }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Heart className="h-4 w-4 fill-primary text-primary" />
          </div>
          <span className="text-base font-semibold">Love Meter</span>
        </div>
        <Sparkles className="h-4 w-4 text-primary/60" />
      </div>

      <div className="relative mx-auto flex items-center justify-center py-2 max-w-[190px] w-full">
        <svg viewBox="0 0 190 190" className="w-full h-auto -rotate-90">
          <defs>
            <linearGradient id="loveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F43F5E" />
              <stop offset="50%" stopColor="#6366F1" />
              <stop offset="100%" stopColor="#22C55E" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle
            cx="95"
            cy="95"
            r={radius}
            fill="none"
            stroke="oklch(0.92 0.006 355)"
            strokeWidth="10"
          />
          <motion.circle
            cx="95"
            cy="95"
            r={radius}
            fill="none"
            stroke="url(#loveGradient)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference}
            animate={{
              strokeDashoffset: offset,
              filter: isHovered ? "brightness(1.2)" : "brightness(1)",
            }}
            transition={{ duration: 2, ease: "easeOut" }}
            style={{ filter: `drop-shadow(0 0 8px ${color}40)` }}
          />

          {Array.from({ length: 8 }).map((_, i) => {
            const angle = (i / 8) * 360;
            const rad = (angle - 90) * (Math.PI / 180);
            const tickRadius = radius + 12;
            const x1 = 95 + radius * Math.cos(rad);
            const y1 = 95 + radius * Math.sin(rad);
            const x2 = 95 + tickRadius * Math.cos(rad);
            const y2 = 95 + tickRadius * Math.sin(rad);
            const isActive = (i / 8) * 100 <= displayPercent;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={isActive ? color : "oklch(0.85 0.01 355)"}
                strokeWidth="2"
                strokeLinecap="round"
                opacity={isActive ? 0.6 : 0.3}
              />
            );
          })}
        </svg>
        <div className="absolute flex flex-col items-center">
          <motion.span
            key={displayPercent}
            initial={{ scale: 1.4, opacity: 0.5 }}
            animate={{
              scale: isHovered ? [1, 1.05, 1] : 1,
              opacity: 1,
            }}
            transition={
              isHovered
                ? { duration: 0.6, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.3 }
            }
            className="font-heading text-2xl font-bold tabular-nums sm:text-4xl"
            style={{ color }}
          >
            {displayPercent}%
          </motion.span>
          <motion.span
            key={getLabel()}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-1 text-center text-xs font-semibold"
            style={{ color }}
          >
            {getLabel()}
          </motion.span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-xl bg-muted/40 px-3 py-2.5 text-center transition-colors hover:bg-muted/60 sm:px-4 sm:py-3">
          <span className="text-sm sm:text-base">📅</span>
          <p className="mt-1 text-sm font-bold text-foreground sm:text-base">{daysTogether}</p>
          <p className="text-xs text-muted-foreground sm:text-sm">Hari Bersama</p>
        </div>
        {quantityMetrics.map((m) => (
          <div
            key={m.key}
            className="rounded-xl bg-muted/40 px-3 py-2.5 text-center transition-colors hover:bg-muted/60 sm:px-4 sm:py-3"
          >
            <span className="text-sm sm:text-base">{m.icon}</span>
            <p className="mt-1 text-sm font-bold text-foreground sm:text-base">{m.value}</p>
            <p className="text-xs text-muted-foreground sm:text-sm">{m.label}</p>
          </div>
        ))}
        <div className="rounded-xl bg-muted/40 px-3 py-2.5 text-center transition-colors hover:bg-muted/60 sm:px-4 sm:py-3">
          <span className="text-sm sm:text-base">✨</span>
          <p className="mt-1 text-sm font-bold text-foreground sm:text-base">
            {wishDone}
          </p>
          <p className="text-xs text-muted-foreground sm:text-sm">Wish List Tercapai</p>
        </div>
      </div>

      <div className="mt-5 rounded-xl bg-muted/30 p-4">
        <div className="mb-3 flex items-center gap-1.5">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold text-foreground">
            Target berikutnya
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {tips.map((tip) => (
            <div
              key={tip.label}
              className="flex items-center gap-3 rounded-lg bg-background/60 px-3 py-2"
            >
              <span className="text-sm leading-none">{tip.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="truncate text-xs text-muted-foreground">{tip.label}</p>
                <div className="mt-1 h-1.5 rounded-full bg-muted-foreground/20">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${tip.pct}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
              </div>
              <div className="shrink-0 text-right">
                <span className="text-xs tabular-nums text-muted-foreground">
                  {tip.current}/{tip.max}
                </span>
                {tip.multiplier && (
                  <p className="text-[10px] text-muted-foreground/60">+{tip.multiplier}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
