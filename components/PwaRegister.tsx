"use client";

import { useEffect, useRef } from "react";
import { Workbox } from "workbox-window";
import { toast } from "sonner";
import { useAppVersion } from "@/hooks/useAppVersion";

export default function PwaRegister() {
  const wbRef = useRef<Workbox | null>(null);
  // Poll version.json and auto-apply app-code deployments (clears caches +
  // reloads) without requiring the user to click anything.
  useAppVersion();

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const wb = new Workbox("/sw.js");
    wbRef.current = wb;

    // Tracks whether a genuine SW update is in flight, so we only reload when
    // the new worker actually takes control (never on first install).
    let updatePending = false;

    wb.addEventListener("waiting", () => {
      // A new service worker is installed and waiting: tell it to skip waiting
      // so it takes control immediately and the app updates automatically.
      updatePending = true;
      wb.messageSW({ type: "SKIP_WAITING" });
    });

    wb.addEventListener("controlling", () => {
      // The new service worker now controls the page — clear caches and reload
      // so the freshly deployed assets are served. Only on a real update.
      if (!updatePending) return;
      wb.messageSW({ type: "CLEAR_CACHES" });
      window.location.reload();
    });

    wb.addEventListener("installed", (event) => {
      if (!event.isUpdate) {
        toast.success("Aplikasi siap digunakan! 💕", {
          duration: 5000,
          id: "pwa-installed",
        });
      }
    });

    wb.register().catch((err) => {
      console.warn("Service worker registration failed:", err);
    });

    return () => {
      // cleanup handled by Workbox
    };
  }, []);

  return null;
}
