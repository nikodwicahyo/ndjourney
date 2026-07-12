"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { Gamepad2, ChevronRight, Heart } from "lucide-react";
import { formatNumber } from "@/lib/utils";

type GamesPreviewProps = {
  questionCount: number;
  totalGamesPlayed: number;
};

function StatCard({
  value,
  label,
  delay,
}: {
  value: number;
  label: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      className="flex flex-1 flex-col items-center rounded-xl bg-card/80 px-3 py-3 shadow-sm overflow-hidden"
    >
      <span className="font-heading text-xl font-bold text-primary truncate">
        {formatNumber(value)}
      </span>
      <span className="mt-1 text-center text-[10px] leading-tight text-muted-foreground truncate">
        {label}
      </span>
    </motion.div>
  );
}

export default function GamesPreview({
  questionCount,
  totalGamesPlayed,
}: GamesPreviewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <Link
        href="/games"
        className="group relative block overflow-hidden rounded-3xl px-4"
      >
      <div className="rounded-2xl border border-border/60 bg-card/50 p-5 shadow-sm transition-shadow duration-300 group-hover:shadow-md overflow-hidden">
        <div className="flex items-center gap-2">
          <Gamepad2 className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-medium truncate">Fun Games</span>
        </div>

        {(questionCount > 0 || totalGamesPlayed > 0) ? (
          <div className="mt-4 flex gap-3">
            <StatCard value={questionCount} label="Pertanyaan" delay={0.1} />
            <StatCard value={totalGamesPlayed} label="Permainan" delay={0.2} />
          </div>
        ) : (
          <div className="mt-4 flex flex-col items-center gap-2 py-6">
            <Gamepad2 className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">Belum ada permainan</p>
          </div>
        )}

          <div className="mt-3 flex items-center justify-end gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
            <span>Main sekarang</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
