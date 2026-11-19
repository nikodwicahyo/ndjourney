"use client";

import "leaflet/dist/leaflet.css";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  MapPin,
  ShieldCheck,
  History,
  Calendar,
  Route,
  Navigation,
  Clock,
  Eye,
} from "lucide-react";
import { Skeleton, Button, Badge, Card } from "@/components/ui";
import {
  useLocationSettings,
  useDistance,
  useIsMeeting,
  useFloatingHearts,
  useLocationHistory,
  useRoadRoute,
  usePlaceNames,
} from "@/hooks/useLocation";
import {
  formatDurationId,
  formatTimeOnly,
  detectStopPoints,
  type VisitedStop,
} from "@/lib/location-history";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  retrySharing,
  useBackgroundLocationStatus,
  type ShareStatus,
} from "@/hooks/useBackgroundLocation";
import LocationToggle from "@/components/location/LocationToggle";
import DistanceCard from "@/components/location/DistanceCard";
import MeetBanner from "@/components/location/MeetBanner";
import DeviceBadge from "@/components/location/DeviceBadge";
import FloatingHeart from "@/components/location/FloatingHeart";
import NearbySuggestion from "@/components/location/NearbySuggestion";

const PartnerMap = dynamic(() => import("@/components/location/PartnerMap").catch((err) => {
  console.error("[LocationManager] PartnerMap dynamic import failed:", err);
  return { default: () => <div className="flex h-[420px] w-full items-center justify-center rounded-2xl border border-border text-sm text-muted-foreground sm:h-[560px]">Peta gagal dimuat</div> };
}), {
  ssr: false,
  loading: () => (
    <div className="space-y-3">
      <Skeleton className="h-[420px] w-full rounded-2xl sm:h-[560px]" />
    </div>
  ),
});

function StatusIndicator({ status }: { status: ShareStatus }) {
  const qc = useQueryClient();
  switch (status) {
    case "sharing":
      return (
        <span className="flex items-center gap-1.5 text-xs text-emerald-500">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
          GPS Aktif
        </span>
      );
    case "locating":
      return (
        <span className="flex items-center gap-1.5 text-xs text-amber-500">
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" aria-hidden="true" />
          Mencari GPS…
        </span>
      );
    case "recovering":
      return (
        <span className="flex items-center gap-1.5 text-xs text-amber-500">
          <AlertTriangle className="h-3 w-3" />
          Memulihkan koneksi…
        </span>
      );
    case "gps-error":
      return (
        <span className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertTriangle className="h-3 w-3" />
          GPS tidak merespons.
          <button
            type="button"
            onClick={() => retrySharing(qc)}
            className="inline-flex min-h-[44px] items-center font-medium underline underline-offset-2 hover:text-foreground"
          >
            Coba lagi
          </button>
        </span>
      );
    case "denied":
      return (
        <span className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertTriangle className="h-3 w-3" />
          Izin GPS ditolak
        </span>
      );
    case "unsupported":
      return (
        <span className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertTriangle className="h-3 w-3" />
          GPS tidak didukung
        </span>
      );
    default:
      return null;
  }
}

export default function LocationManager() {
  const { data: session, status: sessionStatus } = useSession();
  const { data, isLoading, error, refetch } = useLocationSettings();
  const [historyRange, setHistoryRange] = useState<"today" | "24h" | "3d" | "7d">("24h");
  const [filterUser, setFilterUser] = useState<"all" | "partner" | "self">("all");
  const [snapToRoads, setSnapToRoads] = useState<boolean>(true);
  const [selectedStop, setSelectedStop] = useState<VisitedStop | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const { data: historyData, isLoading: isHistoryLoading } = useLocationHistory(
    historyRange,
    { enabled: showHistory },
  );

  // Purely memoized stops: prevents any setState re-render cycle
  const detectedStops: { self: VisitedStop[]; partner: VisitedStop[] } = useMemo(() => {
    if (!historyData || historyData.length === 0 || !session?.user?.id) {
      return { self: [], partner: [] };
    }
    const selfId = session.user.id;
    const selfHistory = historyData.filter((h) => h.userId === selfId);
    const partnerHistory = historyData.filter((h) => h.userId !== selfId);
    return {
      self: detectStopPoints(selfHistory),
      partner: detectStopPoints(partnerHistory),
    };
  }, [historyData, session?.user?.id]);

  const qc = useQueryClient();
  // Previous non-null distance for trend display — tracked in state during
  // render (React-endorsed adjustment) instead of a ref read during render.
  const [previousDistance, setPreviousDistance] = useState<number | null>(null);

  const distance = useDistance(data);
  const meeting = useIsMeeting(data);
  const { heart, clearHeart } = useFloatingHearts(data?.coupleId);
  // The global tracker (LocationPresenceTracker) owns the watcher now; this
  // component only subscribes to its status.
  const shareStatus = useBackgroundLocationStatus();

  // Update previous distance ref after render
  if (distance !== null && distance !== previousDistance) {
    setPreviousDistance(distance);
  }

  const selfPin = useMemo(() => {
    const s = data?.self;
    if (!s?.location) return null;
    return {
      id: s.userId,
      label: "Kamu",
      point: s.location,
      isSelf: true,
      image: s.image,
      deviceType: s.deviceType,
    };
  }, [data?.self]);

  const partnerPin = useMemo(() => {
    const p = data?.partner;
    if (!p?.isSharing || !p?.location) return null;
    return {
      id: p.userId,
      label: p.name,
      point: p.location,
      isSelf: false,
      image: p.image,
      deviceType: p.deviceType,
    };
  }, [data?.partner]);

  const routeQuery = useRoadRoute(
    selfPin?.point ?? null,
    partnerPin?.point ?? null,
    snapToRoads && !!selfPin && !!partnerPin,
  );

  const stopAddresses = usePlaceNames([
    ...detectedStops.self,
    ...detectedStops.partner,
  ]);

  if (sessionStatus === "unauthenticated") {
    return (
      <p className="text-sm text-muted-foreground">
        Silakan login untuk melihat lokasi pasangan.
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-[420px] w-full rounded-2xl" />
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
          <div className="space-y-4 lg:col-span-2">
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div role="alert" className="flex items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        <AlertTriangle className="h-4 w-4" />
        <span className="flex-1">Gagal memuat data lokasi. Coba lagi nanti.</span>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Coba Lagi
        </Button>
      </div>
    );
  }

  const { self, partner } = data;
  const bothSharing = self.isSharing && partner.isSharing;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-lg font-semibold">Lokasi Pasangan</h2>
          <p className="text-sm text-muted-foreground">
            Berbagi lokasi secara live, privat, dan hanya untuk berdua.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusIndicator status={shareStatus} />
          <LocationToggle isSharing={self.isSharing} />
        </div>
      </div>

      {/* Status banners */}
      {!self.isSharing ? (
        <div className="flex items-start gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            Nyalakan berbagi lokasi untuk melihat posisi {partner.name} secara
            live. Data hanya terlihat oleh berdua.
          </span>
        </div>
      ) : !partner.isSharing ? (
        <div className="flex items-start gap-2 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            Kamu sudah berbagi. Ajak {partner.name} menyalakan berbagi lokasi
            untuk melihat jarak dan peta.
          </span>
        </div>
      ) : null}

      <MeetBanner show={meeting && bothSharing} distance={distance} />

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="relative space-y-2">
            <PartnerMap
              self={selfPin}
              partner={partnerPin}
              history={historyData}
              showHistory={showHistory}
              selectedStop={selectedStop}
              stops={detectedStops}
              filterUser={filterUser}
              snapToRoads={snapToRoads}
              route={routeQuery.data ?? null}
              stopAddresses={stopAddresses}
            />
            {!self.isSharing && !partner.isSharing && (
              <div className="absolute inset-0 z-[1002] flex flex-col items-center justify-center gap-3 rounded-2xl bg-background/60 p-6 text-center text-sm text-muted-foreground backdrop-blur-sm">
                <MapPin className="h-8 w-8 text-primary/50" />
                <p>Peta muncul saat kamu berbagi lokasi.</p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <DeviceBadge deviceType={self.deviceType} />
                  <span className="text-xs text-muted-foreground">·</span>
                  <DeviceBadge deviceType={partner.deviceType} />
                </div>
              </div>
            )}
            {/* Map controls & history settings */}
            {(self.isSharing || partner.isSharing) && (
              <div className="space-y-3 pt-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button
                    variant={showHistory ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (!showHistory) {
                        qc.invalidateQueries({
                          queryKey: [...queryKeys.location.all, "history", historyRange],
                        });
                      }
                      setShowHistory(!showHistory);
                    }}
                    className="text-xs h-8 gap-1.5 font-medium"
                    aria-pressed={showHistory}
                  >
                    <History className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    {showHistory ? "Sembunyikan Riwayat" : "Tampilkan Riwayat"}
                  </Button>

                  <button
                    type="button"
                    onClick={() => setSnapToRoads((v) => !v)}
                    aria-pressed={snapToRoads}
                    className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                      snapToRoads
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "border-border bg-background text-muted-foreground"
                    }`}
                    title={snapToRoads ? "Rute mengikuti jalan asli (OSRM)" : "Garis lurus langsung"}
                  >
                    <Route className="h-3.5 w-3.5" />
                    <span>{snapToRoads ? "Rute: Mengikuti Jalan" : "Rute: Garis Lurus"}</span>
                  </button>
                </div>

                {/* History duration and filter toolbar */}
                {showHistory && (
                  <div className="rounded-xl border border-border bg-card/80 p-3 space-y-2.5 backdrop-blur-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {/* Duration selector */}
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-medium text-muted-foreground mr-1 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Durasi:
                        </span>
                        {(
                          [
                            { key: "today", label: "Hari ini" },
                            { key: "24h", label: "24 Jam" },
                            { key: "3d", label: "3 Hari" },
                            { key: "7d", label: "7 Hari" },
                          ] as const
                        ).map(({ key, label }) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              setHistoryRange(key);
                              qc.invalidateQueries({
                                queryKey: [...queryKeys.location.all, "history", key],
                              });
                            }}
                            className={`rounded-md px-2 py-0.5 text-xs font-medium transition-colors ${
                              historyRange === key
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      {/* Partner filter */}
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-medium text-muted-foreground mr-1">Tampilkan:</span>
                        {(
                          [
                            { key: "all", label: "Semua" },
                            { key: "partner", label: partner.name },
                            { key: "self", label: "Kamu" },
                          ] as const
                        ).map(({ key, label }) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setFilterUser(key)}
                            className={`rounded-md px-2 py-0.5 text-xs font-medium transition-colors ${
                              filterUser === key
                                ? "bg-secondary text-secondary-foreground shadow-sm font-semibold"
                                : "text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Stats & Description Banner */}
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/50 pt-2">
                      <span>
                        {isHistoryLoading
                          ? "Memuat riwayat rute…"
                          : historyData && historyData.length > 0
                          ? `Total ${historyData.length} titik jejak jalan · ${
                              (filterUser === "partner" || filterUser === "all" ? detectedStops.partner.length : 0) +
                              (filterUser === "self" || filterUser === "all" ? detectedStops.self.length : 0)
                            } tempat singgah`
                          : "Belum ada titik jejak pada rentang waktu ini."}
                      </span>
                      <span className="text-[10px] opacity-75">Klik tempat singgah untuk fokus di peta</span>
                    </div>
                  </div>
                )}

                {/* Visited stops list */}
                {showHistory && (
                  <div className="space-y-3 pt-2">
                    <h3 className="font-heading text-sm font-semibold flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-primary" />
                      Daftar Tempat yang Dikunjungi
                    </h3>

                    {/* Partner stops */}
                    {(filterUser === "all" || filterUser === "partner") && detectedStops.partner.length > 0 && (
                      <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-rose-600 dark:text-rose-400">
                          <span>Tempat Singgah {partner.name}</span>
                          <span className="text-[11px] font-normal">{detectedStops.partner.length} lokasi</span>
                        </div>
                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                          {detectedStops.partner.map((stop, i) => (
                            <button
                              key={stop.id}
                              type="button"
                              onClick={() => setSelectedStop(stop)}
                              aria-current={selectedStop?.id === stop.id ? "true" : undefined}
                              className={`w-full flex items-center justify-between gap-2 rounded-lg bg-card/80 p-2 text-left text-xs hover:bg-card border transition-colors shadow-xs ${
                                selectedStop?.id === stop.id ? "border-primary bg-primary/5" : "border-border/60"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                                  {stop.isCurrent ? "📍" : i + 1}
                                </span>
                                <div className="truncate">
                                  <p className="font-medium text-foreground truncate">
                                    {stop.isCurrent ? "Lokasi Saat Ini" : `Kunjungan #${i + 1}`}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {formatTimeOnly(stop.arrivedAt)} {stop.isCurrent ? "– sekarang" : `– ${formatTimeOnly(stop.departedAt)}`}
                                  </p>
                                  {stopAddresses[stop.id] && (
                                    <p className="truncate text-[10px] text-muted-foreground">📍 {stopAddresses[stop.id]}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                                  {stop.isCurrent ? "Sedang di sini" : formatDurationId(stop.durationMinutes)}
                                </span>
                                <Eye className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Self stops */}
                    {(filterUser === "all" || filterUser === "self") && detectedStops.self.length > 0 && (
                      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-blue-600 dark:text-blue-400">
                          <span>Tempat Singgah Kamu</span>
                          <span className="text-[11px] font-normal">{detectedStops.self.length} lokasi</span>
                        </div>
                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                          {detectedStops.self.map((stop, i) => (
                            <button
                              key={stop.id}
                              type="button"
                              onClick={() => setSelectedStop(stop)}
                              aria-current={selectedStop?.id === stop.id ? "true" : undefined}
                              className={`w-full flex items-center justify-between gap-2 rounded-lg bg-card/80 p-2 text-left text-xs hover:bg-card border transition-colors shadow-xs ${
                                selectedStop?.id === stop.id ? "border-primary bg-primary/5" : "border-border/60"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
                                  {stop.isCurrent ? "📍" : i + 1}
                                </span>
                                <div className="truncate">
                                  <p className="font-medium text-foreground truncate">
                                    {stop.isCurrent ? "Lokasi Saat Ini" : `Kunjungan #${i + 1}`}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {formatTimeOnly(stop.arrivedAt)} {stop.isCurrent ? "– sekarang" : `– ${formatTimeOnly(stop.departedAt)}`}
                                  </p>
                                  {stopAddresses[stop.id] && (
                                    <p className="truncate text-[10px] text-muted-foreground">📍 {stopAddresses[stop.id]}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                                  {stop.isCurrent ? "Sedang di sini" : formatDurationId(stop.durationMinutes)}
                                </span>
                                <Eye className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <DistanceCard
            state={data}
            distance={distance}
            previousDistance={previousDistance ?? null}
            roadRoute={snapToRoads ? routeQuery.data ?? null : null}
          />

          {meeting && bothSharing && <NearbySuggestion />}
        </div>
      </div>

      {/* Floating hearts overlay */}
      <div className="pointer-events-none fixed bottom-24 right-6 z-40">
        <FloatingHeart event={heart} onDone={clearHeart} />
      </div>
    </div>
  );
}


