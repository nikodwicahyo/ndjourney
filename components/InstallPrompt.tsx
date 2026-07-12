"use client";

import { useEffect, useState, useCallback } from "react";
import { X, Heart, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const VISIT_KEY = "ndjourney-visit-count";
const DISMISSED_KEY = "ndjourney-install-dismissed";

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isStandalone = useCallback(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true
    );
  }, []);

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      const visits = parseInt(localStorage.getItem(VISIT_KEY) || "0", 10);
      localStorage.setItem(VISIT_KEY, String(visits + 1));

      const dismissed = localStorage.getItem(DISMISSED_KEY);
      if (visits >= 1 && !dismissed) {
        setTimeout(() => setShowPrompt(true), 3000);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [isStandalone]);

  useEffect(() => {
    const handleAppInstalled = () => {
      setInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => window.removeEventListener("appinstalled", handleAppInstalled);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setInstalled(true);
    }
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setShowPrompt(false);
  };

  if (!mounted || installed || !showPrompt) return null;

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm lg:bottom-6 lg:left-auto lg:right-6 lg:inset-x-auto"
        >
          <div className="relative rounded-2xl border border-border bg-card p-4 shadow-xl">
            <button
              onClick={handleDismiss}
              className="absolute right-3 top-3 rounded-full p-1 transition-colors hover:bg-muted"
              aria-label="Tutup"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Heart className="h-5 w-5 fill-primary text-primary" />
              </div>
              <div className="min-w-0 flex-1 pr-4">
                <p className="text-sm font-medium">Install ndjourney</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Pasang aplikasi untuk akses cepat ke cerita cinta kalian
                </p>
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                onClick={handleDismiss}
                className="flex-1 rounded-xl border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-muted"
              >
                Nanti
              </button>
              <button
                onClick={handleInstall}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Download className="h-3.5 w-3.5" />
                Install
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
