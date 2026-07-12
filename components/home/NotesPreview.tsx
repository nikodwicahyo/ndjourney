"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { StickyNote, ChevronRight, Heart } from "lucide-react";
import { truncate, formatNumber } from "@/lib/utils";

type NotesPreviewProps = {
  noteCount: number;
  latestNote: { content: string; authorName: string } | null;
};

export default function NotesPreview({ noteCount, latestNote }: NotesPreviewProps) {
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
        href="/notes"
        className="group relative block overflow-hidden rounded-3xl px-4"
      >
        <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.06] to-primary/[0.02] p-5 shadow-sm transition-shadow duration-300 group-hover:shadow-md overflow-hidden">
          <div className="flex items-center gap-2">
            <StickyNote className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-sm font-medium truncate">Daily Note</span>
            <span className="text-xs text-muted-foreground">
              {formatNumber(noteCount)} catatan
            </span>
          </div>

          {latestNote ? (
            <div className="relative mt-4 rounded-xl bg-card/80 px-4 py-3 shadow-sm overflow-hidden">
              <div className="absolute -top-2 left-6 h-4 w-4 rotate-45 bg-card/80" />
              <p className="text-sm leading-relaxed text-muted-foreground italic break-words">
                &ldquo;{truncate(latestNote.content, 150)}&rdquo;
              </p>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Heart className="h-3 w-3 shrink-0 fill-primary/40 text-primary/40" />
                <span className="truncate">{latestNote.authorName}</span>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-col items-center gap-2 py-6">
              <StickyNote className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">Belum ada catatan</p>
            </div>
          )}

          <div className="mt-3 flex items-center justify-end gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
            <span>Lihat catatan</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
