"use client";

import React, { useState } from "react";
import { getOptimizedImageUrl } from "@/lib/cloudinary-urls";
import { useToggleWish } from "@/hooks/useWishes";
import { motion } from "framer-motion";
import { Check, Pencil, ExternalLink, Heart, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { startMutationToast, settleMutationToast } from "@/lib/mutation-feedback";
import type { WishItem } from "@/types";
import CropBanner from "./CropBanner";
import WishDetailDialog from "./WishDetailDialog";
import { categoryConfig } from "./wish-categories";

type WishCardProps = {
  wish: WishItem;
  readOnly?: boolean;
  onEdit?: (wish: WishItem) => void;
};

// Deterministic per-sparkle jitter. Math.random() in render is impure
// (react-hooks/purity) and made the burst jump on every re-render.
function jitter(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function WishCard({ wish, readOnly = false, onEdit }: WishCardProps) {
  const toggleWish = useToggleWish();
  const [imgError, setImgError] = useState(false);
  const [open, setOpen] = useState(false);
  const cat = wish.category || "OTHER";
  const config = categoryConfig[cat] || categoryConfig.OTHER;
  const reduceMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  async function handleToggle() {
    if (toggleWish.isPending) return;

    const toastId = startMutationToast("Menyimpan status wish...");

    try {
      await toggleWish.mutateAsync({ id: wish.id, isDone: !wish.isDone });
      settleMutationToast(
        toastId,
        "success",
        wish.isDone ? "Wish ditandai belum selesai" : "Selamat! Wish tercapai!",
      );
    } catch {
      settleMutationToast(toastId, "error", "Gagal mengupdate wish");
    }
  }

  return (
    <>
    <div
      role="button"
      tabIndex={0}
      aria-label={`Lihat detail ${wish.title}`}
      onClick={() => setOpen(true)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpen(true);
        }
      }}
      className={cn(
        "group relative cursor-pointer rounded-2xl border p-4 transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-primary",
        wish.isDone
          ? "border-green-500/30 bg-green-500/[0.03]"
          : "border-border bg-card hover:scale-[1.02] hover:shadow-lg",
      )}
    >
      {wish.isDone && !reduceMotion && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl" aria-hidden="true">
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
                x: `${40 + jitter(i, 1) * 20}%`,
                y: `${10 + jitter(i, 2) * 30}%`,
                scale: [0, 1.5],
              }}
              transition={{
                duration: 0.8 + jitter(i, 3) * 0.4,
                delay: i * 0.08,
                ease: "easeOut",
              }}
              className="absolute"
            >
              <Sparkles
                className="h-4 w-4 text-yellow-400"
                aria-hidden="true"
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
            <h2
              className={cn(
                "text-sm font-medium leading-snug",
                wish.isDone && "text-muted-foreground line-through",
              )}
            >
              {wish.title}
            </h2>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: config.color + "1a",
                // Half category hue + half theme foreground: dark text on the
                // light tint, light text on the dark tint, so the label keeps
                // its colour coding without dropping under AA in either theme.
                color: `color-mix(in oklab, ${config.color} 55%, var(--foreground))`,
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

          {/* transformed variant (not the multi-MB original) — the raw
              original hung /_next/image past its timeout and 500d every card. */}
          {wish.imageUrl && !imgError && (
            <CropBanner
              src={getOptimizedImageUrl(wish.imageUrl, 640)}
              crop={(wish as { imageCrop?: unknown }).imageCrop}
              alt={wish.title}
              onError={() => setImgError(true)}
            />
          )}

          <div className="mt-2 flex items-center gap-3">
            {wish.link && (
              <a
                href={wish.link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                Link
              </a>
            )}
          </div>
        </div>

        {!readOnly && (
          <div className="flex shrink-0 items-center gap-1">
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(wish);
                }}
                className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary"
                aria-label="Ubah wish"
              >
                <Pencil className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggle();
              }}
              disabled={toggleWish.isPending}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full border-2 transition-all",
                wish.isDone
                  ? "scale-110 border-green-500 bg-green-500 text-white"
                  : "border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary",
                toggleWish.isPending && "scale-90",
              )}
              aria-label={wish.isDone ? "Tandai belum selesai" : "Tandai selesai"}
            >
              <motion.div
                key={String(wish.isDone)}
                initial={wish.isDone ? { scale: 0, rotate: -90 } : { scale: 1, rotate: 0 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 15 }}
              >
                <Check className="h-5 w-5" aria-hidden="true" />
              </motion.div>
            </button>
          </div>
        )}
      </div>

      {wish.isDone && wish.doneAt && (
        <div
          className="relative mt-3 flex items-center gap-1.5 border-t border-green-500/20 pt-3 text-xs text-green-600 dark:text-green-400"
        >
          <Heart className="h-3 w-3 fill-current" aria-hidden="true" />
          <span>Tercapai!</span>
        </div>
      )}
    </div>

    {/* Dialog renders OUTSIDE the clickable card so modal clicks never
        re-trigger the card; when closed it renders null. */}
    <WishDetailDialog wish={wish} open={open} onOpenChange={setOpen} readOnly={readOnly} />
    </>
  );
}

export default React.memo(WishCard);
