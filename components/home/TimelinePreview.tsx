"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { CalendarDays, Heart, ChevronRight } from "lucide-react";
import { formatDate, formatNumber } from "@/lib/utils";

type TimelinePreviewProps = {
  milestoneCount: number;
  latestMilestones: Array<{ id: string; title: string; icon: string | null; color: string | null; date: Date }>;
};

export default function TimelinePreview({
  milestoneCount,
  latestMilestones,
}: TimelinePreviewProps) {
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
        href="/timeline"
        className="group relative block overflow-hidden rounded-3xl px-4"
      >
        <div className="rounded-2xl border border-border/60 bg-card/50 p-5 shadow-sm transition-shadow duration-300 group-hover:shadow-md">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Timeline</span>
            <span className="text-xs text-muted-foreground">
              {formatNumber(milestoneCount)} kenangan
            </span>
          </div>

          {latestMilestones.length > 0 && (
            <div className="relative mt-4 pl-6">
              <div className="absolute bottom-1 left-[9px] top-1 w-px bg-gradient-to-b from-primary/30 via-primary/20 to-transparent" />

              {latestMilestones.map((m, i) => (
                <div key={m.id} className="relative mb-4 last:mb-0">
                  <div className="absolute -left-[22px] top-1 flex h-4 w-4 items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-primary/60" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{m.icon ?? "💕"}</span>
                      <p className="truncate text-sm font-medium">{m.title}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDate(m.date)}
                    </p>
                  </div>

                  {i === 0 && (
                    <div className="absolute -right-1 top-0 opacity-0 transition-opacity group-hover:opacity-100">
                      <Heart className="h-3 w-3 fill-primary/40 text-primary/40" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {latestMilestones.length === 0 && (
            <div className="mt-4 flex flex-col items-center gap-2 py-6">
              <CalendarDays className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">Belum ada kenangan</p>
            </div>
          )}

          <div className="mt-3 flex items-center justify-end gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
            <span>Lihat timeline</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
