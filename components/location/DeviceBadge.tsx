"use client";

import { Monitor, Smartphone, Tablet, Wifi, Signal, SignalHigh, SignalLow } from "lucide-react";
import { Badge } from "@/components/ui";
import type { DeviceType } from "@/lib/device";

const DEVICE_CONFIG: Record<
  DeviceType,
  { icon: typeof Smartphone; label: string }
> = {
  mobile: { icon: Smartphone, label: "Mobile" },
  tablet: { icon: Tablet, label: "Tablet" },
  desktop: { icon: Monitor, label: "Desktop" },
};

function ConnectionIcon({ type }: { type: string }) {
  switch (type) {
    case "wifi":
    case "ethernet":
      return <Wifi className="h-3 w-3" />;
    case "5g":
      return <SignalHigh className="h-3 w-3" />;
    case "4g":
      return <Signal className="h-3 w-3" />;
    case "3g":
    case "2g":
    case "slow-2g":
      return <SignalLow className="h-3 w-3" />;
    default:
      return null;
  }
}

export default function DeviceBadge({
  deviceType,
  connectionType,
  className,
}: {
  deviceType: string | null | undefined;
  connectionType?: string | null;
  className?: string;
}) {
  if (!deviceType) {
    return (
      <Badge variant="secondary" className={className}>
        Perangkat?
      </Badge>
    );
  }

  const config = DEVICE_CONFIG[deviceType as DeviceType];
  if (!config) {
    return (
      <Badge variant="secondary" className={className}>
        {deviceType}
      </Badge>
    );
  }

  const { icon: Icon, label } = config;

  return (
    <Badge variant="secondary" className={`inline-flex items-center gap-1 ${className ?? ""}`}>
      <Icon className="h-3 w-3" />
      {label}
      {connectionType && (
        <>
          <span className="opacity-40">·</span>
          <ConnectionIcon type={connectionType} />
        </>
      )}
    </Badge>
  );
}
