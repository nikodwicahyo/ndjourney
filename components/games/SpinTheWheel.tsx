"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useAllQuestions } from "@/hooks/useGames";
import { Button, Skeleton } from "@/components/ui";
import { motion } from "framer-motion";
import { Heart, RotateCcw, RefreshCw } from "lucide-react";

const MAX_WHEEL_SEGMENTS = 15;
const SPIN_DURATION_MS = 3800;

const COLORS = [
  "#F43F5E",
  "#D946EF",
  "#EC4899",
  "#A855F7",
  "#FB7185",
  "#C084FC",
  "#F472B6",
  "#E11D48",
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function SpinTheWheel() {
  const { data: ideas, isLoading, error, refetch } = useAllQuestions("SPIN_THE_WHEEL");
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [resetCount, setResetCount] = useState(0);

  const spinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allExhausted = useMemo(() => {
    if (!ideas || ideas.length === 0) return false;
    return seenIds.size >= ideas.length;
  }, [ideas, seenIds]);

  const segments = useMemo(() => {
    if (!ideas || ideas.length === 0) return [];
    const unseen = ideas.filter(q => !seenIds.has(q.id));
    if (unseen.length === 0) return [];
    const count = Math.min(unseen.length, MAX_WHEEL_SEGMENTS);
    return shuffle(unseen).slice(0, count);
  }, [ideas, seenIds]);

  const segmentAngle = segments.length > 0 ? 360 / segments.length : 0;
  const isManySegments = segments.length > 12;
  const fontSize = isManySegments ? "text-[10px]" : "text-xs";
  const labelMaxWidth = isManySegments ? "50px" : "65px";
  const labelTruncateLen = isManySegments ? 10 : 14;

  const spin = useCallback(() => {
    if (spinning || segments.length === 0) return;
    setSpinning(true);
    setResult(null);

    const extraSpins = 4 + Math.floor(Math.random() * 4);
    const targetSegment = Math.floor(Math.random() * segments.length);
    const offset = Math.random() * segmentAngle;
    const r = (90 - targetSegment * segmentAngle - offset + 360) % 360;
    const newRotation = rotation - (rotation % 360) + extraSpins * 360 + r;

    setRotation(newRotation);

    spinTimeoutRef.current = setTimeout(() => {
      const idea = segments[targetSegment];
      setResult(idea.question);
      setHistory(prev => [idea.question, ...prev].slice(0, 10));
      setSeenIds(prev => new Set(prev).add(idea.id));
      setSpinning(false);
    }, SPIN_DURATION_MS);
  }, [spinning, segments, segmentAngle, rotation]);

  const resetAll = useCallback(() => {
    setSeenIds(new Set());
    setHistory([]);
    setResetCount(n => n + 1);
    setResult(null);
    setRotation(0);
  }, []);

  useEffect(() => {
    return () => {
      if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Skeleton className="h-64 w-64 rounded-full" />
      </div>
    );
  }

  if (error || !ideas || ideas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <p className="text-muted-foreground">Belum ada ide kencan</p>
        <Button onClick={() => refetch()}>Muat Ulang</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-8">
      <div className="relative">
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-background shadow-lg">
            <Heart className="h-6 w-6 fill-primary text-primary" />
          </div>
        </div>

        <div
          className="absolute top-1/2 right-0 z-10 h-5 w-5 -translate-y-1/2 translate-x-2 rotate-45 border-r-2 border-t-2 border-primary bg-background"
          style={{ clipPath: "polygon(0 0, 100% 100%, 0 100%)" }}
        />

        <motion.div
          className="relative h-64 w-64 rounded-full border-4 border-border shadow-xl"
          style={{
            background: `conic-gradient(${segments
              .map(
                (_, i) =>
                  `${COLORS[i % COLORS.length]} ${i * segmentAngle}deg ${(i + 1) * segmentAngle}deg`,
              )
              .join(", ")})`,
          }}
          initial={{ rotate: 0 }}
          animate={{ rotate: rotation }}
          transition={{ duration: 3.8, ease: [0.17, 0.67, 0.12, 0.99] }}
        >
          {segments.map((idea, i) => {
            const midAngle = i * segmentAngle + segmentAngle / 2;
            const rad = (midAngle * Math.PI) / 180;
            const radius = 95;
            const cx = 128;
            const cy = 128;
            const x = cx + radius * Math.cos(rad - Math.PI / 2);
            const y = cy + radius * Math.sin(rad - Math.PI / 2);

            return (
              <div
                key={idea.id}
                className={`absolute font-semibold leading-tight text-white ${fontSize}`}
                style={{
                  left: `${x}px`,
                  top: `${y}px`,
                  transform: "translate(-50%, -50%)",
                  textShadow: "0 1px 3px rgba(0,0,0,0.4)",
                  maxWidth: labelMaxWidth,
                  textAlign: "center",
                  width: labelMaxWidth,
                }}
              >
                {idea.question.length > labelTruncateLen
                  ? idea.question.slice(0, labelTruncateLen) + ".."
                  : idea.question}
              </div>
            );
          })}
        </motion.div>
      </div>

      {allExhausted ? (
        <Button size="lg" onClick={resetAll} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Kocok Ulang Semua 🎲
        </Button>
      ) : (
        <Button
          size="lg"
          onClick={spin}
          disabled={spinning || segments.length === 0}
          className="gap-2"
        >
          {spinning ? (
            "Memutar..."
          ) : (
            <>
              <RotateCcw className="h-4 w-4" />
              Putar Roda
            </>
          )}
        </Button>
      )}

      {segments.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Sisa {ideas.length - seenIds.size} dari {ideas.length} ide kencan
        </p>
      )}

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full rounded-2xl border-2 border-primary/30 bg-primary/5 p-6 text-center"
        >
          <p className="text-xs text-muted-foreground">Hasil:</p>
          <p className="mt-1 font-heading text-lg font-semibold">{result} 🎉</p>
        </motion.div>
      )}

      {history.length > 0 && (
        <div className="w-full space-y-2 rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Riwayat
          </p>
          {history.map((h, i) => (
            <p key={`${h}-${i}`} className="text-sm text-muted-foreground">
              {i + 1}. {h}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
