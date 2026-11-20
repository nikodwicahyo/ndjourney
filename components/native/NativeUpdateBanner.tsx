"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui";
import { useMounted } from "@/hooks/useMounted";
import { getNativePlatform } from "@/lib/location/platform";
import { getInstalledBuild, onNativeResume } from "@/lib/native/app-info";
import { openExternalUrl } from "@/lib/native/open-apk";
import {
  isNewerBuild,
  NATIVE_REPO,
  normalizeBuild,
  parseRelease,
  type NativeRelease,
} from "@/lib/native/version";

const SKIP_KEY = "native-update-skipped-build";

function readSkipped(): number {
  try {
    return normalizeBuild(window.localStorage.getItem(SKIP_KEY));
  } catch {
    return 0;
  }
}

/** Android-only, non-modal: tells an installed APK when CI published a newer build. */
export default function NativeUpdateBanner() {
  const mounted = useMounted();
  const [release, setRelease] = useState<NativeRelease | null>(null);

  useEffect(() => {
    if (!mounted || getNativePlatform() !== "android") return;
    let active = true;
    let removeResume: (() => void) | undefined;

    async function check() {
      try {
        const [res, installed] = await Promise.all([
          fetch("/api/native/version", {
            cache: "no-store",
            // Older Android WebViews lack AbortSignal.timeout.
            signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(5000) : undefined,
          }),
          getInstalledBuild(),
        ]);
        if (!active || !res.ok) return;
        const body = (await res.json()) as { data?: unknown };
        const latest = parseRelease(body?.data, NATIVE_REPO);
        if (latest && isNewerBuild(installed, latest.build) && latest.build !== readSkipped()) {
          setRelease(latest);
        } else {
          setRelease(null);
        }
      } catch {
        // Offline / GitHub hiccup: never block the app for an update check.
        if (active) setRelease(null);
      }
    }

    void check();
    void onNativeResume(() => void check()).then((remove) => {
      if (active) removeResume = remove;
      else remove();
    });

    return () => {
      active = false;
      removeResume?.();
    };
  }, [mounted]);

  if (!release) return null;

  function update() {
    // Capacitor v8's WebViewClient turns an external navigation into an OS
    // intent. `window.open(..., "_system")` is a no-op on modern Capacitor and
    // returns null even on success, so navigate directly — one reliable path.
    openExternalUrl(release!.apkUrl);
  }

  function skip() {
    try {
      window.localStorage.setItem(SKIP_KEY, String(release!.build));
    } catch {
      // Storage can be disabled; hiding for this session is still correct.
    }
    setRelease(null);
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] z-40 mx-auto max-w-md rounded-xl border border-border bg-card p-3 shadow-lg lg:inset-x-auto lg:bottom-4 lg:right-6 lg:ml-auto"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-balance">Versi baru tersedia</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Build {release.build} sudah dirilis. Ketuk untuk mengunduh dan memasang pembaruan.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" className="min-h-11" onClick={update}>
              <Download aria-hidden="true" className="mr-1.5 h-4 w-4" />
              Unduh &amp; perbarui
            </Button>
            <Button type="button" size="sm" variant="ghost" className="min-h-11" onClick={skip}>
              Lewati versi ini
            </Button>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Tutup notifikasi pembaruan"
          className="min-h-11 min-w-11"
          onClick={() => setRelease(null)}
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
