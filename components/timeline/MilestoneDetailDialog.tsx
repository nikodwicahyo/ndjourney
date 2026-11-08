"use client";

import React, { useState } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback, Button, Separator } from "@/components/ui";
import { MapPin, Edit3, Trash2, Heart, X } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { showDeleteConfirm } from "@/lib/swal";
import { getOptimizedImageUrl } from "@/lib/cloudinary-urls";
import type { MilestoneWithRelations } from "@/hooks/useMilestones";
import CropThumb from "./CropThumb";

type MilestoneDetailDialogProps = {
  milestone: MilestoneWithRelations;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAuthenticated?: boolean;
  onEdit?: (milestone: MilestoneWithRelations) => void;
  onDelete?: (id: string) => void;
  /** True while the delete mutation is in flight — gates the confirm button. */
  isDeleting?: boolean;
};

function MilestoneDetailDialog({
  milestone,
  open,
  onOpenChange,
  isAuthenticated,
  onEdit,
  onDelete,
  isDeleting,
}: MilestoneDetailDialogProps) {
  const [zoomedId, setZoomedId] = useState<string | null>(null);
  const cardColor = milestone.color || "var(--primary)";
  const zoomed = milestone.photos?.find(({ photo }) => photo.id === zoomedId) ?? null;

  // Drop the zoomed photo whenever the dialog closes (or the milestone goes
  // away) so reopening lands on the grid, not a stale full-screen view.
  // Render-time adjustment (React-endorsed), not a post-paint effect.
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open && zoomedId !== null) setZoomedId(null);
  }

  // While the full-screen photo overlay is open, Escape/backdrop/close
  // dismiss the overlay first — not the whole modal underneath it.
  const handleOpenChange = (next: boolean) => {
    if (!next && zoomedId) {
      setZoomedId(null);
      return;
    }
    onOpenChange(next);
  };

  const overlay = zoomed ? (
    <div
      onClick={() => setZoomedId(null)}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90"
    >
      <button
        onClick={() => setZoomedId(null)}
        autoFocus
        aria-label="Tutup foto"
        style={{
          top: "max(1rem, env(safe-area-inset-top))",
          right: "max(1rem, env(safe-area-inset-right))",
        }}
        className="absolute flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
      >
        <X className="h-6 w-6" aria-hidden="true" />
      </button>
      <div className="relative h-full w-full">
        <Image
          src={getOptimizedImageUrl(zoomed.photo.url, 1920)}
          alt={zoomed.photo.caption || milestone.title}
          fill
          priority
          sizes="100vw"
          className="object-contain p-2 sm:p-8"
        />
      </div>
      {zoomed.photo.caption && (
        <p
          className="pointer-events-none absolute inset-x-0 px-6 text-center text-sm text-white/80"
          style={{ bottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
        >
          {zoomed.photo.caption}
        </p>
      )}
    </div>
  ) : null;

  // Portal escapes DialogContent's transform — a transformed ancestor would
  // otherwise trap the `fixed inset-0` overlay inside the modal rectangle.
  const portaledOverlay = overlay && typeof document !== "undefined"
    ? createPortal(overlay, document.body)
    : null;

  return (
    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl p-4 pt-10 sm:p-6">
        <div
          className="absolute top-0 left-0 h-1 w-full rounded-t-2xl"
          style={{ backgroundColor: cardColor }}
          aria-hidden="true"
        />
        <button
          onClick={() => handleOpenChange(false)}
          aria-label="Tutup"
          className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <div>
            <DialogHeader className="mb-0 text-left">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex items-center text-2xl">
                  {milestone.icon || <Heart className="h-6 w-6 fill-primary text-primary" aria-hidden="true" />}
                </span>
                <time className="text-xs text-muted-foreground">
                  {formatDate(milestone.date)}
                </time>
              </div>
              <DialogTitle className="pr-12 font-heading text-2xl">
                {milestone.title}
              </DialogTitle>
            </DialogHeader>

            {milestone.description && (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {milestone.description}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              {milestone.location && (
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {milestone.location}
                </span>
              )}
              <span className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={milestone.createdBy.image ?? undefined} alt={milestone.createdBy.name ?? "Author"} />
                  <AvatarFallback>{milestone.createdBy.name?.charAt(0) || "P"}</AvatarFallback>
                </Avatar>
                {milestone.createdBy.name || "Pasangan"}
              </span>
            </div>

            {milestone.photos?.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {milestone.photos.map(({ photo, crop }) => (
                  <button
                    key={photo.id}
                    onClick={() => setZoomedId(photo.id)}
                    aria-label={`Lihat foto penuh ${milestone.title}`}
                    className="relative aspect-square overflow-hidden rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <CropThumb
                      src={photo.url}
                      thumb={photo.thumbnailUrl}
                      crop={crop}
                      sizes="(max-width: 768px) 33vw, 200px"
                      alt={photo.caption || milestone.title}
                    />
                  </button>
                ))}
              </div>
            )}

            {isAuthenticated && (onEdit || onDelete) && (
              <>
                <Separator className="my-4" />
                <div className="flex justify-end gap-2">
                  {onEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        onOpenChange(false);
                        onEdit(milestone);
                      }}
                    >
                      <Edit3 className="h-4 w-4" aria-hidden="true" />
                      Ubah
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="gap-2"
                      disabled={isDeleting}
                      onClick={async () => {
                        const confirmed = await showDeleteConfirm({
                          title: "Hapus Milestone",
                          text: `Apakah Anda yakin ingin menghapus "${milestone.title}"?`,
                        });
                        if (confirmed) {
                          onOpenChange(false);
                          onDelete(milestone.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Hapus
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
      </DialogContent>
    </Dialog>
      {portaledOverlay}
    </>
  );
}

export default React.memo(MilestoneDetailDialog);
