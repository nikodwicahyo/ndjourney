"use client";

import { useDashboardStats, useCoupleConfig } from "@/hooks/useDashboard";
import { Skeleton } from "@/components/ui";
import {
  Images,
  Video,
  MessageCircleHeart,
  Flag,
  Heart,
  Cake,
  HardDrive,
  PartyPopper,
} from "lucide-react";
import { formatNumber, formatBytes } from "@/lib/utils";
import { motion } from "framer-motion";
import { useMemo } from "react";

export default function StatsCards() {
  const { data: stats, isLoading: statsLoading, error, refetch } = useDashboardStats();
  const { data: config, isLoading: configLoading } = useCoupleConfig();

  const statConfig = useMemo(() => {
    const items = [
      {
        key: "daysSinceAnniversary" as const,
        label: "Hari Bersama",
        icon: Heart,
        color: "#F43F5E",
        bgColor: "#F43F5E",
      },
      {
        key: "daysUntilBirthday1" as const,
        label: `Hari lagi Ultah ${config?.name1 || "1"}`,
        icon: Cake,
        color: "#EAB308",
        bgColor: "#EAB308",
      },
      {
        key: "daysUntilBirthday2" as const,
        label: `Hari lagi Ultah ${config?.name2 || "2"}`,
        icon: Cake,
        color: "#EAB308",
        bgColor: "#EAB308",
      },
      {
        key: "photoCount" as const,
        label: "Foto",
        icon: Images,
        color: "#6366F1",
        bgColor: "#6366F1",
      },
      {
        key: "videoCount" as const,
        label: "Video",
        icon: Video,
        color: "#22C55E",
        bgColor: "#22C55E",
      },
      {
        key: "letterCount" as const,
        label: "Surat",
        icon: MessageCircleHeart,
        color: "#EC4899",
        bgColor: "#EC4899",
      },
      {
        key: "milestoneCount" as const,
        label: "Timeline",
        icon: Flag,
        color: "#F97316",
        bgColor: "#F97316",
      },
      {
        key: "storageUsed" as const,
        label: "Penyimpanan",
        icon: HardDrive,
        color: "#6366F1",
        bgColor: "#6366F1",
      },
    ];

    return items.filter((item) => {
      if (item.key === "daysUntilBirthday1" && !config?.birthDate1) return false;
      if (item.key === "daysUntilBirthday2" && !config?.birthDate2) return false;
      return true;
    });
  }, [config]);

  if (statsLoading || configLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Gagal memuat statistik
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-3 inline-flex min-h-[44px] items-center rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {statConfig.map(({ key, label, icon: Icon, color, bgColor }, i) => {
        const value = stats[key];
        const isBirthday =
          key === "daysUntilBirthday1" || key === "daysUntilBirthday2";
        const isStorage = key === "storageUsed";
        const isLetter = key === "letterCount";

        const storagePercent = isStorage && stats.storageLimit > 0
          ? Math.min(Math.round(((stats.storageUsed / stats.storageLimit) * 100) * 100) / 100, 100)
          : -1;

        // "1.1/25.0GB" — single unit when both share it, else "900MB/25.0GB".
        const [usedVal, usedUnit] = formatBytes(stats.storageUsed).split(" ");
        const [limitVal, limitUnit] = formatBytes(stats.storageLimit).split(" ");
        const storageCompact =
          usedUnit === limitUnit
            ? `${usedVal}/${limitVal}${usedUnit}`
            : `${usedVal}${usedUnit}/${limitVal}${limitUnit}`;

        return (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className="rounded-2xl border border-border bg-card p-4 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg overflow-hidden"
          >
            <div
              className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl shrink-0"
              style={{
                backgroundColor: bgColor + "15",
              }}
            >
              <Icon
                className="h-4 w-4 shrink-0"
                style={{ color }}
                aria-hidden="true"
              />
            </div>
            <p className="font-heading text-xl font-bold truncate">
              {isBirthday
                ? value === 0
                  ? <PartyPopper className="h-5 w-5 text-amber-500" aria-hidden="true" />
                  : `${value}`
                : isStorage
                  ? storagePercent >= 0
                    ? storagePercent === 0 || storagePercent >= 1
                      ? `${Math.round(storagePercent)}%`
                      : `${storagePercent.toFixed(2)}%`
                    : formatNumber(value)
                  : formatNumber(value)}
            </p>
            {!isStorage && (
              <p className="mt-0.5 text-xs text-muted-foreground truncate">{label}</p>
            )}
            {isLetter && stats.unreadLetterCount > 0 && (
              <p className="text-xs text-muted-foreground truncate">
                {stats.unreadLetterCount} belum dibaca
              </p>
            )}
            {isStorage && (
              <>
                {stats.storageLimit > 0 && (
                  <p className="mt-0.5 flex items-center justify-between gap-2 whitespace-nowrap text-xs text-muted-foreground">
                    <span className="truncate">{label}</span>
                    <span className="shrink-0 font-medium text-foreground">{storageCompact}</span>
                  </p>
                )}
                {storagePercent >= 0 && (
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${storagePercent}%`,
                        backgroundColor: storagePercent > 90 ? "#EF4444" : storagePercent > 70 ? "#EAB308" : "#22C55E",
                      }}
                    />
                  </div>
                )}
              </>
            )}
            {isBirthday && value > 0 && (
              <p className="text-xs text-muted-foreground">
                
              </p>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
