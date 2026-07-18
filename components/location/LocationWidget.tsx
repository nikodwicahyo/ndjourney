"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { MapPin, Loader2, Clock } from "lucide-react";
import { Card, Avatar, AvatarImage, AvatarFallback } from "@/components/ui";
import {
  useLocationSettings,
  useDistance,
  useIsMeeting,
  useShareLocation,
  useFloatingHearts,
} from "@/hooks/useLocation";
import DeviceBadge from "./DeviceBadge";
import FloatingHeart from "./FloatingHeart";
import { formatDistance, formatDistanceCategory } from "@/lib/geo";

function timeAgo(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 30) return "baru saja";
  if (seconds < 120) return `${seconds} detik lalu`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} mnt lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} jam lalu`;
  return `${Math.floor(hrs / 24)} hari lalu`;
}

export default function LocationWidget() {
  const { status: sessionStatus } = useSession();
  const { data, isLoading } = useLocationSettings();
  const distance = useDistance(data);
  const meeting = useIsMeeting(data);
  const { heart, clearHeart } = useFloatingHearts(data?.coupleId);
  useShareLocation(data?.self.isSharing ?? false);

  if (sessionStatus !== "authenticated") return null;

  if (isLoading) {
    return (
      <Card className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memuat lokasi…
        </div>
      </Card>
    );
  }

  if (!data) return null;

  const { self, partner } = data;

  if (!partner.isSharing) {
    return (
      <Card className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 shrink-0 text-primary" />
          <span>
            {partner.name} belum membagikan lokasi. Nyalakan berbagi di menu
            Location untuk saling melihat. 💕
          </span>
        </div>
      </Card>
    );
  }

  const bothSharing = self.isSharing && partner.isSharing;
  const partnerHasLoc = !!partner.location;
  const selfLive = self.isSharing && !self.isStale;
  const partnerLive = partner.isSharing && !partner.isStale;
  const selfInitial = (self.name ?? "K").charAt(0).toUpperCase();
  const partnerInitial = partner.name.charAt(0).toUpperCase();

  return (
    <Card className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
      <FloatingHeart event={heart} onDone={clearHeart} />

      {/* Header */}
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-pink-500" />
          <span className="text-sm font-semibold text-foreground">Jarak Antar Kita</span>
        </div>
      </div>

      {/* Category */}
      {distance !== null && bothSharing && (
        <p className="mt-1 text-xs text-muted-foreground justify-center text-center">
          {formatDistanceCategory(distance)}
        </p>
      )}

      {/* Person avatars row */}
      <div className="mt-4 flex items-center justify-around">
        {/* Self avatar */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="relative">
            <Avatar className="h-10 w-10 ring-2 ring-primary/20 shadow-sm">
              <AvatarImage src={self.image ?? undefined} />
              <AvatarFallback className="text-sm font-medium">{selfInitial}</AvatarFallback>
            </Avatar>
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${
                selfLive ? "bg-emerald-500" : "bg-muted-foreground/50"
              }`}
            />
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <p className="max-w-[72px] truncate text-[12px] font-medium leading-tight text-foreground">
              {self.name ?? "Kamu"}
            </p>
            <div className="flex items-center gap-1">
              {self.deviceType && <DeviceBadge deviceType={self.deviceType} />}
              <span
                className={`text-[10px] ${
                  selfLive ? "text-emerald-500" : "text-muted-foreground"
                }`}
              >
                {selfLive ? "Live" : self.isSharing ? "Stale" : "Off"}
              </span>
            </div>
            {self.isSharing && (
              <span className="text-[10px] text-muted-foreground">
                {timeAgo(self.locationAgeSeconds)}
              </span>
            )}
          </div>
        </div>

        {/* Distance */}
        <div className="flex flex-col items-center gap-0.5">
          <span className="font-heading text-xl font-bold tabular-nums text-foreground">
            {distance !== null ? formatDistance(distance) : "—"}
          </span>
          {bothSharing && (
            <span className="flex items-center gap-1 text-[12px] text-emerald-500">
              <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-500" />
              live
            </span>
          )}
        </div>

        {/* Partner avatar */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="relative">
            <Avatar className="h-10 w-10 ring-2 ring-primary/20 shadow-sm">
              <AvatarImage src={partner.image ?? undefined} />
              <AvatarFallback className="text-sm font-medium">{partnerInitial}</AvatarFallback>
            </Avatar>
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${
                partnerLive ? "bg-emerald-500" : "bg-muted-foreground/50"
              }`}
            />
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <p className="max-w-[72px] truncate text-[12px] font-medium leading-tight text-foreground">
              {partner.name}
            </p>
            <div className="flex items-center gap-1">
              {partner.deviceType && <DeviceBadge deviceType={partner.deviceType} />}
              <span
                className={`text-[10px] ${
                  partnerLive ? "text-emerald-500" : "text-muted-foreground"
                }`}
              >
                {partnerLive ? "Live" : partner.isSharing ? "Stale" : "Off"}
              </span>
            </div>
            {partner.isSharing && (
              <span className="text-[10px] text-muted-foreground">
                {timeAgo(partner.locationAgeSeconds)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Last updated */}
      {partnerHasLoc && bothSharing && (
        <div className="mt-4 flex items-center justify-center gap-2 border-t border-border/40 pt-3 text-[12px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>Lokasi bersama diperbarui: {timeAgo(partner.locationAgeSeconds)}</span>
        </div>
      )}

      {/* Meeting banner */}
      <AnimatePresence>
        {meeting && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 overflow-hidden"
          >
            <div className="rounded-xl bg-gradient-to-r from-rose-500/15 to-amber-400/15 p-2 text-center text-sm font-medium text-foreground">
              Kalian berdua bertemu! 💕
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}


