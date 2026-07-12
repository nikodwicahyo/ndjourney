"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function PwaRegister() {
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => {
          for (const reg of regs) {
            reg.unregister();
          }
        });

      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          setRegistered(true);

          registration.addEventListener("updatefound", () => {
            const installing = registration.installing;
            if (installing) {
              installing.addEventListener("statechange", () => {
                if (
                  installing.state === "installed" &&
                  navigator.serviceWorker.controller
                ) {
                  toast.success("Aplikasi siap digunakan offline! 💕", {
                    duration: 5000,
                  });
                }
              });
            }
          });
        })
        .catch(() => {
          // Silently ignore — service worker is non-critical
        });
    }
  }, []);

  return null;
}
