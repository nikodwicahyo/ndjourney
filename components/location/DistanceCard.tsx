"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useSpring, useTransform, AnimatePresence } from "framer-motion";
import {
  Clock,
  MapPin,
  TrendingDown,
  TrendingUp,
  Footprints,
  Bike,
  Car,
  EyeOff,
  Heart,
  Sparkles,
  Navigation,
  Crosshair,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback, Card, CardContent } from "@/components/ui";
import {
  formatDistance,
  formatDistanceCategory,
  bearing,
  formatBearingId,
  directionEmoji,
  distanceTrend,
  estimateArrivalSeconds,
  formatArrivalTime,
  type DistanceTrend as TrendType,
  type TravelMode,
} from "@/lib/geo";
import type { LocationState } from "@/hooks/useLocation";
import DeviceBadge from "./DeviceBadge";

const MODES: { mode: TravelMode; icon: typeof Footprints; label: string }[] = [
  { mode: "walking", icon: Footprints, label: "Jalan kaki" },
  { mode: "cycling", icon: Bike, label: "Motor" },
  { mode: "driving", icon: Car, label: "Mobil" },
];

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

function AnimatedNumber({ value }: { value: number }) {
  const spring = useSpring(value, { stiffness: 60, damping: 12, mass: 0.3 });
  const display = useTransform(spring, (v) => formatDistance(Math.round(v)));
  return <motion.span className="tabular-nums">{display}</motion.span>;
}

function PersonAvatar({
  name,
  image,
  fallback,
  isLive,
  statusText,
  deviceType,
}: {
  name: string;
  image: string | null;
  fallback: string;
  isLive: boolean;
  statusText: string;
  deviceType: string | null;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative">
        <Avatar className="h-10 w-10 ring-2 ring-primary/20 shadow-sm">
          <AvatarImage src={image ?? undefined} />
          <AvatarFallback className="text-sm font-medium">{fallback}</AvatarFallback>
        </Avatar>
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${
            isLive ? "bg-emerald-500" : "bg-muted-foreground/50"
          }`}
        />
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <p className="text-[11px] font-medium text-foreground leading-tight truncate max-w-[72px]">{name}</p>
        <div className="flex items-center gap-1">
          {deviceType && <DeviceBadge deviceType={deviceType} />}
          <span className={`text-[9px] ${isLive ? "text-emerald-500" : "text-muted-foreground"}`}>
            {statusText}
          </span>
        </div>
      </div>
    </div>
  );
}

function PersonInfoBox({
  name,
  image,
  fallback,
  isSharing,
  isStale,
  locationAgeSeconds,
  accuracy,
  deviceType,
}: {
  name: string;
  image: string | null;
  fallback: string;
  isSharing: boolean;
  isStale: boolean;
  locationAgeSeconds: number | null;
  accuracy: number | null;
  deviceType: string | null;
}) {
  const age = timeAgo(locationAgeSeconds);
  const dotColor = isStale ? "bg-amber-500" : "bg-emerald-500";
  const label = isStale ? "Stale" : "Live";
  const labelColor = isStale ? "text-amber-500" : "text-emerald-500";

  return (
    <div className="rounded-lg bg-background/50 border border-border/50 p-2.5 space-y-1">
      <div className="flex items-center gap-1.5">
        <Avatar className="h-5 w-5">
          <AvatarImage src={image ?? undefined} />
          <AvatarFallback className="text-[8px] font-medium">{fallback}</AvatarFallback>
        </Avatar>
        <span className="text-xs font-medium text-foreground">{name}</span>
        {deviceType && <DeviceBadge deviceType={deviceType} />}
      </div>
      {isSharing ? (
        <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className={`h-1.5 w-1.5 rounded-full ${dotColor} ${isStale ? "" : "animate-pulse"}`} />
          <span className={labelColor}>{label}</span>
          <span>· {age}</span>
          {accuracy !== null && <span>· ±{Math.round(accuracy)}m</span>}
        </span>
      ) : (
        <span className="text-[10px] text-muted-foreground">Berbagi lokasi dimatikan</span>
      )}
    </div>
  );
}

export default function DistanceCard({
  state,
  distance,
  previousDistance = null,
  travelMode,
  onTravelModeChange,
}: {
  state: LocationState;
  distance: number | null;
  previousDistance?: number | null;
  travelMode?: TravelMode;
  onTravelModeChange?: (mode: TravelMode) => void;
}) {
  const { self, partner } = state;
  const bothSharing = self.isSharing && partner.isSharing;
  const partnerHasLoc = !!partner.location;
  const [localMode, setLocalMode] = useState<TravelMode>("walking");
  const activeMode = travelMode ?? localMode;
  const setActiveMode = onTravelModeChange ?? setLocalMode;
  const prevDistanceRef = useRef(distance);

  const trend = distance !== null ? distanceTrend(distance, previousDistance) : null;

  let bearingDeg: number | null = null;
  let bearingId = "";
  let bearingEmoji = "";
  let etaStr = "";

  if (self.location && partner.location) {
    bearingDeg = bearing(
      { latitude: self.location.lat, longitude: self.location.lng },
      { latitude: partner.location.lat, longitude: partner.location.lng },
    );
    bearingId = formatBearingId(bearingDeg);
    bearingEmoji = directionEmoji(bearingDeg);
    if (distance !== null && distance > 10) {
      etaStr = formatArrivalTime(estimateArrivalSeconds(distance, activeMode));
    }
  }

  const [showSparkle, setShowSparkle] = useState(false);
  useEffect(() => {
    if (distance !== null && prevDistanceRef.current !== null && distance !== prevDistanceRef.current) {
      setShowSparkle(true);
      const t = setTimeout(() => setShowSparkle(false), 1200);
      prevDistanceRef.current = distance;
      return () => clearTimeout(t);
    }
    prevDistanceRef.current = distance;
  }, [distance]);

  const selfInitial = (self.name ?? "K").charAt(0).toUpperCase();
  const partnerInitial = (partner.name ?? "P").charAt(0).toUpperCase();

  const selfLive = self.isSharing && !self.isStale;
  const partnerLive = partner.isSharing && !partner.isStale;

  return (
    <Card className="relative overflow-hidden border-primary/10">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-pink-500/[0.03] via-transparent to-blue-500/[0.03]" />

      <CardContent className="relative space-y-3 p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 shrink-0 text-pink-500" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Jarak Antar Kita</p>
            {distance !== null && bothSharing ? (
              <p className="text-[10px] text-muted-foreground">{formatDistanceCategory(distance)}</p>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                {self.isSharing && !partner.isSharing
                  ? `Menunggu ${partner.name} berbagi lokasi`
                  : "Aktifkan berbagi lokasi"}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-around py-2">
          <PersonAvatar
            name={self.name ?? "Kamu"}
            image={self.image}
            fallback={selfInitial}
            isLive={selfLive}
            statusText={selfLive ? "Live" : self.isSharing ? "Stale" : "Off"}
            deviceType={self.deviceType}
          />
          <div className="relative flex flex-col items-center px-2">
            <AnimatePresence>
              {showSparkle && (
                <motion.div
                  initial={{ opacity: 1, scale: 0.5 }}
                  animate={{ opacity: 0, scale: 2, y: -20 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1 }}
                  className="absolute -top-4"
                >
                  <Sparkles className="h-4 w-4 text-pink-400" />
                </motion.div>
              )}
            </AnimatePresence>
            <motion.div
              key={distance ?? "empty"}
              initial={{ scale: 1 }}
              animate={showSparkle ? { scale: [1, 1.08, 1] } : { scale: 1 }}
              transition={{ duration: 0.4 }}
              className="font-heading text-xl font-bold text-foreground tabular-nums"
            >
              {distance !== null ? <AnimatedNumber value={distance} /> : "—"}
            </motion.div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {bothSharing && trend === "closing" && (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500">
                  <TrendingDown className="h-3 w-3" />Semakin dekat
                </span>
              )}
              {bothSharing && trend === "away" && (
                <span className="inline-flex items-center gap-1 text-[10px] text-red-500">
                  <TrendingUp className="h-3 w-3" />Semakin jauh
                </span>
              )}
              {bothSharing && (
                <span className="flex items-center gap-1 text-[9px] text-emerald-500">
                  <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                  live
                </span>
              )}
            </div>
          </div>
          <PersonAvatar
            name={partner.name}
            image={partner.image}
            fallback={partnerInitial}
            isLive={partnerLive}
            statusText={partnerLive ? "Live" : partner.isSharing ? "Stale" : "Off"}
            deviceType={partner.deviceType}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <PersonInfoBox
            name={self.name ?? "Kamu"}
            image={self.image}
            fallback={selfInitial}
            isSharing={self.isSharing}
            isStale={self.isStale}
            locationAgeSeconds={self.locationAgeSeconds}
            accuracy={self.location?.accuracy ?? null}
            deviceType={self.deviceType}
          />
          <PersonInfoBox
            name={partner.name}
            image={partner.image}
            fallback={partnerInitial}
            isSharing={partner.isSharing}
            isStale={partner.isStale}
            locationAgeSeconds={partner.locationAgeSeconds}
            accuracy={partner.location?.accuracy ?? null}
            deviceType={partner.deviceType}
          />
        </div>

        {bothSharing && partnerHasLoc && (
          <div className="rounded-xl bg-gradient-to-br from-pink-500/[0.04] to-blue-500/[0.04] border border-pink-500/10 p-3 space-y-3">
            {bearingId && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-center gap-2"
              >
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Navigation className="h-3 w-3" />
                  <span>Ke Arah:</span>
                </div>
                <motion.span
                  animate={{ rotate: bearingDeg ?? 0 }}
                  transition={{ type: "spring", stiffness: 60, damping: 10 }}
                  className="text-lg"
                >
                  {bearingEmoji}
                </motion.span>
                <span className="text-sm font-medium text-foreground">
                  {bearingId}
                </span>
              </motion.div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>Estimasi waktu:</span>
                <motion.span
                  key={activeMode + (etaStr || "")}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="font-medium text-foreground"
                >
                  {etaStr}
                </motion.span>
              </div>
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                {MODES.map(({ mode, icon: Icon, label }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setActiveMode(mode)}
                    className={
                      "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all " +
                      (activeMode === mode
                        ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/30"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground")
                    }
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-center">
              <a
                href={
                  self.location && partner.location
                    ? (() => {
                        const dest = `${partner.location.lat},${partner.location.lng}`;
                        const origin = `${self.location.lat},${self.location.lng}`;
                        const mode =
                          activeMode === "walking" ? "walking" :
                          activeMode === "cycling" ? "two%20wheeler" :
                          "driving";
                        return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=${mode}`;
                      })()
                    : `https://www.google.com/maps/dir/?api=1&destination=${partner.location?.lat ?? ""},${partner.location?.lng ?? ""}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-pink-500/30 bg-pink-500/5 px-4 py-1.5 text-xs font-medium text-pink-600 hover:bg-pink-500/10 hover:border-pink-500/50 transition-all dark:text-pink-400"
              >
                <MapPin className="h-3.5 w-3.5" />
                Buka di Google Maps
              </a>
            </div>

            {self.location?.accuracy && (
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground border-t border-pink-500/10 pt-2">
                <Crosshair className="h-3 w-3" />
                <span>Akurasi: {accuracyLabel(self.location.accuracy)} (±{Math.round(self.location.accuracy)}m)</span>
                {partner.location?.accuracy && partner.location.accuracy !== self.location.accuracy && (
                  <span className="text-muted-foreground">| ±{Math.round(partner.location.accuracy)}m (pasangan)</span>
                )}
              </div>
            )}
          </div>
        )}

        {partnerHasLoc && (
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground border-t border-border/40 pt-2">
            <Clock className="h-3 w-3 shrink-0" />
            <span className={partner.locationAgeSeconds !== null && partner.locationAgeSeconds > 3600 ? "text-amber-500" : ""}>
              Lokasi bersama diperbarui: {timeAgo(partner.locationAgeSeconds)}
            </span>
          </div>
        )}

        {!bothSharing && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-4 text-center text-xs text-muted-foreground">
            <EyeOff className="h-5 w-5 text-muted-foreground/50" />
            <p>
              {self.isSharing
                ? `Kamu sudah berbagi. Ajak ${partner.name} mengaktifkan berbagi lokasi untuk melihat jarak, arah, dan estimasi waktu.`
                : "Nyalakan berbagi lokasi untuk melihat jarak, arah, dan estimasi waktu."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function accuracyLabel(meters: number | null): string {
  if (meters === null) return "—";
  if (meters <= 10) return "Akurat";
  if (meters <= 30) return "Cukup akurat";
  if (meters <= 65) return "Kurang akurat";
  if (meters <= 150) return "Tidak akurat";
  return "Sangat tidak akurat";
}