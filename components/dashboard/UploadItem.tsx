"use client";

import { useState, useEffect, useRef, memo } from "react";
import { cn } from "@/lib/utils";
import { Loader2, CheckCircle, AlertCircle, X, FileVideo, RotateCcw, Trash, Clock, Image as ImageIcon } from "lucide-react";
import { formatBytes, formatTime } from "@/lib/upload-config";
import type { UploadFileItem } from "@/components/dashboard/GalleryManager";

interface UploadItemProps {
  item: UploadFileItem;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
  isUploading: boolean;
}

const statusIcons = {
  pending: <Clock className="h-4 w-4 text-muted-foreground" />,
  uploading: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
  complete: <CheckCircle className="h-4 w-4 text-green-500" />,
  error: <AlertCircle className="h-4 w-4 text-destructive" />,
  cancelled: <X className="h-4 w-4 text-muted-foreground" />,
} as const;

const statusColors = {
  pending: "bg-muted border-border",
  uploading: "bg-primary/5 border-primary/30",
  complete: "bg-green-500/5 border-green-500/30",
  error: "bg-destructive/5 border-destructive/30",
  cancelled: "bg-muted border-border opacity-50",
} as const;

// Reusable action button component
function ActionButton({
  onClick,
  children,
  disabled = false,
  variant = "default",
  "aria-label": ariaLabel,
}: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  variant?: "default" | "destructive";
  "aria-label": string;
}) {
  const baseStyles = "p-1.5 rounded-lg transition-all duration-150 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 disabled:cursor-not-allowed";
  
  const variants = {
    default: "bg-transparent hover:bg-accent text-muted-foreground hover:text-foreground",
    destructive: "bg-transparent hover:bg-destructive/10 text-destructive hover:text-destructive/80",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(baseStyles, variants[variant])}
      aria-label={ariaLabel}
      aria-disabled={disabled}
    >
      {children}
    </button>
  );
}

function UploadItemInner({ item, onCancel, onRetry, onRemove, isUploading }: UploadItemProps) {
  const isImage = item.file.type.startsWith("image/");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hasError, setHasError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Create IntersectionObserver on the container element which is always mounted
  useEffect(() => {
    if (!isImage) {
      setPreviewUrl(null);
      setIsVisible(false);
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

  const percent = Math.round(item.progress.percent);
  const showCancel = item.status === "uploading";
  const showRetry = (item.status === "error" || item.status === "cancelled") && !isUploading;
  const showRemove = !isUploading;

  const isUploadingItem = item.status === "uploading";
  const isCompleted = item.status === "complete";

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex items-center gap-3 rounded-lg border p-2 transition-all duration-150",
        statusColors[item.status],
        isUploadingItem && "ring-1 ring-primary/20",
        isCompleted && "ring-1 ring-green-500/20"
      )}
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
        {isImage && previewUrl ? (
          <img
            src={previewUrl}
            alt={item.file.name}
            className="h-full w-full object-cover"
            decoding="async"
          />
        ) : isImage && isVisible && !hasError ? (
          <ImageIcon className="h-5 w-5 text-muted-foreground/50 animate-pulse" />
        ) : hasError ? (
          <AlertCircle className="h-5 w-5 text-destructive/50" />
        ) : (
          <FileVideo className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
        <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{item.file.name}</span>
          <span className="shrink-0 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono tabular-nums">{formatBytes(item.file.size)}</span>
          {statusIcons[item.status]}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${percent}%` } as React.CSSProperties}
            />
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap font-mono tabular-nums">
            {percent}%
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <span className="tabular-nums">{formatBytes(item.progress.loaded)} / {formatBytes(item.progress.total)}</span>
          {item.progress.speed > 0 && (
            <>
              <span>·</span>
              <span>{formatBytes(item.progress.speed)}/s</span>
            </>
          )}
          {item.progress.eta > 0 && (
            <>
              <span>·</span>
              <span>ETA: {formatTime(item.progress.eta)}</span>
            </>
          )}
        </div>
        {item.error && (
          <p className="text-xs text-destructive mt-1 truncate" title={item.error}>
            {item.error.includes("timeout") || item.error.includes("habis") ? "Waktu habis, coba lagi" :
             item.error.includes("network") || item.error.includes("Network") || item.error.includes("Failed to fetch") || item.error.includes("Koneksi") ? "Koneksi terputus" :
             item.error.includes("limit") || item.error.includes("exceeds") || item.error.includes("terlalu besar") || item.error.includes("melebihi") ? "Ukuran file terlalu besar" :
             item.error}
          </p>
        )}
      </div>
      
      {/* Action Buttons */}
      <div className="flex items-center gap-1">
        {showCancel && (
          <ActionButton
            onClick={() => onCancel(item.id)}
            disabled={!isUploading}
            variant="default"
            aria-label="Cancel upload"
          >
            <X className="h-4 w-4" />
          </ActionButton>
        )}
        {showRetry && (
          <ActionButton
            onClick={() => onRetry(item.id)}
            disabled={isUploading}
            variant="default"
            aria-label="Retry upload"
          >
            <RotateCcw className="h-4 w-4" />
          </ActionButton>
        )}
        {showRemove && (
          <ActionButton
            onClick={() => onRemove(item.id)}
            disabled={isUploading}
            variant="destructive"
            aria-label="Remove file"
          >
            <Trash className="h-4 w-4" />
          </ActionButton>
        )}
      </div>
    </div>
  );
}

const UploadItem = memo(UploadItemInner);
UploadItem.displayName = "UploadItem";

export default UploadItem;