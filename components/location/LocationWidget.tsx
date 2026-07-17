"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { Heart, MapPin, Loader2, Send, Compass } from "lucide-react";
import { Button, Card } from "@/components/ui";
import {
  useLocationSettings,
  useDistance,
  useIsMeeting,
  useShareLocation,
  useFloatingHearts,
  useSendHeart,
} from "@/hooks/useLocation";
import DeviceBadge from "./DeviceBadge";
import FloatingHeart from "./FloatingHeart";
import {
  formatDistance,
  bearing,
  formatBearing,
  estimateArrivalSeconds,
  formatArrivalTime,
} from "@/lib/geo";

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
      <Card className="p-4">
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
      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 text-primary" />
          <span>
            {partner.name} belum membagikan lokasi. Nyalakan berbagi di menu
            Location untuk saling melihat. 💕
          </span>
        </div>
      </Card>
    );
  }

  let bearingStr = "";
  let etaStr = "";
  if (self.location && partner.location) {
    const selfLatLng = { latitude: self.location.lat, longitude: self.location.lng };
    const partnerLatLng = { latitude: partner.location.lat, longitude: partner.location.lng };
    const b = bearing(selfLatLng, partnerLatLng);
    bearingStr = formatBearing(b);
    const d = distance ?? 0;
    if (d > 10) {
      etaStr = formatArrivalTime(estimateArrivalSeconds(d, "walking"));
    }
  }

  return (
    <Card className="relative overflow-hidden p-4">
      <FloatingHeart event={heart} onDone={clearHeart} />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Heart className="h-4 w-4 fill-primary text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              Lokasi {partner.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {distance !== null ? (
                <>
                  {formatDistance(distance)} ·{" "}
                  <DeviceBadge deviceType={partner.deviceType} className="align-middle" />
                </>
              ) : (
                "menunggu posisi…"
              )}
            </p>
          </div>
        </div>

        <SendHeartButton />
      </div>

      {/* Mini info: bearing + ETA */}
      {(bearingStr || etaStr) && distance !== null && (
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground/70">
          {bearingStr && (
            <span className="flex items-center gap-1">
              <Compass className="h-3 w-3" />
              {bearingStr}
            </span>
          )}
          {etaStr && (
            <span className="flex items-center gap-1">🚶 {etaStr}</span>
          )}
        </div>
      )}

      <AnimatePresence>
        {meeting && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 overflow-hidden"
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

function SendHeartButton() {
  const [burst, setBurst] = useState(false);
  const sendHeart = useSendHeart();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Kirim hati"
      onClick={() => {
        void sendHeart.mutate("❤️");
        setBurst(true);
        setTimeout(() => setBurst(false), 400);
      }}
    >
      <motion.span animate={burst ? { scale: [1, 1.4, 1] } : {}}>
        <Heart className="h-4 w-4 text-primary" />
      </motion.span>
    </Button>
  );
}
