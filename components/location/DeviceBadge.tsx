"use client";

import { Monitor, Smartphone, Tablet, HelpCircle, Wifi, Signal, SignalHigh, SignalLow } from "lucide-react";
import { Badge } from "@/components/ui";
import type { DeviceType } from "@/lib/device";

const DEVICE_CONFIG: Record<
  DeviceType,
  { icon: typeof Smartphone }
> = {
  mobile: { icon: Smartphone },
  tablet: { icon: Tablet },
  desktop: { icon: Monitor },
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
        <HelpCircle className="h-3 w-3" />
      </Badge>
    );
  }

  const config = DEVICE_CONFIG[deviceType as DeviceType];
  if (!config) {
    return (
      <Badge variant="secondary" className={className}>
        <Monitor className="h-3 w-3" />
      </Badge>
    );
  }

  const { icon: Icon } = config;

  return (
    <Badge variant="secondary" className={`inline-flex items-center gap-1 ${className ?? ""}`}>
      <Icon className="h-3 w-3" />
      {connectionType && (
        <>
          <ConnectionIcon type={connectionType} />
        </>
      )}
    </Badge>
  );
}
