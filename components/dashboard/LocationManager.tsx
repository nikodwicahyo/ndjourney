"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  Heart,
  MapPin,
  ShieldCheck,
  Bell,
  History,
  Activity,
  Signal,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Skeleton, Button } from "@/components/ui";
import {
  useLocationSettings,
  useDistance,
  useIsMeeting,
  useShareLocation,
  useFloatingHearts,
  useSendHeart,
  useLocationHistory,
} from "@/hooks/useLocation";
import type { ShareStatus } from "@/hooks/useBackgroundLocation";
import LocationToggle from "@/components/location/LocationToggle";
import DistanceCard from "@/components/location/DistanceCard";
import MeetBanner from "@/components/location/MeetBanner";
import DeviceBadge from "@/components/location/DeviceBadge";
import FloatingHeart from "@/components/location/FloatingHeart";
import NearbySuggestion from "@/components/location/NearbySuggestion";

const PartnerMap = dynamic(() => import("@/components/location/PartnerMap"), {
  ssr: false,
  loading: () => (
    <div className="space-y-3">
      <Skeleton className="h-[420px] w-full rounded-2xl sm:h-[560px]" />
    </div>
  ),
});

function StatusIndicator({ status }: { status: ShareStatus }) {
  switch (status) {
    case "sharing":
      return (
        <span className="flex items-center gap-1.5 text-xs text-emerald-500">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          GPS Aktif
        </span>
      );
    case "locating":
      return (
        <span className="flex items-center gap-1.5 text-xs text-amber-500">
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
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
  const { status: sessionStatus } = useSession();
  const { data, isLoading, error } = useLocationSettings();
  const { data: historyData } = useLocationHistory();
  const [showHistory, setShowHistory] = useState(false);
  const prevDistanceRef = useRef<number | null>(null);
  const previousDistance = prevDistanceRef.current;

  const distance = useDistance(data);
  const meeting = useIsMeeting(data);
  const { heart, clearHeart } = useFloatingHearts(data?.coupleId);
  const { status: shareStatus } = useShareLocation(data?.self.isSharing ?? false);

  // Update previous distance ref after render
  useEffect(() => {
    if (distance !== null) {
      prevDistanceRef.current = distance;
    }
  }, [distance]);

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
      <div className="flex items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        <AlertTriangle className="h-4 w-4" />
        Gagal memuat data lokasi. Coba lagi nanti.
      </div>
    );
  }

  const { self, partner } = data;
  const bothSharing = self.isSharing && partner.isSharing;

  const selfPin = self.location
    ? {
        id: self.userId,
        label: "Kamu",
        point: self.location,
        isSelf: true,
        image: self.image,
        deviceType: self.deviceType,
      }
    : null;
  const partnerPin = partner.location
    ? {
        id: partner.userId,
        label: partner.name,
        point: partner.location,
        isSelf: false,
        image: partner.image,
        deviceType: partner.deviceType,
      }
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-lg font-semibold">Lokasi Pasangan</h2>
          <p className="text-sm text-muted-foreground">
            Berbagi lokasi secara live, privat, dan hanya untuk berdua. 💕
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
            untuk melihat jarak dan peta. 💕
          </span>
        </div>
      ) : null}

      <MeetBanner show={meeting && bothSharing} distance={distance} />

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {self.isSharing || partner.isSharing ? (
            <div className="space-y-2">
              <PartnerMap
                self={selfPin}
                partner={partnerPin}
                history={historyData}
                showHistory={showHistory}
              />
              {/* Map controls */}
              {historyData && historyData.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowHistory(!showHistory)}
                    className="text-xs"
                  >
                    <History className="mr-1 h-3 w-3" />
                    {showHistory ? "Sembunyikan riwayat" : "Tampilkan riwayat"}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="flex h-[420px] flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground sm:h-[560px]">
                <MapPin className="h-8 w-8 text-primary/50" />
                <p>Peta muncul saat kamu berbagi lokasi.</p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <DeviceBadge deviceType={self.deviceType} />
                  <span className="text-xs text-muted-foreground">·</span>
                  <DeviceBadge deviceType={partner.deviceType} />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4 lg:col-span-2">
          <DistanceCard
            state={data}
            distance={distance}
            previousDistance={previousDistance ?? null}
          />

          {bothSharing && <HeartSender />}

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

function HeartSender() {
  const sendHeart = useSendHeart();
  return (
    <button
      type="button"
      onClick={() => void sendHeart.mutate("❤️")}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card p-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
    >
      <Heart className="h-4 w-4 fill-primary text-primary" />
      Kirim hati ke pasangan
    </button>
  );
}
