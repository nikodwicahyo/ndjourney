"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { MapPin, Loader2 } from "lucide-react";
import { Card, Avatar, AvatarImage, AvatarFallback } from "@/components/ui";
import {
  useLocationSettings,
  useIsMeeting,
  useFloatingHearts,
  useRoadRoute,
  useStatusClock,
} from "@/hooks/useLocation";
import { shouldUseRoadRoute } from "@/lib/routing";
import { deriveStatus, timeAgoId } from "@/lib/location/status";
import DeviceBadge from "./DeviceBadge";
import FloatingHeart from "./FloatingHeart";
import { formatDistance, formatDistanceCategory } from "@/lib/geo";

export default function LocationWidget() {
  const { status: sessionStatus } = useSession();

  // Don't mount the hook tree for guests: it used to poll /api/location and
  // open a Pusher socket before the 401 came back. Renders nothing until the
  // session is resolved, then mounts once.
  if (sessionStatus !== "authenticated") return null;

  return <LocationWidgetContent />;
}

function LocationWidgetContent() {
  const { data, isLoading } = useLocationSettings();
  const meeting = useIsMeeting(data);
  const { heart, clearHeart } = useFloatingHearts(data?.coupleId);

  // Same road-only source as DistanceCard on /location. The query is keyed by
  // rounded coords and cached, so both surfaces share one OSRM result.
  const bothSharing = !!data && data.self.isSharing && data.partner.isSharing;
  const routeQuery = useRoadRoute(
    data?.self.location ?? null,
    bothSharing ? data?.partner.location ?? null : null,
    bothSharing,
  );
  const roadRoute = shouldUseRoadRoute(routeQuery.data ?? null);
  const now = useStatusClock();

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
            Location untuk saling melihat.
          </span>
        </div>
      </Card>
    );
  }

  const selfStatus = deriveStatus({
    isSharing: self.isSharing,
    lastFixAt: self.lastFixAt,
    lastSeenAt: self.lastSeenAt,
    trackingState: self.trackingState,
    now,
  });
  const partnerStatus = deriveStatus({
    isSharing: partner.isSharing,
    lastFixAt: partner.lastFixAt,
    lastSeenAt: partner.lastSeenAt,
    trackingState: partner.trackingState,
    now,
  });
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

      {/* Road-only status, same rules as DistanceCard: never a straight-line
          number masquerading as a road route. */}
      <p className="mt-1 text-center text-xs text-muted-foreground" role="status">
        {!bothSharing
          ? "Aktifkan berbagi lokasi"
          : roadRoute
            ? formatDistanceCategory(roadRoute.distanceMeters)
            : routeQuery.isLoading
              ? "Memuat jarak…"
              : "Jarak tidak tersedia"}
      </p>

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
                selfStatus.isLive ? "bg-emerald-500" : "bg-muted-foreground/50"
              }`}
            />
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <p className="max-w-[72px] truncate text-xs font-medium leading-tight text-foreground">
              {self.name ?? "Kamu"}
            </p>
            <div className="flex items-center gap-1">
              {self.deviceType && <DeviceBadge deviceType={self.deviceType} />}
              <span
                className={`text-xs ${
                  selfStatus.isLive ? "text-emerald-500" : "text-muted-foreground"
                }`}
                title={selfStatus.detail ?? undefined}
              >
                {selfStatus.label}
              </span>
            </div>
            {self.isSharing && (
              <span className="text-xs text-muted-foreground">
                {selfStatus.isLive ? timeAgoId(selfStatus.ageSeconds) : selfStatus.detail}
              </span>
            )}
          </div>
        </div>

        {/* Distance */}
        <div className="flex flex-col items-center gap-0.5">
          <span className="font-heading text-xl font-bold tabular-nums text-foreground">
            {roadRoute ? formatDistance(roadRoute.distanceMeters) : "—"}
          </span>
          {bothSharing && (
            selfStatus.isLive && partnerStatus.isLive ? (
              <span className="flex items-center gap-1 text-xs text-emerald-500">
                <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />
                live
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-amber-500">
                <span className="h-1 w-1 rounded-full bg-amber-500" aria-hidden="true" />
                offline
              </span>
            )
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
                partnerStatus.isLive ? "bg-emerald-500" : "bg-muted-foreground/50"
              }`}
            />
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <p className="max-w-[72px] truncate text-xs font-medium leading-tight text-foreground">
              {partner.name}
            </p>
            <div className="flex items-center gap-1">
              {partner.deviceType && <DeviceBadge deviceType={partner.deviceType} />}
              <span
                className={`text-xs ${
                  partnerStatus.isLive ? "text-emerald-500" : "text-muted-foreground"
                }`}
                title={partnerStatus.detail ?? undefined}
              >
                {partnerStatus.label}
              </span>
            </div>
            {partner.isSharing && (
              <span className="text-xs text-muted-foreground">
                {partnerStatus.isLive ? timeAgoId(partnerStatus.ageSeconds) : partnerStatus.detail}
              </span>
            )}
          </div>
        </div>
      </div>

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
              Kalian berdua bertemu!
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}


