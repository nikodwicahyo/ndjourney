"use client";

import React, { useRef } from "react";
import Image from "next/image";
import { motion, useInView } from "framer-motion";
import { MapPin, Edit3, Trash2, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { showDeleteConfirm } from "@/lib/swal";
import type { MilestoneWithRelations } from "@/hooks/useMilestones";

type MilestoneCardProps = {
  milestone: MilestoneWithRelations;
  isAuthenticated?: boolean;
  index: number;
  onEdit?: (milestone: MilestoneWithRelations) => void;
  onDelete?: (id: string) => void;
  onPhotoClick?: (url: string) => void;
};

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
            isLeft ? "md:text-right" : "md:text-left",
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

            <div className="flex items-stretch gap-3">
              <div
                className={cn(
                  "min-w-0 flex-1 flex-col flex",
                  isLeft ? "md:items-end" : "md:items-start",
                )}
              >
                <div
                  className={cn(
                    "mb-2 flex items-center gap-2",
                    isLeft ? "md:flex-row-reverse" : "md:flex-row",
                  )}
                >
                  <span className="text-xl">{milestone.icon || "💕"}</span>
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
                  <div
                    className={cn(
                      "mt-2 flex items-center gap-1.5 text-xs text-muted-foreground",
                      isLeft ? "md:flex-row-reverse" : "md:flex-row",
                    )}
                  >
                    <MapPin className="h-3 w-3 shrink-0" />
                    {milestone.location}
                  </div>
                )}

                <div
                  className={cn(
                    "mt-3 flex items-center gap-2 text-xs text-muted-foreground",
                    isLeft ? "md:flex-row-reverse" : "md:flex-row",
                  )}
                >
                  <Heart className="h-3 w-3 shrink-0" />
                  <span>
                    {milestone.createdBy.name || "Pasangan"}
                  </span>
                </div>
              </div>

              {milestone.photos?.length > 0 && (
                <div
                  className={cn(
                    "shrink-0 self-stretch flex flex-col gap-2 min-h-0",
                    isLeft && "md:order-first",
                  )}
                  style={{ width: "min(130px, 35vw)" }}
                >
                  {milestone.photos.slice(0, 3).map(({ photo }) => (
                    <button
                      key={photo.id}
                      onClick={() => onPhotoClick?.(photo.url)}
                      className="relative flex-1 min-h-0 overflow-hidden rounded-lg"
                    >
                      <Image
                        src={photo.thumbnailUrl || photo.url}
                        alt=""
                        fill
                        sizes="130px"
                        className="object-cover transition-transform hover:scale-110"
                      />
                    </button>
                  ))}
                  {milestone.photos.length > 3 && (
                    <div className="flex flex-1 min-h-0 items-center justify-center rounded-lg bg-muted">
                      <span className="text-xs text-muted-foreground">
                        +{milestone.photos.length - 3}
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
            {milestone.icon || "💕"}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default React.memo(MilestoneCard);
