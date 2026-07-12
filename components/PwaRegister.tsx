"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

const SW_URL = "/sw.js";
const SW_SCOPE = "/";

export default function PwaRegister() {
  const registered = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") return;
    if (!("serviceWorker" in navigator)) return;
    if (registered.current) return;

    registered.current = true;

    const registerSW = async () => {
      try {
        const existing = await navigator.serviceWorker.getRegistration(SW_SCOPE);

        if (existing && existing.active) {
          await existing.update();
          return;
        }

        const registration = await navigator.serviceWorker.register(SW_URL, {
          scope: SW_SCOPE,
          updateViaCache: "none",
        });

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;

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
        });
      } catch {
        // Silently ignore — service worker is non-critical
      }
    };

    registerSW();

    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }, []);

  return null;
}
