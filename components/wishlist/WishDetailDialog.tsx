"use client";

import React, { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import FullscreenImage from "@/components/ui/FullscreenImage";
import { Button } from "@/components/ui";
import { getOptimizedImageUrl } from "@/lib/cloudinary-urls";
import { useToggleWish } from "@/hooks/useWishes";
import { Check, ExternalLink, Heart, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { startMutationToast, settleMutationToast } from "@/lib/mutation-feedback";
import type { WishItem } from "@/types";
import CropBanner from "./CropBanner";
import { categoryConfig } from "./wish-categories";

type WishDetailDialogProps = {
  wish: WishItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readOnly?: boolean;
};

function WishDetailDialog({ wish, open, onOpenChange, readOnly = false }: WishDetailDialogProps) {
  const toggleWish = useToggleWish();
  const [imgError, setImgError] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const bannerRef = useRef<HTMLButtonElement>(null);
  const cat = wish.category || "OTHER";
  const config = categoryConfig[cat] || categoryConfig.OTHER;

  // Drop the zoomed photo whenever the dialog closes so reopening lands on
  // the banner, not a stale full-screen view. Render-time adjustment
  // (React-endorsed), not a post-paint effect.
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open && zoomed) setZoomed(false);
  }

  // Overlay open → Escape/backdrop dismiss the overlay first, not the modal.
  // Both paths return focus to the banner (the overlay X unmounts and the
  // modal is hidden from assistive tech underneath).
  const closeZoom = () => {
    setZoomed(false);
    bannerRef.current?.focus();
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && zoomed) {
      closeZoom();
      return;
    }
    onOpenChange(next);
  };

  const closeModal = () => {
    setZoomed(false);
    onOpenChange(false);
  };

  // Same optimistic toast flow as WishCard — the wish list is the same data.
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        aria-hidden={zoomed || undefined}
        className="max-w-xl p-4 pt-12 sm:p-6 sm:pt-6"
      >
        <button
          onClick={closeModal}
          aria-label="Tutup"
          className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <DialogHeader className="text-left">
          <div className="mb-2 flex items-center gap-2 pr-12">
            <span
              className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium"
              style={{
                backgroundColor: config.color + "1a",
                // Half category hue + half theme foreground: keeps the label
                // colour-coded without dropping under AA in either theme.
                color: `color-mix(in oklab, ${config.color} 55%, var(--foreground))`,
              }}
            >
              {config.label}
            </span>
          </div>
          <DialogTitle
            className={cn(
              "font-heading text-2xl leading-snug",
              wish.isDone && "text-muted-foreground line-through",
            )}
          >
            {wish.title}
          </DialogTitle>
        </DialogHeader>

        {wish.description && (
          <p
            className={cn(
              "mt-3 text-sm leading-relaxed text-muted-foreground",
              wish.isDone && "line-through opacity-60",
            )}
          >
            {wish.description}
          </p>
        )}

        {wish.imageUrl && !imgError && (
          // The button sits on top of the banner (never wrapping it): a card
          // body inside <button> is invalid HTML, and this keeps the cropped
          // preview untouched.
          <div className="relative">
            <CropBanner
              src={getOptimizedImageUrl(wish.imageUrl, 1024)}
              crop={(wish as { imageCrop?: unknown }).imageCrop}
              alt={wish.title}
              sizes="(max-width: 768px) 100vw, 640px"
              onError={() => setImgError(true)}
            />
            <button
              ref={bannerRef}
              type="button"
              onClick={() => setZoomed(true)}
              aria-label={`Lihat gambar penuh ${wish.title}`}
              aria-haspopup="dialog"
              className="absolute inset-0 z-10 cursor-zoom-in rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>Dibuat {formatDate(wish.createdAt)}</span>
          {wish.link && (
            <a
              href={wish.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Buka link
            </a>
          )}
        </div>

        {wish.isDone && wish.doneAt ? (
          <div className="mt-3 flex items-center gap-1.5 border-t border-green-500/20 pt-3 text-sm text-green-600 dark:text-green-400">
            <Heart className="h-4 w-4 fill-current" aria-hidden="true" />
            <span>Tercapai pada {formatDate(wish.doneAt)}</span>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-1.5 border-t border-border pt-3 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span>Belum tercapai</span>
          </div>
        )}

        {!readOnly && (
          <div className="mt-4 flex justify-end">
            <Button
              variant={wish.isDone ? "outline" : "default"}
              onClick={handleToggle}
              disabled={toggleWish.isPending}
              className="gap-2"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              {wish.isDone ? "Tandai belum selesai" : "Tandai selesai"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
    {zoomed && wish.imageUrl && !imgError && (
      <FullscreenImage
        src={getOptimizedImageUrl(wish.imageUrl, 1920)}
        alt={wish.title}
        onClose={closeZoom}
      />
    )}
    </>
  );
}

export default React.memo(WishDetailDialog);
