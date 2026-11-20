"use client";

import { useSyncExternalStore, useState } from "react";
import Link from "next/link";
import { Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui";
import { isNativePlatform } from "@/lib/location/platform";
import { noopSubscribe } from "@/lib/native/store";

const DISMISS_KEY = "install-banner-dismissed";

type Mobile = "android" | "ios";

function detectMobile(): Mobile | null {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  return null;
}

function isInstalledPwa(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function snapshot(): Mobile | null {
  if (isNativePlatform() || isInstalledPwa()) return null;
  try {
    if (window.localStorage.getItem(DISMISS_KEY) === "1") return null;
  } catch {
    // Storage disabled: still show the hint for this visit.
  }
  // iOS is already covered by the existing global InstallPrompt (Add to Home
  // Screen). This banner exists only to surface the Android APK path.
  return detectMobile() === "android" ? "android" : null;
}

/** Small, dismissible mobile hint. Never a redirect or a blocking modal. */
export default function SmartInstallBanner() {
  const detected = useSyncExternalStore(noopSubscribe, snapshot, () => null);
  const [dismissed, setDismissed] = useState(false);
  const mobile = dismissed ? null : detected;

  if (!mobile) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Ignore — dismissal only needs to last this session.
    }
    setDismissed(true);
  }

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] z-30 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-lg lg:hidden"
    >
      <Smartphone aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {mobile === "android" ? "Pasang aplikasi NDjourney" : "Tambahkan NDjourney ke layar utama"}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {mobile === "android"
            ? "Lokasi tetap terkirim walau layar mati."
            : "Akses lebih cepat, tetap dengan fitur yang sama."}
        </p>
      </div>
      <Link
        href="/get-app"
        className="inline-flex min-h-11 shrink-0 items-center px-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Caranya
      </Link>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Tutup petunjuk pemasangan"
        className="min-h-11 min-w-11 shrink-0"
        onClick={dismiss}
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </Button>
    </div>
  );
}
