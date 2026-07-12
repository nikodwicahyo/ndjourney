"use client";

import { useEffect, useRef } from "react";
import { Workbox } from "workbox-window";
import { toast } from "sonner";

export default function PwaRegister() {
  const wbRef = useRef<Workbox | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const wb = new Workbox("/sw.js");
    wbRef.current = wb;

    wb.addEventListener("waiting", () => {
      toast.info("Update tersedia — memuat ulang...", {
        duration: 5000,
        id: "pwa-update",
      });
    });

    wb.addEventListener("controlling", () => {
      window.location.reload();
    });

    wb.addEventListener("installed", (event) => {
      if (!event.isUpdate) {
        toast.success("Aplikasi siap digunakan offline! 💕", {
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