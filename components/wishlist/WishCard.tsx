"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useToggleWish } from "@/hooks/useWishes";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Pencil, ExternalLink, Heart, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { WishItem } from "@/types";

const categoryConfig: Record<string, { label: string; color: string }> = {
  DATE_IDEAS: { label: "Date Ideas", color: "#F43F5E" },
  GIFTS: { label: "Gifts", color: "#6366F1" },
  TRAVEL: { label: "Travel", color: "#22C55E" },
  OTHER: { label: "Lainnya", color: "#F97316" },
};

type WishCardProps = {
  wish: WishItem;
  readOnly?: boolean;
  onEdit?: (wish: WishItem) => void;
};

function WishCard({ wish, readOnly = false, onEdit }: WishCardProps) {
  const toggleWish = useToggleWish();
  const [animating, setAnimating] = useState(false);
  const cat = wish.category || "OTHER";
  const config = categoryConfig[cat] || categoryConfig.OTHER;

  async function handleToggle() {
    if (animating) return;
    setAnimating(true);

    try {
      await toggleWish.mutateAsync({ id: wish.id, isDone: !wish.isDone });
      toast.success(
        wish.isDone
          ? "Wish ditandai belum selesai"
          : "Selamat! Wish tercapai! 🎉",
      );
    } catch {
      toast.error("Gagal mengupdate wish");
    } finally {
      setTimeout(() => setAnimating(false), 600);
    }
  }

  return (
    <div
      className={cn(
        "group relative rounded-2xl border p-4 transition-all duration-300",
        wish.isDone
          ? "border-green-500/30 bg-green-500/[0.03]"
          : "border-border bg-card hover:scale-[1.02] hover:shadow-lg",
      )}
    >
      {wish.isDone && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{
                opacity: 1,
                x: "50%",
                y: "50%",
                scale: 0,
              }}
              animate={{
                opacity: [1, 0],
                x: `${40 + Math.random() * 20}%`,
                y: `${10 + Math.random() * 30}%`,
                scale: [0, 1.5],
              }}
              transition={{
                duration: 0.8 + Math.random() * 0.4,
                delay: i * 0.08,
                ease: "easeOut",
              }}
              className="absolute"
            >
              <Sparkles
                className="h-4 w-4 text-yellow-400"
                style={{
                  filter: "drop-shadow(0 0 2px rgba(250,204,21,0.5))",
                }}
              />
            </motion.div>
          ))}
        </div>
      )}

      <div className="relative flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3
              className={cn(
                "text-sm font-medium leading-snug",
                wish.isDone && "text-muted-foreground line-through",
              )}
            >
              {wish.title}
            </h3>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: config.color + "1a",
                color: config.color,
              }}
            >
              {config.label}
            </span>
          </div>

          {wish.description && (
            <p
              className={cn(
                "mt-1 text-xs leading-relaxed text-muted-foreground",
                wish.isDone && "line-through opacity-60",
              )}
            >
              {wish.description}
            </p>
          )}

          {wish.imageUrl && (
            <div className="relative mt-2 h-24 w-full overflow-hidden rounded-xl">
              <Image
                src={wish.imageUrl}
                alt={wish.title}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover"
              />
            </div>
          )}

          <div className="mt-2 flex items-center gap-3">
            {wish.link && (
              <a
                href={wish.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Link
              </a>
            )}
          </div>
        </div>

        {!readOnly && (
          <div className="flex shrink-0 items-center gap-1">
            {onEdit && (
              <button
                onClick={() => onEdit(wish)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary"
                aria-label="Edit wish"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={handleToggle}
              disabled={animating}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all",
                wish.isDone
                  ? "scale-110 border-green-500 bg-green-500 text-white"
                  : "border-muted-foreground/30 hover:border-primary",
                animating && "scale-90",
              )}
              aria-label={wish.isDone ? "Tandai belum selesai" : "Tandai selesai"}
            >
              <motion.div
                key={String(wish.isDone)}
                initial={wish.isDone ? { scale: 0, rotate: -90 } : { scale: 1, rotate: 0 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
              >
                {wish.isDone ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <span className="block h-2 w-2 rounded-full bg-muted-foreground/30" />
                )}
              </motion.div>
            </button>
          </div>
        )}
      </div>

      {wish.isDone && wish.doneAt && (
        <div
          className="relative mt-3 flex items-center gap-1.5 border-t border-green-500/20 pt-3 text-xs text-green-600 dark:text-green-400"
        >
          <Heart className="h-3 w-3 fill-current" />
          <span>Tercapai! ❤️</span>
        </div>
      )}
    </div>
  );
}

export default React.memo(WishCard);
