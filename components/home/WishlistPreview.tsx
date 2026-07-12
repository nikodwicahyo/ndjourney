"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { Gift, ChevronRight, Heart } from "lucide-react";
import { formatNumber } from "@/lib/utils";

type WishlistPreviewProps = {
  total: number;
  done: number;
};

export default function WishlistPreview({ total, done }: WishlistPreviewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  const heartCount = 8;
  const filledHearts = Math.round((progress / 100) * heartCount);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <Link
        href="/wishlist"
        className="group relative block overflow-hidden rounded-3xl px-4"
      >
        <div className="rounded-2xl border border-yellow-400/20 bg-gradient-to-br from-yellow-50/[0.06] to-yellow-500/[0.03] p-5 shadow-sm transition-shadow duration-300 group-hover:shadow-md overflow-hidden">
          <div className="flex items-center gap-2">
            <Gift className="h-4 w-4 shrink-0 text-yellow-500" />
            <span className="text-sm font-medium truncate">Wish List</span>
            <span className="text-xs text-muted-foreground">
              {formatNumber(done)}/{formatNumber(total)} tercapai
            </span>
          </div>

          {total > 0 ? (
            <div className="mt-4 space-y-3">
              <div className="flex justify-center gap-1">
                {Array.from({ length: heartCount }).map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.1 + i * 0.06, ease: "easeOut" }}
                  >
                    <Heart
                      className={`h-4 w-4 ${
                        i < filledHearts
                          ? "fill-yellow-400 text-yellow-400"
                          : "fill-muted text-muted"
                      }`}
                    />
                  </motion.div>
                ))}
              </div>
              <div className="text-center text-xs text-muted-foreground">
                {progress}% terkabulkan
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-col items-center gap-2 py-6">
              <Gift className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">Belum ada wish</p>
            </div>
          )}

          <div className="mt-3 flex items-center justify-end gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
            <span>Lihat wish list</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
