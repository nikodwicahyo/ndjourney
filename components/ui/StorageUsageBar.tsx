"use client";

import { cn, formatBytes } from "@/lib/utils";
import { HardDrive } from "lucide-react";

type Props = {
  used: number;
  limit: number;
  resourcesCount?: number;
  className?: string;
  compact?: boolean;
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
  className,
  compact = false,
}: Props) {
  const ratio = limit > 0 ? used / limit : 0;
  const percent = limit > 0 ? Math.min(Math.round(ratio * 10000) / 100, 100) : 0;
  const threshold = getThreshold(ratio);

  const avgFileSize = resourcesCount > 0 ? used / resourcesCount : 0;
  const remainingBytes = limit > 0 ? Math.max(0, limit - used) : 0;
  const estimatedRemainingFiles =
    limit > 0 && avgFileSize > 0 ? Math.floor(remainingBytes / avgFileSize) : 0;

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
      <div className="mb-3 flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: "#6366F1" + "15" }}
        >
          <HardDrive className="h-5 w-5" style={{ color: "#6366F1" }} />
        </div>
        <div>
          <p className="font-heading text-sm font-semibold">Penyimpanan Terpakai</p>
          <p className="text-xs text-muted-foreground">
            {formatBytes(used)}
            {limit > 0 ? ` / ${formatBytes(limit)}` : ""}
          </p>
        </div>
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

          {resourcesCount > 0 && estimatedRemainingFiles > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Estimasi bisa untuk ~{estimatedRemainingFiles.toLocaleString("id-ID")} file lagi.
            </p>
          )}
        </>
      )}
    </div>
  );
}
