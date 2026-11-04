"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  getPushState,
  isPushSubscribed,
  subscribePush,
  unsubscribePush,
  type PushState,
} from "@/lib/push-client";

/** Browser-push row for the settings page. */
export default function PushSettingsToggle() {
  const [state, setState] = useState<PushState | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setState(getPushState());
    // Permission stays "granted" after unsubscribing — ask the device.
    void isPushSubscribed().then(setEnabled);
  }, []);

  if (!state || state === "unsupported") return null;

  const blocked = state === "denied" || state === "a2hs-required";

  const hint =
    state === "denied"
      ? "Izinkan notifikasi di pengaturan browser."
      : state === "a2hs-required"
        ? "Tambahkan aplikasi ke Layar Utama (Add to Home Screen) terlebih dahulu."
        : enabled
          ? "Notifikasi aktif di perangkat ini."
          : "Aktifkan agar kamu dapat kabar baru dari pasanganmu.";

  async function toggle() {
    if (busy || blocked) return;
    setBusy(true);
    try {
      if (enabled) {
        await unsubscribePush();
        setEnabled(false);
      } else {
        setEnabled(await subscribePush());
      }
    } finally {
      setBusy(false);
      setState(getPushState());
    }
  }

  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-card p-4">
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium">Notifikasi Browser</p>
        <p className="text-xs text-muted-foreground">
          {busy ? "Menyimpan..." : hint}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Notifikasi browser"
        disabled={busy || blocked}
        onClick={toggle}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
          enabled ? "bg-primary" : "bg-input",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-background transition-transform",
            enabled ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}
