"use client";

import "leaflet/dist/leaflet.css";
import dynamic from "next/dynamic";
import { useMemo, useState, type ReactNode } from "react";
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
import { Skeleton, Button } from "@/components/ui";
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
  formatStopTimeLabel,
  detectStopPoints,
  hasTrackMovement,
  type VisitedStop,
} from "@/lib/location-history";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  shouldUseRoadRoute,
  ROAD_ROUTE_COLOR,
  STRAIGHT_ROUTE_COLOR,
} from "@/lib/routing";
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

const HISTORY_RANGES = [
  { key: "24h", label: "24 Jam" },
  { key: "3d", label: "3 Hari" },
  { key: "7d", label: "7 Hari" },
  { key: "all", label: "Semua" },
] as const;

const historyRangeLabel = (range: string) =>
  HISTORY_RANGES.find((r) => r.key === range)?.label ?? range;

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

/** One chip row reused by both history filters — keeps both groups identical. */
function FilterRow<K extends string>({
  label,
  icon,
  options,
  value,
  onChange,
}: {
  label: string;
  icon?: ReactNode;
  options: readonly { key: K; label: string }[];
  value: K;
  onChange: (value: K) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
      <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
        {icon}
        {label}
      </span>
      <div className="flex flex-wrap gap-1" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            aria-pressed={value === option.key}
            className={`min-h-7 rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary ${
              value === option.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Flat stop group — no nested card, so both people read as one list. */
function StopGroup({
  title,
  stops,
  addresses,
  selectedStop,
  onSelect,
  accent,
}: {
  title: string;
  stops: VisitedStop[];
  addresses: Record<string, string | null | undefined>;
  selectedStop: VisitedStop | null;
  onSelect: (stop: VisitedStop) => void;
  accent: "blue" | "rose";
}) {
  const tone = accent === "blue"
    ? {
        dot: "bg-blue-500",
        header: "text-blue-600 dark:text-blue-400",
        badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
        selected: "border-blue-500/50 bg-blue-500/5",
      }
    : {
        dot: "bg-rose-500",
        header: "text-rose-600 dark:text-rose-400",
        badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
        selected: "border-rose-500/50 bg-rose-500/5",
      };

  return (
    <section className="rounded-xl border border-border/70 bg-background/50 p-2.5 sm:p-3">
      <header className="mb-2 flex items-center justify-between gap-2">
        <h4 className={`flex min-w-0 items-center gap-1.5 text-xs font-semibold ${tone.header}`}>
          <span className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`} aria-hidden="true" />
          <span className="truncate">{title}</span>
        </h4>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {stops.length} lokasi
        </span>
      </header>
      <ul className="max-h-56 space-y-1.5 overflow-y-auto pr-1" role="list">
        {stops.map((stop, i) => {
          const selected = selectedStop?.id === stop.id;
          const timeLabel = formatStopTimeLabel(stop);
          return (
            <li key={stop.id}>
              <button
                type="button"
                onClick={() => onSelect(stop)}
                aria-current={selected ? "true" : undefined}
                className={`grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 rounded-lg border p-2 text-left text-xs transition-colors hover:bg-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary ${
                  selected ? tone.selected : "border-border/60 bg-card/70"
                }`}
              >
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${tone.dot}`} aria-hidden="true">
                  {stop.isCurrent ? <MapPin className="h-3 w-3" aria-hidden="true" /> : i + 1}
                </span>
                <span className="min-w-0 space-y-0.5">
                  <span className="block truncate font-medium text-foreground">
                    {stop.isCurrent ? "Lokasi Saat Ini" : `Kunjungan #${i + 1}`}
                  </span>
                  <span className="block truncate text-[10px] text-muted-foreground" title={timeLabel}>
                    {timeLabel}
                  </span>
                  {addresses[stop.id] && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span className="truncate" title={addresses[stop.id] ?? undefined}>
                        {addresses[stop.id]}
                      </span>
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 items-center justify-end gap-1.5">
                  <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone.badge}`}>
                    {stop.isCurrent ? "Sedang di sini" : formatDurationId(stop.durationMinutes)}
                  </span>
                  <Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function LocationManager() {
  const { data: session, status: sessionStatus } = useSession();
  const { data, isLoading, error, refetch } = useLocationSettings();
  const [historyRange, setHistoryRange] = useState<"24h" | "3d" | "7d" | "all">("24h");
  const [filterUser, setFilterUser] = useState<"all" | "partner" | "self">("all");
  const [snapToRoads, setSnapToRoads] = useState<boolean>(true);
  const [selectedStop, setSelectedStop] = useState<VisitedStop | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const { data: historyResult, isLoading: isHistoryLoading } = useLocationHistory(
    historyRange,
    { enabled: showHistory },
  );
  const historyData = useMemo(() => historyResult?.points ?? [], [historyResult]);
  const historyTruncated = historyResult?.truncated ?? false;

  const selfId = session?.user?.id;

  // Purely memoized stops: prevents any setState re-render cycle
  const detectedStops: { self: VisitedStop[]; partner: VisitedStop[] } = useMemo(() => {
    if (!historyData || historyData.length === 0 || !selfId) {
      return { self: [], partner: [] };
    }
    const selfHistory = historyData.filter((h) => h.userId === selfId);
    const partnerHistory = historyData.filter((h) => h.userId !== selfId);
    return {
      self: detectStopPoints(selfHistory),
      partner: detectStopPoints(partnerHistory),
    };
  }, [historyData, selfId]);

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

  // The road route is always fetched when both people share — the distance
  // card is road-only and must not depend on the map-view toggle.
  const routeQuery = useRoadRoute(
    selfPin?.point ?? null,
    partnerPin?.point ?? null,
    !!selfPin && !!partnerPin,
  );

  // A failed/fallback OSRM call must not be presented as a road route.
  const cardRoute = shouldUseRoadRoute(routeQuery.data ?? null);
  // The toggle only decides what the MAP draws: road polyline or straight line.
  const mapRoute = snapToRoads ? cardRoute : null;

  const allStops = useMemo(
    () => [...detectedStops.self, ...detectedStops.partner],
    [detectedStops],
  );
  const stopAddresses = usePlaceNames(allStops);

  // Record count follows the same filter as the drawn trail, so the legend
  // never claims more points than the map actually shows.
  const visibleHistory = useMemo(
    () =>
      selfId
        ? historyData.filter((h) =>
            filterUser === "all"
              ? true
              : filterUser === "self"
                ? h.userId === selfId
                : h.userId !== selfId,
          )
        : [],
    [historyData, filterUser, selfId],
  );
  const historyHasMovement = hasTrackMovement(visibleHistory);

  // The stop list follows the same "Tampilkan" filter as the map trail.
  const visibleStops = useMemo(
    () => ({
      self: filterUser === "partner" ? [] : detectedStops.self,
      partner: filterUser === "self" ? [] : detectedStops.partner,
    }),
    [detectedStops, filterUser],
  );
  const visibleStopCount = visibleStops.self.length + visibleStops.partner.length;
  const hasVisibleStops = visibleStopCount > 0;

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
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-5">
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
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-5">
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
              route={mapRoute}
              stopAddresses={stopAddresses}
              selfId={session?.user?.id}
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
                    className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    style={{
                      borderColor: snapToRoads ? ROAD_ROUTE_COLOR : STRAIGHT_ROUTE_COLOR,
                    }}
                    title={snapToRoads ? "Rute mengikuti jalan asli (OSRM)" : "Garis lurus langsung"}
                  >
                    <Route
                      className="h-3.5 w-3.5"
                      style={{ color: snapToRoads ? ROAD_ROUTE_COLOR : STRAIGHT_ROUTE_COLOR }}
                    />
                    <span>{snapToRoads ? "Rute: Road" : "Rute: Line"}</span>
                  </button>
                </div>

                {snapToRoads && bothSharing && !mapRoute && !routeQuery.isLoading && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400" role="status">
                    Rute jalan belum tersedia di peta — menampilkan garis lurus sementara.
                  </p>
                )}

                {/* One card: filters, summary and visited places */}
                {showHistory && (
                  <section className="overflow-hidden rounded-2xl border border-border bg-card/90 shadow-sm backdrop-blur-sm">
                    <div className="space-y-3 p-3 sm:p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                        <FilterRow
                          label="Durasi"
                          icon={<Calendar className="h-3 w-3" />}
                          options={HISTORY_RANGES}
                          value={historyRange}
                          onChange={(key) => {
                            setHistoryRange(key);
                            qc.invalidateQueries({
                              queryKey: [...queryKeys.location.all, "history", key],
                            });
                          }}
                        />
                        <FilterRow
                          label="Tampilkan"
                          options={[
                            { key: "all", label: "Semua" },
                            { key: "partner", label: partner.name },
                            { key: "self", label: "Kamu" },
                          ] as const}
                          value={filterUser}
                          onChange={setFilterUser}
                        />
                      </div>

                      <div className="rounded-xl bg-muted/40 p-2.5 text-[11px] text-muted-foreground">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                          <span className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-blue-500" aria-hidden="true" />
                            Kamu · {visibleStops.self.length}x singgah
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-rose-500" aria-hidden="true" />
                            {partner.name} · {visibleStops.partner.length}x singgah
                          </span>
                        </div>
                        <p className="mt-1.5 leading-relaxed">
                          {isHistoryLoading
                            ? "Memuat tempat singgah…"
                            : visibleStopCount > 0
                              ? `${historyHasMovement ? "jejak perjalanan dan titik singgah sudah terlihat di peta" : "lokasi tidak banyak berubah, jadi ditandai lingkaran di peta"} · ketuk titik untuk detail`
                              : `Belum ada tempat singgah pada rentang ${historyRangeLabel(historyRange)}`}
                        </p>
                        {historyTruncated && (
                          <p className="mt-1 text-amber-600 dark:text-amber-400" role="status">
                            Batas 2000 titik per orang — data lebih lama tidak ditampilkan. Persempit rentang untuk melihatnya.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-border/60 p-3 sm:p-4">
                      <h3 className="mb-2.5 flex items-center gap-1.5 font-heading text-sm font-semibold">
                        <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
                        Tempat yang Dikunjungi
                      </h3>
                      {hasVisibleStops ? (
                        <div className="grid gap-2.5 md:grid-cols-2 md:gap-3">
                          {visibleStops.partner.length > 0 && (
                            <StopGroup
                              title={`Tempat Singgah ${partner.name}`}
                              stops={visibleStops.partner}
                              addresses={stopAddresses}
                              selectedStop={selectedStop}
                              onSelect={setSelectedStop}
                              accent="rose"
                            />
                          )}
                          {visibleStops.self.length > 0 && (
                            <StopGroup
                              title="Tempat Singgah Kamu"
                              stops={visibleStops.self}
                              addresses={stopAddresses}
                              selectedStop={selectedStop}
                              onSelect={setSelectedStop}
                              accent="blue"
                            />
                          )}
                        </div>
                      ) : (
                        <p className="rounded-xl border border-dashed border-border/70 p-3 text-center text-[11px] text-muted-foreground" role="status">
                          {isHistoryLoading
                            ? "Mencari tempat singgah…"
                            : "Belum ada tempat singgah pada rentang ini."}
                        </p>
                      )}
                    </div>
                  </section>
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
            roadRoute={cardRoute}
            routeLoading={routeQuery.isLoading}
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


