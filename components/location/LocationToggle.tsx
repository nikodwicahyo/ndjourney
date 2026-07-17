"use client";

import { useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import { useToggleShare } from "@/hooks/useLocation";

export default function LocationToggle({
  isSharing,
  disabled,
}: {
  isSharing: boolean;
  disabled?: boolean;
}) {
  const toggle = useToggleShare();
  const [showConfirm, setShowConfirm] = useState(false);

  if (showConfirm && isSharing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          Hentikan berbagi?
        </span>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={() => {
            toggle.mutate(false);
            setShowConfirm(false);
          }}
          disabled={toggle.isPending}
        >
          {toggle.isPending ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : null}
          Ya
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowConfirm(false)}
        >
          Batal
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant={isSharing ? "default" : "outline"}
      onClick={() => {
        if (isSharing) {
          setShowConfirm(true);
        } else {
          toggle.mutate(true);
        }
      }}
      disabled={disabled || toggle.isPending}
      className={`w-full sm:w-auto ${!isSharing ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white" : ""}`}
    >
      {toggle.isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <MapPin className="mr-2 h-4 w-4" />
      )}
      {isSharing ? "Hentikan Berbagi" : "Mulai Berbagi Lokasi"}
    </Button>
  );
}
