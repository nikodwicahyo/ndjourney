"use client";

import { useRef, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { ImageIcon, ChevronRight, Video } from "lucide-react";
import { formatNumber, isVideoUrl } from "@/lib/utils";

type GalleryPreviewProps = {
  photoCount: number;
  videoCount: number;
  latestPhotos: Array<{ url: string; caption: string | null }>;
};

export default function GalleryPreview({
  photoCount,
  videoCount,
  latestPhotos,
}: GalleryPreviewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const hasPhotos = latestPhotos.length > 0;
  const displayCount = Math.min(latestPhotos.length, 3);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <Link
        href="/gallery"
        className="group relative block overflow-hidden rounded-3xl px-4"
      >
        {hasPhotos ? (
          <div className="relative overflow-hidden rounded-2xl">
            <div className="relative aspect-[16/9]">
              {isVideoUrl(latestPhotos[0].url) ? (
                <video
                  src={latestPhotos[0].url}
                  muted
                  playsInline
                  className="h-full w-full object-cover"
                />
              ) : (
                <Image
                  src={latestPhotos[0].url}
                  alt={latestPhotos[0].caption ?? "Gallery"}
                  fill
                  sizes="(max-width: 768px) 100vw, 512px"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
              )}
              {isVideoUrl(latestPhotos[0].url) && (
                <div className="absolute top-3 right-3 rounded-full bg-black/60 p-1.5">
                  <Video className="h-4 w-4 text-white" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent" />
            </div>

            <div className="relative flex gap-2 px-3 pb-3 -mt-8 sm:-mt-12">
              {latestPhotos.slice(1, displayCount + 1).map((photo, i) => (
                <div key={i} className="relative h-16 w-1/3 overflow-hidden rounded-xl shadow-lg sm:h-20">
                  {isVideoUrl(photo.url) ? (
                    <div className="relative h-full w-full">
                      <video
                        src={photo.url}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <Video className="h-5 w-5 text-white" />
                      </div>
                    </div>
                  ) : (
                    <Image
                      src={photo.url}
                      alt={photo.caption ?? ""}
                      fill
                      sizes="33vw"
                      className="object-cover"
                    />
                  )}
                </div>
              ))}

              {photoCount > displayCount && (
                <div className="relative flex h-16 w-1/3 items-center justify-center overflow-hidden rounded-xl bg-black/60 shadow-lg backdrop-blur-sm sm:h-20">
                  <span className="text-sm font-semibold text-white">
                    +{formatNumber(photoCount - displayCount)}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16">
            <ImageIcon className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Belum ada foto</p>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">Gallery</span>
            <span className="text-xs text-muted-foreground">
              {formatNumber(photoCount)} foto{ videoCount > 0 ? ` · ${formatNumber(videoCount)} video` : ""}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
            <span>Lihat gallery</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
