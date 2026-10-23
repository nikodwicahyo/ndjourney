"use client";

/* eslint-disable @next/next/no-img-element -- canvas data URL thumbnail; next/image cannot optimize data URLs */

import { useState, useEffect, useRef, memo } from "react";
import { cn } from "@/lib/utils";
import { Loader2, CheckCircle, AlertCircle, X, FileVideo, RotateCcw, Trash, Clock, Image as ImageIcon, WifiOff, Pause, Play } from "lucide-react";
import { formatBytes, formatTime, resolveUploadMime } from "@/lib/upload-config";
import type { UploadFileItem } from "@/components/dashboard/GalleryManager";

interface UploadItemProps {
  item: UploadFileItem;
  onRetry: (id: string) => void;
  onPause: (id: string) => void;
  onRemove: (id: string) => void;
  isUploading: boolean;
}

const statusIcons = {
  pending: <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />,
  uploading: <Loader2 className="h-4 w-4 text-primary motion-safe:animate-spin" aria-hidden="true" />,
  retrying: <Loader2 className="h-4 w-4 text-amber-600 motion-safe:animate-spin" aria-hidden="true" />,
  complete: <CheckCircle className="h-4 w-4 text-emerald-600" aria-hidden="true" />,
  error: <AlertCircle className="h-4 w-4 text-destructive" aria-hidden="true" />,
  interrupted: <WifiOff className="h-4 w-4 text-destructive" aria-hidden="true" />,
  cancelled: <X className="h-4 w-4 text-muted-foreground" aria-hidden="true" />,
  paused: <Pause className="h-4 w-4 text-amber-600" aria-hidden="true" />,
} as const;

// Human-readable status chip — colour alone (and an icon) is not enough for
// colour-blind users or a glance on a small phone screen.
const statusChip = {
  pending: { label: "Menunggu", className: "bg-muted text-muted-foreground" },
  uploading: { label: "Mengunggah", className: "bg-primary/10 text-primary" },
  retrying: { label: "Mencoba ulang", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  complete: { label: "Selesai", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  error: { label: "Gagal", className: "bg-destructive/10 text-destructive" },
  interrupted: { label: "Terhenti", className: "bg-destructive/10 text-destructive" },
  cancelled: { label: "Dibatalkan", className: "bg-muted text-muted-foreground" },
  paused: { label: "Dijeda", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
} as const;

const statusColors = {
  pending: "bg-muted/30 border-border",
  uploading: "bg-primary/5 border-primary/30",
  retrying: "bg-amber-500/5 border-amber-500/30",
  complete: "bg-emerald-500/5 border-emerald-500/30",
  error: "bg-destructive/5 border-destructive/30",
  interrupted: "bg-destructive/5 border-destructive/30",
  cancelled: "bg-muted/30 border-border opacity-60",
  paused: "bg-amber-500/5 border-amber-500/30",
} as const;

/** One-line, user-facing reason for a failed upload. */
function errorText(item: UploadFileItem): string {
  if (item.status === "interrupted") return "Upload terhenti — tekan Lanjutkan untuk melanjutkan.";
  const err = item.error ?? "";
  if (/timeout|habis/i.test(err)) return "Waktu habis — coba lagi.";
  if (/network|koneksi|terputus|failed to fetch/i.test(err)) return "Koneksi terputus — coba lagi.";
  if (/limit|exceeds|melebihi|terlalu besar/i.test(err)) return "Ukuran file melebihi batas.";
  return err || "Upload gagal.";
}

function ActionButton({
  onClick,
  children,
  "aria-label": ariaLabel,
}: {
  onClick: () => void;
  children: React.ReactNode;
  "aria-label": string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg p-2.5 text-destructive transition-colors duration-150 hover:bg-destructive/10 hover:text-destructive/80 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}

function UploadItemInner({ item, onRetry, onPause, onRemove, isUploading }: UploadItemProps) {
  const isImage = resolveUploadMime(item.file.name, item.file.type).startsWith("image/");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hasError, setHasError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Reset preview state when the file changes — render-time adjustment
  // (React-endorsed), not a post-paint effect, so no cascading render.
  const [prevFile, setPrevFile] = useState(item.file);
  if (prevFile !== item.file) {
    setPrevFile(item.file);
    setPreviewUrl(null);
    setIsVisible(false);
  }

  // Create IntersectionObserver on the container element which is always mounted
  useEffect(() => {
    if (!isImage) {
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observerRef.current?.disconnect();
          }
        });
      },
      { rootMargin: "100px", threshold: 0.01 }
    );

    observerRef.current.observe(container);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [isImage]);

  // Create optimized low-resolution thumbnail when container is visible
  useEffect(() => {
    if (!isVisible || !isImage) return;

    let active = true;

    const reader = new FileReader();
    reader.onload = (e) => {
      if (!active) return;
      const img = new Image();
      img.onload = () => {
        if (!active) return;
        const canvas = document.createElement("canvas");
        const maxDim = 80;
        let w = img.width;
        let h = img.height;

        if (w > h) {
          if (w > maxDim) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          }
        } else {
          if (h > maxDim) {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          setPreviewUrl(canvas.toDataURL("image/jpeg", 0.75));
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(item.file);

    return () => {
      active = false;
    };
  }, [isVisible, isImage, item.file]);

  const percent = Math.max(0, Math.min(100, Math.round(item.progress.percent)));
  const isUploadingItem = item.status === "uploading" || item.status === "retrying";
  const isCompleted = item.status === "complete";
  const isPaused = item.status === "paused";
  const isInterrupted = item.status === "interrupted";
  // While a pause is settling we keep uploading the current chunk (so its bytes
  // commit) — the chip must say so instead of looking stuck on "Mengunggah".
  const pausing = !!item.pausing;

  // Pause while transferring.
  const canPause = isUploadingItem && !pausing;
  // Resume/retry a stopped item. A mid-batch failure only becomes retryable once
  // the batch settles; a paused item is resumable immediately.
  const canRetry =
    (item.status === "error" || item.status === "cancelled" || item.status === "interrupted" || isPaused) &&
    (isPaused || !isUploading);
  const retryLabel = isPaused || item.resumed ? "Lanjutkan" : "Coba lagi";
  const retryAria = isPaused
    ? `Lanjutkan upload ${item.file.name}`
    : item.resumed
      ? `Lanjutkan upload ${item.file.name}`
      : `Coba lagi upload ${item.file.name}`;
  const showRemove = !isUploading || isPaused;

  const chip = statusChip[item.status];

  return (
    <div
      ref={containerRef}
      className={cn(
        "rounded-xl border p-2.5 transition-colors duration-200 motion-safe:transition-colors sm:p-3",
        statusColors[item.status],
        isUploadingItem && "ring-1 ring-primary/20",
        isCompleted && "ring-1 ring-emerald-500/20"
      )}
    >
      <div className="flex items-start gap-2.5 sm:gap-3">
        {/* Thumbnail */}
        <div className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted sm:h-12 sm:w-12">
          {isImage && previewUrl ? (
            <img
              src={previewUrl}
              alt=""
              className="h-full w-full object-cover"
              decoding="async"
            />
          ) : isImage && isVisible && !hasError ? (
            <ImageIcon className="h-5 w-5 text-muted-foreground/50 motion-safe:animate-pulse" aria-hidden="true" />
          ) : hasError ? (
            <AlertCircle className="h-5 w-5 text-destructive/50" aria-hidden="true" />
          ) : (
            <FileVideo className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          )}
          {isCompleted && (
            <span className="absolute inset-0 flex items-center justify-center bg-emerald-600/80">
              <CheckCircle className="h-5 w-5 text-white" aria-hidden="true" />
            </span>
          )}
        </div>

        {/* Details */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={item.file.name}>
            {item.file.name}
          </p>

          {/* Progress */}
          <div className="mt-1.5 flex items-center gap-2">
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-label={`Progres upload ${item.file.name}`}
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
            >
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-300 ease-out",
                  isCompleted ? "bg-emerald-600" : item.status === "error" || isInterrupted ? "bg-destructive" : isPaused ? "bg-amber-500" : "bg-primary"
                )}
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="w-9 shrink-0 text-right text-[11px] font-mono tabular-nums text-muted-foreground">
              {percent}%
            </span>
          </div>

          {/* Status + meta line */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
                pausing
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : chip.className
              )}
            >
              {pausing ? statusIcons.retrying : statusIcons[item.status]}
              {pausing ? "Menjeda…" : chip.label}
            </span>

            {(isUploadingItem || isPaused) ? (
              <>
                <span className="tabular-nums">
                  {formatBytes(item.progress.loaded)} / {formatBytes(item.progress.total)}
                </span>
                {item.progress.speed > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{formatBytes(item.progress.speed)}/s</span>
                  </>
                )}
                {item.progress.eta > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">ETA {formatTime(item.progress.eta)}</span>
                  </>
                )}
              </>
            ) : (
              <span className="tabular-nums">{formatBytes(item.file.size)}</span>
            )}
          </div>

          {item.resumed && isUploadingItem && (
            <p className="mt-1 text-[11px] font-medium text-primary">
              Melanjutkan unggahan yang tertunda…
            </p>
          )}

          {pausing && (
            <p className="mt-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
              Menyelesaikan bagian terakhir agar progres tidak hilang…
            </p>
          )}

          {isPaused && (
            <p className="mt-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
              Dijeda - tekan Lanjutkan untuk melanjutkan dari progres terakhir.
            </p>
          )}

          {item.status === "retrying" && (
            <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
              Mengulang otomatis — progres tidak hilang.
            </p>
          )}

          {item.error && item.status !== "retrying" && (
            <p className="mt-1 text-[11px] text-destructive" title={item.error}>
              {errorText(item)}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-0.5">
          {canPause && (
            <button
              type="button"
              onClick={() => onPause(item.id)}
              className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors duration-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Jeda upload ${item.file.name}`}
            >
              <Pause className="h-3.5 w-3.5" aria-hidden="true" />
              Jeda
            </button>
          )}
          {canRetry && (
            <button
              type="button"
              onClick={() => onRetry(item.id)}
              className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full border border-primary/40 bg-primary/5 px-3 text-xs font-medium text-primary transition-colors duration-150 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={retryAria}
            >
              {isPaused ? (
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {retryLabel}
            </button>
          )}
          {showRemove && (
            <ActionButton
              onClick={() => onRemove(item.id)}
              aria-label="Hapus file dari antrian"
            >
              <Trash className="h-4 w-4" aria-hidden="true" />
            </ActionButton>
          )}
        </div>
      </div>
    </div>
  );
}

const UploadItem = memo(UploadItemInner);
UploadItem.displayName = "UploadItem";

export default UploadItem;
