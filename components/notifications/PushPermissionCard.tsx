"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { getPushState, subscribePush, type PushState } from "@/lib/push-client";

const DISMISS_KEY = "push-card-dismissed-v1";

/** One-time nudge to enable push. Mount near the dashboard/notifications area. */
export default function PushPermissionCard() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return;
    setState(getPushState());
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setState(null);
  }

  async function enable() {
    setBusy(true);
    setFailed(false);
    try {
      // Permission can report "granted" while the subscription/POST failed —
      // derive the card's state from the result, not from the permission alone.
      if (await subscribePush()) {
        setState(getPushState());
      } else {
        setFailed(true);
      }
    } finally {
      setBusy(false);
    }
  }

  if (state !== "default" && state !== "a2hs-required") return null;

  const needsA2HS = state === "a2hs-required";

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <Bell className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-medium">Aktifkan notifikasi</p>
          <p className="text-sm text-muted-foreground">
            {failed
              ? "Gagal mengaktifkan notifikasi. Coba lagi."
              : needsA2HS
                ? "Tambahkan aplikasi ini ke Layar Utama (Add to Home Screen) terlebih dahulu untuk mengaktifkan notifikasi."
                : "Dapatkan kabar baru dari pasanganmu tanpa harus membuka aplikasi."}
          </p>
          <div className="flex flex-wrap gap-2">
            {!needsA2HS && (
              <Button size="sm" onClick={enable} disabled={busy}>
                {busy ? "Mengaktifkan..." : "Aktifkan"}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={dismiss}>
              {needsA2HS ? "Mengerti" : "Nanti saja"}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
