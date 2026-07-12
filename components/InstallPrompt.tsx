"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  X,
  Heart,
  Download,
  Share2,
  Smartphone,
  Monitor,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type BrowserType =
  | "chrome"
  | "edge"
  | "opera"
  | "samsung"
  | "firefox"
  | "safari"
  | "unknown";

type PlatformType =
  | "android"
  | "ios"
  | "windows"
  | "macos"
  | "linux"
  | "unknown";

type InstallMethod =
  | "beforeinstallprompt"
  | "ios-add-to-home-screen"
  | "firefox-android"
  | "safari-desktop"
  | "firefox-desktop"
  | "manual"
  | "installed";

const VISIT_KEY = "ndjourney-visit-count";
const MIN_VISITS = 1;
const SHOW_DELAY_MS = 3000;
const BIP_TIMEOUT_MS = 8000;

function detectBrowser(): { browser: BrowserType; platform: PlatformType } {
  if (typeof window === "undefined") {
    return { browser: "unknown", platform: "unknown" };
  }

  const ua = navigator.userAgent;
  const uaLower = ua.toLowerCase();
  const pf = (navigator.platform || "").toLowerCase();

  let platform: PlatformType;
  const isIphone = /iphone/.test(uaLower) || pf === "iphone";
  const isIpad = /ipad/.test(uaLower) || (pf === "macintel" && navigator.maxTouchPoints > 1);
  const isIpod = /ipod/.test(uaLower) || pf === "ipod";

  if (isIphone || isIpad || isIpod) {
    platform = "ios";
  } else if (/android/.test(uaLower)) {
    platform = "android";
  } else if (/win/.test(pf) || /windows/.test(uaLower)) {
    platform = "windows";
  } else if (/mac/.test(uaLower) || /mac/.test(pf)) {
    platform = "macos";
  } else if (/linux/.test(pf) || /linux/.test(uaLower)) {
    platform = "linux";
  } else {
    platform = "unknown";
  }

  let browser: BrowserType;
  if (/edg\/|edga\/|edgios\//.test(uaLower)) {
    browser = "edge";
  } else if (/opr\/|opera/.test(uaLower)) {
    browser = "opera";
  } else if (/samsungbrowser/.test(uaLower)) {
    browser = "samsung";
  } else if (/firefox/.test(uaLower) && !/seamonkey/.test(uaLower)) {
    browser = "firefox";
  } else if (/crios\/|chrome\/|chromium/.test(uaLower)) {
    browser = "chrome";
  } else if (/safari\//.test(uaLower) && !/chrome/.test(uaLower)) {
    browser = "safari";
  } else {
    browser = "unknown";
  }

  return { browser, platform };
}

function getInstallMethod(
  browser: BrowserType,
  platform: PlatformType,
): InstallMethod {
  if (platform === "ios") return "ios-add-to-home-screen";
  if (browser === "firefox" && platform === "android") return "firefox-android";
  if (browser === "firefox" && platform !== "android") return "firefox-desktop";
  if (browser === "safari") return "safari-desktop";

  if (
    browser === "chrome" ||
    browser === "edge" ||
    browser === "opera" ||
    browser === "samsung" ||
    browser === "unknown"
  ) {
    return "beforeinstallprompt";
  }

  return "manual";
}

export default function InstallPrompt() {
  const [mounted, setMounted] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [installMethod, setInstallMethod] =
    useState<InstallMethod>("beforeinstallprompt");
  const [bipReceived, setBipReceived] = useState(false);

  const bipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    setMounted(true);

    localStorage.removeItem("ndjourney-install-dismissed");
    localStorage.removeItem("ndjourney-install-acknowledged");
  }, []);

  const checkStandalone = useCallback((): boolean => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true
    );
  }, []);

  useEffect(() => {
    if (doneRef.current) return;

    if (checkStandalone()) {
      setInstalled(true);
      setInstallMethod("installed");
      doneRef.current = true;
      return;
    }

    const { browser, platform } = detectBrowser();
    const method = getInstallMethod(browser, platform);
    setInstallMethod(method);

    const visits = parseInt(localStorage.getItem(VISIT_KEY) || "0", 10);
    localStorage.setItem(VISIT_KEY, String(visits + 1));

    if (visits < MIN_VISITS - 1) {
      doneRef.current = true;
      return;
    }

    if (method === "beforeinstallprompt") {
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setBipReceived(true);
        if (bipTimeoutRef.current) {
          clearTimeout(bipTimeoutRef.current);
          bipTimeoutRef.current = null;
        }
        showTimeoutRef.current = setTimeout(() => {
          setShowPrompt(true);
          doneRef.current = true;
        }, SHOW_DELAY_MS);
      };

      window.addEventListener("beforeinstallprompt", handler);

      bipTimeoutRef.current = setTimeout(() => {
        if (!bipReceived) {
          setInstallMethod("manual");
          showTimeoutRef.current = setTimeout(() => {
            setShowPrompt(true);
            doneRef.current = true;
          }, SHOW_DELAY_MS);
        }
      }, BIP_TIMEOUT_MS);

      return () => {
        window.removeEventListener("beforeinstallprompt", handler);
        if (bipTimeoutRef.current) clearTimeout(bipTimeoutRef.current);
        if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      };
    }

    showTimeoutRef.current = setTimeout(() => {
      setShowPrompt(true);
      doneRef.current = true;
    }, SHOW_DELAY_MS);

    return () => {
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
    };
  }, [checkStandalone, bipReceived]);

  useEffect(() => {
    const handleAppInstalled = () => {
      setInstalled(true);
      setInstallMethod("installed");
      setShowPrompt(false);
      setDeferredPrompt(null);
    };
    window.addEventListener("appinstalled", handleAppInstalled);
    return () =>
      window.removeEventListener("appinstalled", handleAppInstalled);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setInstalled(true);
        setInstallMethod("installed");
      }
    } catch {
      // user cancelled or prompt failed
    }
    setDeferredPrompt(null);
    setShowPrompt(false);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowPrompt(false);
  }, []);

  const handleAcknowledge = useCallback(() => {
    setShowPrompt(false);
  }, []);

  if (!mounted || installed || !showPrompt) return null;

  return (
    <AnimatePresence>
      {showPrompt && (
        <InstallPromptContent
          key="install-prompt"
          method={installMethod}
          onInstall={handleInstall}
          onDismiss={handleDismiss}
          onAcknowledge={handleAcknowledge}
          hasDeferredPrompt={!!deferredPrompt}
        />
      )}
    </AnimatePresence>
  );
}

function InstallPromptContent({
  method,
  onInstall,
  onDismiss,
  onAcknowledge,
  hasDeferredPrompt,
}: {
  method: InstallMethod;
  onInstall: () => void;
  onDismiss: () => void;
  onAcknowledge: () => void;
  hasDeferredPrompt: boolean;
}) {
  const content = getPromptContent(method);

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-sm md:bottom-6 md:left-auto md:right-6 md:inset-x-auto lg:bottom-6"
    >
      <div className="relative rounded-2xl border border-border bg-card p-5 shadow-xl">
        <button
          onClick={onDismiss}
          className="absolute right-3 top-3 rounded-full p-1 transition-colors hover:bg-muted"
          aria-label="Tutup"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            {content.icon}
          </div>
          <div className="min-w-0 flex-1 pr-4">
            <p className="text-sm font-medium">{content.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {content.description}
            </p>
            {content.illustration && (
              <div className="mt-3">{content.illustration}</div>
            )}
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={onDismiss}
            className="flex-1 rounded-xl border border-border px-3 py-2.5 text-xs font-medium transition-colors hover:bg-muted"
          >
            {content.dismissLabel}
          </button>
          {method === "beforeinstallprompt" && hasDeferredPrompt ? (
            <button
              onClick={onInstall}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Download className="h-3.5 w-3.5" />
              {content.primaryLabel}
            </button>
          ) : (
            <button
              onClick={onAcknowledge}
              className="flex-1 rounded-xl bg-primary px-3 py-2.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {content.primaryLabel}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function getPromptContent(method: InstallMethod): {
  icon: React.ReactNode;
  title: string;
  description: string;
  primaryLabel: string;
  dismissLabel: string;
  illustration?: React.ReactNode;
} {
  switch (method) {
    case "beforeinstallprompt":
      return {
        icon: <Heart className="h-5 w-5 fill-primary text-primary" />,
        title: "Install ndjourney",
        description:
          "Pasang aplikasi untuk akses cepat ke cerita cinta kalian",
        primaryLabel: "Install",
        dismissLabel: "Nanti",
      };

    case "ios-add-to-home-screen":
      return {
        icon: <Share2 className="h-5 w-5 fill-primary text-primary" />,
        title: "Install ndjourney",
        description:
          "Tekan tombol Share di Safari, lalu pilih \"Add to Home Screen\".",
        primaryLabel: "Saya mengerti",
        dismissLabel: "Tutup",
        illustration: <IosShareGuide />,
      };

    case "firefox-android":
      return {
        icon: <Smartphone className="h-5 w-5 text-primary" />,
        title: "Install ndjourney",
        description:
          "Buka menu (⋮) di Firefox, lalu pilih \"Install\" atau \"Add to Home Screen\".",
        primaryLabel: "Saya mengerti",
        dismissLabel: "Tutup",
      };

    case "safari-desktop":
      return {
        icon: <Monitor className="h-5 w-5 text-primary" />,
        title: "Install ndjourney",
        description:
          "Safari desktop belum mendukung install aplikasi. Buka dengan Chrome atau Edge untuk bisa menginstall.",
        primaryLabel: "Saya mengerti",
        dismissLabel: "Tutup",
      };

    case "firefox-desktop":
      return {
        icon: <Monitor className="h-5 w-5 text-primary" />,
        title: "Install ndjourney",
        description:
          "Firefox desktop belum mendukung install aplikasi. Buka dengan Chrome atau Edge untuk bisa menginstall.",
        primaryLabel: "Saya mengerti",
        dismissLabel: "Tutup",
      };

    case "manual":
      return {
        icon: <Download className="h-5 w-5 text-primary" />,
        title: "Install ndjourney",
        description:
          "Klik ikon Install di address bar browser kamu, atau buka menu browser lalu pilih \"Install ndjourney\".",
        primaryLabel: "Saya mengerti",
        dismissLabel: "Tutup",
      };

    default:
      return {
        icon: <Heart className="h-5 w-5 text-primary" />,
        title: "Install ndjourney",
        description: "Pasang aplikasi untuk akses cepat.",
        primaryLabel: "OK",
        dismissLabel: "Tutup",
      };
  }
}

function IosShareGuide() {
  return (
    <div className="flex items-center justify-center gap-3 rounded-lg border border-border bg-muted/50 p-3">
      <div className="flex flex-col items-center gap-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Share2 className="h-4 w-4 text-primary" />
        </div>
        <span className="text-[10px] text-muted-foreground">Share</span>
      </div>
      <motion.div
        animate={{ x: [0, 4, 0] }}
        transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
        className="text-muted-foreground"
      >
        →
      </motion.div>
      <div className="flex flex-col items-center gap-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 text-primary"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.5L8.5 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
          </svg>
        </div>
        <span className="text-[10px] text-muted-foreground">Safari</span>
      </div>
      <motion.div
        animate={{ x: [0, 4, 0] }}
        transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
        className="text-muted-foreground"
      >
        →
      </motion.div>
      <div className="flex flex-col items-center gap-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 text-primary"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3v12" />
            <path d="m8 11 4 4 4-4" />
            <path d="M4 20h16" />
            <path d="M4 16h16" />
          </svg>
        </div>
        <span className="text-[10px] text-muted-foreground">Add</span>
      </div>
    </div>
  );
}
