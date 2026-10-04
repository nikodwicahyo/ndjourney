"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, useInView } from "framer-motion";
import { MapPin, Edit3, Trash2, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { showDeleteConfirm } from "@/lib/swal";
import type { MilestoneWithRelations } from "@/hooks/useMilestones";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui";
import { cropCoverStyle, cropDisplaySrc, parseCropRect } from "@/lib/image-crop";
import { getOptimizedImageUrl } from "@/lib/cloudinary-urls";

type MilestoneCardProps = {
  milestone: MilestoneWithRelations;
  isAuthenticated?: boolean;
  index: number;
  onEdit?: (milestone: MilestoneWithRelations) => void;
  onDelete?: (id: string) => void;
  onPhotoClick?: (url: string) => void;
};

// ponytail: thumb renders through the link crop with the same math as the
// cropper — null crop falls back to plain object-cover. src = ORIGINAL url
// (rects are original-space), thumb = square center-fill for the no-crop case.
function CropThumb({ src, thumb, crop, eager }: { src: string; thumb?: string | null; crop: unknown; eager?: boolean }) {
  const rect = parseCropRect(crop);
  // ponytail: Cloudinary variant of the original (aspect-preserving → crop
  // fractions stay exact). Raw originals hang /_next/image past its 7s timeout
  // (500) and HEIC never decodes in the browser — same rule as WishCard.
  const url = getOptimizedImageUrl(cropDisplaySrc(src, thumb, rect), 640);
  const ref = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState<{ w: number; h: number } | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setFrame({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { setNatural(null); }, [url]);

  const onLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    }
  };

  const style = rect && natural && frame
    ? cropCoverStyle(natural.w, natural.h, frame.w, frame.h, rect)
    : null;

  return (
    <div ref={ref} className="absolute inset-0">
      {style ? (
        <Image
          src={url}
          alt=""
          width={Math.round(style.width)}
          height={Math.round(style.height)}
          onLoad={onLoad}
          className="absolute max-w-none transition-transform hover:scale-110"
          style={{ left: style.left, top: style.top }}
          sizes="130px"
          loading={eager ? "eager" : "lazy"}
        />
      ) : (
        <Image
          src={url}
          alt=""
          fill
          onLoad={onLoad}
          sizes="130px"
          loading={eager ? "eager" : "lazy"}
          className="object-cover transition-transform hover:scale-110"
        />
      )}
    </div>
  );
}

function MilestoneCard({
  milestone,
  isAuthenticated,
  index,
  onEdit,
  onDelete,
  onPhotoClick,
}: MilestoneCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  const isLeft = index % 2 === 0;
  const cardColor = milestone.color || "#F43F5E";
  // ponytail: the first ~3 cards sit in the first viewport — their photos must
  // load eagerly or the browser reports them as a deferred LCP image.
  // Raise the bound if a viewport ever fits more cards.
  const eager = index < 3;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.08, ease: "easeOut" }}
      className="relative"
    >
      <div
        className={cn(
          "flex items-start gap-4 md:gap-8",
          isLeft ? "md:flex-row" : "md:flex-row-reverse",
        )}
      >
        <div
          className={cn(
            "flex-1",
            isLeft ? "md:text-left" : "md:text-justify",
          )}
        >
          <div
            className={cn(
              "relative rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-lg",
            )}
          >
            <div
              className="absolute top-0 left-0 h-1 w-full rounded-t-2xl"
              style={{ backgroundColor: cardColor }}
            />

            <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
              <div className={cn("min-w-0 flex-1 flex-col flex md:items-start", !isLeft && "text-justify")}>                <div className="mb-2 flex items-center gap-2 md:flex-row">
                  <span className="flex items-center text-xl">{milestone.icon || <Heart className="h-5 w-5 fill-primary text-primary" />}</span>
                  <time className="text-xs text-muted-foreground">
                    {formatDate(milestone.date)}
                  </time>
                </div>

                <h3 className="font-heading text-lg font-semibold">
                  {milestone.title}
                </h3>

                {milestone.description && (
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {milestone.description}
                  </p>
                )}

                {milestone.location && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground md:flex-row">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span>{milestone.location}</span>
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground md:flex-row"> 
                  <Heart className="h-3 w-3 shrink-0" />
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={milestone.createdBy.image ?? undefined} alt={milestone.createdBy.name ?? "Author"} />
                    <AvatarFallback>{milestone.createdBy.name?.charAt(0) || "P"}</AvatarFallback>
                  </Avatar>
                  <span>
                    {milestone.createdBy.name || "Pasangan"}
                  </span>
                  
                </div>
              </div>

              {milestone.photos?.length > 0 && (
                <div className="grid w-full grid-cols-2 content-center gap-2 md:w-[min(260px,32vw)] md:shrink-0">
                  {/* ponytail: fixed 1:1 grid = same box as the cropper and form thumbs — crop is pixel-exact for 1 or 2 photos. */}
                  {milestone.photos.slice(0, 2).map(({ photo, crop }) => (
                    <button
                      key={photo.id}
                      onClick={() => onPhotoClick?.(photo.url)}
                      className={cn(
                        "relative aspect-square overflow-hidden rounded-lg",
                        milestone.photos.length === 1 && "col-start-2",
                      )}
                    >
                      <CropThumb src={photo.url} thumb={photo.thumbnailUrl} crop={crop} eager={eager} />
                    </button>
                  ))}
                  {milestone.photos.length > 2 && (
                    <div className="flex aspect-square items-center justify-center rounded-lg bg-muted">
                      <span className="text-xs text-muted-foreground">
                        +{milestone.photos.length - 2}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {isAuthenticated && (
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => onEdit?.(milestone)}
                    className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    aria-label="Edit milestone"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={async () => {
                      const confirmed = await showDeleteConfirm({
                        title: "Hapus Milestone",
                        text: `Apakah Anda yakin ingin menghapus "${milestone.title}"?`,
                      });
                      if (confirmed) onDelete?.(milestone.id);
                    }}
                    className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Delete milestone"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="relative hidden shrink-0 md:block">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full border-4 border-background text-lg shadow-sm"
            style={{
              backgroundColor: cardColor + "20",
              borderColor: cardColor,
            }}
          >
            {milestone.icon || <Heart className="h-5 w-5 fill-primary text-primary" />}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default React.memo(MilestoneCard);
