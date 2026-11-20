"use client";

import { useState } from "react";
import { BatteryCharging, BellRing, MapPin, Settings2 } from "lucide-react";
import { Button } from "@/components/ui";
import { useMounted } from "@/hooks/useMounted";
import { getNativePlatform } from "@/lib/location/platform";
import { openNativeSetting, type NativeSetting } from "@/lib/location/engine-native";

const ROWS: Array<{
  key: NativeSetting;
  icon: typeof MapPin;
  title: string;
  body: string;
}> = [
  {
    key: "location",
    icon: MapPin,
    title: "Izin lokasi",
    body: "Pilih 'Izinkan sepanjang aplikasi digunakan' agar posisi tetap dikirim saat layar mati.",
  },
  {
    key: "notifications",
    icon: BellRing,
    title: "Notifikasi",
    body: "Notifikasi yang terlihat menandakan layanan lokasi latar belakang masih aktif.",
  },
  {
    key: "battery",
    icon: BatteryCharging,
    title: "Optimasi baterai",
    body: "Kecualikan aplikasi dari optimasi agar Android tidak menjeda pengiriman lokasi.",
  },
  {
    key: "app",
    icon: Settings2,
    title: "Semua izin",
    body: "Buka halaman pengaturan aplikasi jika izin di atas tidak tersedia di perangkatmu.",
  },
];

/** Native-only: Android cannot re-prompt background permission from the app. */
export default function NativePermissionGuide() {
  const mounted = useMounted();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<NativeSetting | null>(null);

  if (!mounted || !getNativePlatform()) return null;
  const isIos = getNativePlatform() === "ios";

  async function open(setting: NativeSetting) {
    setBusy(setting);
    setError("");
    try {
      await openNativeSetting(setting);
    } catch {
      setError("Tidak dapat membuka pengaturan. Buka Pengaturan HP secara manual.");
    } finally {
      setBusy(null);
    }
  }

  const rows = isIos ? ROWS.filter((row) => row.key === "location" || row.key === "app") : ROWS;

  return (
    <section className="mb-8 w-full max-w-xl rounded-2xl border border-border bg-card p-5">
      <h2 className="font-heading text-lg">Izin lokasi di HP</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Berbagi lokasi hanya berjalan di background jika izin ini aktif.
      </p>
      <div className="mt-4 space-y-3">
        {rows.map(({ key, icon: Icon, title, body }) => (
          <div key={key} className="flex items-start gap-3 rounded-xl bg-muted/40 p-3">
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void open(key)} disabled={busy !== null}>
              {busy === key ? "…" : "Buka"}
            </Button>
          </div>
        ))}
      </div>
      {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
