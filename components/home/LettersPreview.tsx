"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { MessageCircleHeart, ChevronRight } from "lucide-react";
import { formatNumber } from "@/lib/utils";

type LettersPreviewProps = {
  totalCount: number;
};

export default function LettersPreview({ totalCount }: LettersPreviewProps) {
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
        href="/letters"
        className="group relative block overflow-hidden rounded-3xl px-4"
      >
        <div className="rounded-2xl border border-pink-300/20 bg-gradient-to-br from-pink-50/[0.06] to-rose-500/[0.03] p-5 shadow-sm transition-shadow duration-300 group-hover:shadow-md">
          <div className="flex items-center gap-2">
            <MessageCircleHeart className="h-4 w-4 text-pink-500" />
            <span className="text-sm font-medium">Love Letters</span>
          </div>

          {totalCount > 0 ? (
            <div className="mt-4 flex items-center justify-center gap-3">
              <div className="relative">
                <motion.div
                  initial={{ rotate: -6, y: -4 }}
                  animate={{ rotate: -6, y: -4 }}
                  className="h-14 w-11 rounded-lg border border-pink-200/40 bg-gradient-to-b from-pink-100/30 to-pink-200/20 shadow-sm"
                />
                <motion.div
                  initial={{ rotate: 2, y: -8 }}
                  animate={{ rotate: 2, y: -8 }}
                  className="absolute inset-0 h-14 w-11 rounded-lg border border-pink-200/50 bg-gradient-to-b from-pink-100/40 to-pink-200/30 shadow-sm"
                />
                <motion.div
                  initial={{ rotate: 0, y: -12 }}
                  animate={{ rotate: 0, y: -12 }}
                  className="absolute inset-0 flex items-center justify-center rounded-lg border border-pink-200/60 bg-gradient-to-b from-pink-100/50 to-pink-200/40 shadow-sm"
                >
                  <MessageCircleHeart className="h-5 w-5 text-pink-500/70" />
                </motion.div>
              </div>
              <div>
                <span className="font-heading text-2xl font-bold text-primary">
                  {formatNumber(totalCount)}
                </span>
                <p className="text-xs text-muted-foreground">surat terkirim</p>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-col items-center gap-2 py-6">
              <MessageCircleHeart className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">Belum ada surat</p>
            </div>
          )}

          <div className="mt-3 flex items-center justify-end gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
            <span>Buka surat</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
