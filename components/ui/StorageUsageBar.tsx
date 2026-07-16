"use client";

import { cn, formatBytes } from "@/lib/utils";
import { HardDrive, RefreshCw, Image, Video, File } from "lucide-react";

type Props = {
  used: number;
  limit: number;
  resourcesCount?: number;
  imagesCount?: number;
  videosCount?: number;
  rawCount?: number;
  imagesBytes?: number;
  videosBytes?: number;
  rawBytes?: number;
  className?: string;
  compact?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
};

const STORAGE_THRESHOLDS = [
  { max: 0.7, color: "bg-green-500", label: "Aman" },
  { max: 0.9, color: "bg-yellow-500", label: "Menuju Penuh" },
  { max: 1, color: "bg-red-500", label: "Hampir Penuh" },
] as const;

function getThreshold(ratio: number) {
  if (ratio <= 0.7) return STORAGE_THRESHOLDS[0];
  if (ratio <= 0.9) return STORAGE_THRESHOLDS[1];
  return STORAGE_THRESHOLDS[2];
}

export default function StorageUsageBar({
  used,
  limit,
  resourcesCount = 0,
  imagesCount,
  videosCount,
  rawCount,
  imagesBytes,
  videosBytes,
  rawBytes,
  className,
  compact = false,
  onRefresh,
  isRefreshing,
}: Props) {
  const ratio = limit > 0 ? used / limit : 0;
  const percent = limit > 0 ? Math.min(Math.round(ratio * 10000) / 100, 100) : 0;
  const threshold = getThreshold(ratio);

  const avgFileSize = resourcesCount > 0 ? used / resourcesCount : 0;
  const remainingBytes = limit > 0 ? Math.max(0, limit - used) : 0;
  const estimatedRemainingFiles =
    limit > 0 && avgFileSize > 0 ? Math.floor(remainingBytes / avgFileSize) : 0;

  const friendlyEstimate =
    estimatedRemainingFiles >= 1000
      ? `${Math.round(estimatedRemainingFiles / 100) * 100}`
      : `${estimatedRemainingFiles}`;
  const avgLabel =
    avgFileSize > 0 ? `${formatBytes(Math.round(avgFileSize))} per file` : "";

  if (compact) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <HardDrive className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="flex-1">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Penyimpanan</span>
            <span className="font-medium text-xs">
              {formatBytes(used)}
              {limit > 0 && <> / {formatBytes(limit)}</>}
            </span>
          </div>
          {limit > 0 && (
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full transition-all duration-500", threshold.color)}
                style={{ width: `${percent}%` }}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-5",
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: "#6366F1" + "15" }}
          >
            <HardDrive className="h-5 w-5" style={{ color: "#6366F1" }} />
          </div>
          <div className="min-w-0">
            <p className="font-heading text-sm font-semibold">Penyimpanan Terpakai</p>
            <p className="text-xs text-muted-foreground">
              {formatBytes(used)}
              {limit > 0 ? ` dari ${formatBytes(limit)}` : ""}
            </p>
          </div>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
            {isRefreshing ? "Memuat..." : "Refresh"}
          </button>
        )}
      </div>

      {limit > 0 && (
        <>
          <div className="mb-2 h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all duration-500", threshold.color)}
              style={{ width: `${percent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {percent === 0 || percent >= 1 ? `${Math.round(percent)}` : percent.toFixed(2)}% terpakai
            </span>
            <span className="font-medium text-muted-foreground">
              {formatBytes(remainingBytes)} tersisa
            </span>
          </div>

          {(imagesBytes !== undefined || videosBytes !== undefined || rawBytes !== undefined) && (
            <div className="mt-3 space-y-1.5 border-t border-border pt-3">
              <p className="text-xs font-medium text-muted-foreground">Rincian Penyimpanan:</p>
              {imagesBytes !== undefined && (
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Image className="h-3.5 w-3.5" />
                    Foto
                    {imagesCount !== undefined && (
                      <span className="text-muted-foreground/70">({imagesCount.toLocaleString("id-ID")})</span>
                    )}
                  </span>
                  <span className="font-medium">{formatBytes(imagesBytes)}</span>
                </div>
              )}
              {videosBytes !== undefined && (
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Video className="h-3.5 w-3.5" />
                    Video
                    {videosCount !== undefined && (
                      <span className="text-muted-foreground/70">({videosCount.toLocaleString("id-ID")})</span>
                    )}
                  </span>
                  <span className="font-medium">{formatBytes(videosBytes)}</span>
                </div>
              )}
              {rawBytes !== undefined && (
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <File className="h-3.5 w-3.5" />
                    Raw
                    {rawCount !== undefined && (
                      <span className="text-muted-foreground/70">({rawCount.toLocaleString("id-ID")})</span>
                    )}
                  </span>
                  <span className="font-medium">{formatBytes(rawBytes)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-border/50 pt-1.5 text-xs">
                <span className="font-medium text-foreground">Total</span>
                <span className="font-medium">{formatBytes(used)}</span>
              </div>
            </div>
          )}

          {resourcesCount > 0 && estimatedRemainingFiles > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Sisa ruang cukup untuk sekitar <span className="font-medium text-foreground">{friendlyEstimate}</span> file lagi{avgLabel ? ` (${avgLabel})` : ""}.
            </p>
          )}
        </>
      )}
    </div>
  );
}
