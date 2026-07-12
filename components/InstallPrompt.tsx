"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { X, Heart, Download, Share2, Smartphone, Monitor, Globe } from "lucide-react";
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
  | "ipados"
  | "windows"
  | "macos"
  | "linux"
  | "unknown";

type InstallMethod =
  | "beforeinstallprompt"
  | "ios-add-to-home-screen"
  | "ipados-add-to-home-screen"
  | "firefox-android"
  | "safari-desktop"
  | "firefox-desktop"
  | "chrome-desktop"
  | "edge-desktop"
  | "manual"
  | "installed"
  | "unsupported";

const VISIT_KEY = "ndjourney-visit-count";
const MAX_DISMISSES = 3;
const DISMISS_KEY = "ndjourney-install-dismiss-count";

function detectPlatform(): PlatformType {
  if (typeof window === "undefined") return "unknown";

  const ua = navigator.userAgent.toLowerCase();
  const pf = (navigator.platform || "").toLowerCase();

  const isIphone = /iphone/.test(ua) || pf === "iphone";
  const isIpad = /ipad/.test(ua) || (pf === "macintel" && navigator.maxTouchPoints > 1);
  const isIpod = /ipod/.test(ua) || pf === "ipod";

  if (isIphone || isIpod) return "ios";
  if (isIpad) return "ipados";
  if (/android/.test(ua)) return "android";
  if (/win/.test(pf) || /windows/.test(ua)) return "windows";
  if (/mac/.test(ua) || /mac/.test(pf)) return "macos";
  if (/linux/.test(pf) || /linux/.test(ua)) return "linux";

  return "unknown";
}

function detectBrowser(): BrowserType {
  if (typeof window === "undefined") return "unknown";

  const ua = navigator.userAgent.toLowerCase();

  if (/edg\/|edga\/|edgios\//.test(ua)) return "edge";
  if (/opr\/|opera/.test(ua)) return "opera";
  if (/samsungbrowser/.test(ua)) return "samsung";
  if (/firefox/.test(ua) && !/seamonkey/.test(ua)) return "firefox";
  if (/crios\/|chrome\/|chromium/.test(ua)) return "chrome";
  if (/safari\//.test(ua) && !/chrome/.test(ua)) return "safari";

  return "unknown";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
}

function isIPadOS(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  const pf = (navigator.platform || "").toLowerCase();
  return /ipad/.test(ua) || (pf === "macintel" && navigator.maxTouchPoints > 1);
}

function isAndroid(): boolean {
  return /android/.test(navigator.userAgent.toLowerCase());
}

function isFirefox(): boolean {
  return /firefox/.test(navigator.userAgent.toLowerCase()) && !/seamonkey/.test(navigator.userAgent.toLowerCase());
}

function isSafari(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  return /safari\//.test(ua) && !/chrome/.test(ua);
}

function getDismissCount(): number {
  return parseInt(localStorage.getItem(DISMISS_KEY) || "0", 10);
}

function incrementDismissCount(): void {
  const count = getDismissCount() + 1;
  localStorage.setItem(DISMISS_KEY, String(count));
}

function resetDismissCount(): void {
  localStorage.removeItem(DISMISS_KEY);
}

function getInstallMethod(
  browser: BrowserType,
  platform: PlatformType,
  hasBeforeInstallPrompt: boolean,
): InstallMethod {
  // Check iOS/iPadOS first - these platforms never use beforeinstallprompt
  if (platform === "ios") return "ios-add-to-home-screen";
  if (platform === "ipados") return "ipados-add-to-home-screen";

  // Firefox on Android supports beforeinstallprompt, desktop Firefox doesn't
  if (browser === "firefox" && platform === "android") return "firefox-android";
  if (browser === "firefox" && platform !== "android") return "firefox-desktop";

  // Safari on desktop (macOS) doesn't support PWA installation
  if (browser === "safari" && (platform === "macos" || platform === "windows" || platform === "linux" || platform === "unknown")) return "safari-desktop";

  // Chrome/Edge on desktop
  if (browser === "chrome" && (platform === "windows" || platform === "macos" || platform === "linux")) return "chrome-desktop";
  if (browser === "edge" && (platform === "windows" || platform === "macos" || platform === "linux")) return "edge-desktop";

  // For other browsers on Android/desktop, check for beforeinstallprompt
  if (
    browser === "chrome" ||
    browser === "edge" ||
    browser === "opera" ||
    browser === "samsung" ||
    browser === "unknown"
  ) {
    return hasBeforeInstallPrompt ? "beforeinstallprompt" : "manual";
  }

  return "manual";
}

function shouldShowPrompt(method: InstallMethod, dismissCount: number): boolean {
  if (method === "installed" || method === "unsupported") return false;
  if (dismissCount >= MAX_DISMISSES) return false;
  return true;
}

export default function InstallPrompt() {
  const [mounted, setMounted] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [installMethod, setInstallMethod] = useState<InstallMethod>("manual");
  const [hasBeforeInstallPrompt, setHasBeforeInstallPrompt] = useState(false);
  const [isStandaloneMode, setIsStandaloneMode] = useState(false);
  const [dismissCount, setDismissCount] = useState(0);

  const bipHandlerRef = useRef<((e: Event) => void) | null>(null);
  const doneRef = useRef(false);

  const checkAndUpdateStandalone = useCallback(() => {
    const standalone = isStandalone();
    setIsStandaloneMode(standalone);
    return standalone;
  }, []);

  useEffect(() => {
    setMounted(true);
    setIsStandaloneMode(isStandalone());
    setDismissCount(getDismissCount());
  }, []);

  useEffect(() => {
    if (doneRef.current) return;

    if (checkAndUpdateStandalone()) {
      setInstalled(true);
      setInstallMethod("installed");
      doneRef.current = true;
      return;
    }

    const platform = detectPlatform();
    const browser = detectBrowser();

    const supportsBeforeInstallPrompt =
      "onbeforeinstallprompt" in window &&
      (browser === "chrome" ||
        browser === "edge" ||
        browser === "opera" ||
        browser === "samsung");

    const method = getInstallMethod(browser, platform, supportsBeforeInstallPrompt);
    setInstallMethod(method);

    const visits = parseInt(localStorage.getItem(VISIT_KEY) || "0", 10);
    localStorage.setItem(VISIT_KEY, String(visits + 1));

    if (!shouldShowPrompt(method, dismissCount)) {
      doneRef.current = true;
      return;
    }

    if (method === "beforeinstallprompt" && supportsBeforeInstallPrompt) {
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setHasBeforeInstallPrompt(true);
        setShowPrompt(true);
        doneRef.current = true;
      };

      bipHandlerRef.current = handler;
      window.addEventListener("beforeinstallprompt", handler);

      return () => {
        if (bipHandlerRef.current) {
          window.removeEventListener("beforeinstallprompt", bipHandlerRef.current);
          bipHandlerRef.current = null;
        }
      };
    }

    setShowPrompt(true);
    doneRef.current = true;

    return () => {};
  }, [checkAndUpdateStandalone, dismissCount]);

  useEffect(() => {
    const handleAppInstalled = () => {
      setInstalled(true);
      setInstallMethod("installed");
      setShowPrompt(false);
      setDeferredPrompt(null);
      resetDismissCount();
    };
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => window.removeEventListener("appinstalled", handleAppInstalled);
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
    incrementDismissCount();
    setDismissCount(getDismissCount());
    setShowPrompt(false);
  }, []);

  const handleAcknowledge = useCallback(() => {
    setShowPrompt(false);
  }, []);

  if (!mounted || installed || isStandaloneMode || !showPrompt) return null;
  if (!shouldShowPrompt(installMethod, dismissCount)) return null;

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
          platform={detectPlatform()}
          browser={detectBrowser()}
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
  platform,
  browser,
}: {
  method: InstallMethod;
  onInstall: () => void;
  onDismiss: () => void;
  onAcknowledge: () => void;
  hasDeferredPrompt: boolean;
  platform: PlatformType;
  browser: BrowserType;
}) {
  const content = getPromptContent(method, platform, browser, hasDeferredPrompt);

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

function getPromptContent(
  method: InstallMethod,
  platform: PlatformType,
  browser: BrowserType,
  hasDeferredPrompt: boolean,
): {
  icon: React.ReactNode;
  title: string;
  description: string;
  primaryLabel: string;
  dismissLabel: string;
  illustration?: React.ReactNode;
} {
  const isMobile = platform === "android" || platform === "ios" || platform === "ipados";
  const isDesktop = platform === "windows" || platform === "macos" || platform === "linux";

  switch (method) {
    case "beforeinstallprompt":
      return {
        icon: <Heart className="h-5 w-5 fill-primary text-primary" />,
        title: isMobile ? "Pasang ndjourney" : "Install ndjourney",
        description: isMobile
          ? "Pasang aplikasi untuk akses cepat ke cerita cinta kalian"
          : "Install aplikasi untuk akses cepat dan penggunaan offline",
        primaryLabel: "Install",
        dismissLabel: "Nanti",
      };

    case "ios-add-to-home-screen":
      return {
        icon: <Share2 className="h-5 w-5 fill-primary text-primary" />,
        title: "Pasang ndjourney di iPhone",
        description:
          "Tekan tombol Share (📤) di Safari, gulir ke bawah, lalu pilih \"Tambah ke Layar Utama\".",
        primaryLabel: "Saya mengerti",
        dismissLabel: "Tutup",
        illustration: <IosShareGuide device="iPhone" />,
      };

    case "ipados-add-to-home-screen":
      return {
        icon: <Share2 className="h-5 w-5 fill-primary text-primary" />,
        title: "Pasang ndjourney di iPad",
        description:
          "Tekan tombol Share (📤) di Safari, lalu pilih \"Tambah ke Layar Utama\". Di iPadOS juga bisa via menu ⋮ > \"Tambah ke Layar Utama\".",
        primaryLabel: "Saya mengerti",
        dismissLabel: "Tutup",
        illustration: <IosShareGuide device="iPad" />,
      };

    case "firefox-android":
      return {
        icon: <Smartphone className="h-5 w-5 text-primary" />,
        title: "Pasang ndjourney di Firefox Android",
        description:
          "Buka menu (⋮) di Firefox, pilih \"Pasang\" atau \"Tambah ke Layar Utama\".",
        primaryLabel: "Saya mengerti",
        dismissLabel: "Tutup",
      };

    case "safari-desktop":
      return {
        icon: <Monitor className="h-5 w-5 text-primary" />,
        title: "Gunakan Chrome atau Edge",
        description:
          "Safari di macOS belum mendukung instalasi PWA. Buka situs ini di Chrome atau Edge untuk memasang aplikasi.",
        primaryLabel: "Saya mengerti",
        dismissLabel: "Tutup",
      };

    case "firefox-desktop":
      return {
        icon: <Globe className="h-5 w-5 text-primary" />,
        title: "Gunakan Chrome atau Edge",
        description:
          "Firefox desktop tidak mendukung instalasi PWA. Buka di Chrome atau Edge untuk memasang.",
        primaryLabel: "Saya mengerti",
        dismissLabel: "Tutup",
      };

    case "chrome-desktop":
      return {
        icon: <Monitor className="h-5 w-5 text-primary" />,
        title: "Install ndjourney di Chrome",
        description:
          "Klik ikon install di address bar, atau menu -> \"Install ndjourney\".",
        primaryLabel: "Saya mengerti",
        dismissLabel: "Tutup",
      };

    case "edge-desktop":
      return {
        icon: <Globe className="h-5 w-5 text-primary" />,
        title: "Install ndjourney di Edge",
        description:
          "Klik ikon install di address bar, atau menu -> Apps -> \"Install ndjourney\".",
        primaryLabel: "Saya mengerti",
        dismissLabel: "Tutup",
      };

    case "manual":
      const isIpadDevice = platform === "ipados";
      if (isAndroid()) {
        return {
          icon: <Download className="h-5 w-5 text-primary" />,
          title: "Pasang ndjourney",
          description:
            "Buka menu browser (⋮) > \"Install app\" atau \"Tambah ke Layar Utama\". Di Chrome: ikon Install di address bar.",
          primaryLabel: "Saya mengerti",
          dismissLabel: "Tutup",
        };
      }
      if (isIOS()) {
        return {
          icon: <Share2 className="h-5 w-5 fill-primary text-primary" />,
          title: "Pasang ndjourney",
          description:
            "Tekan Share (📤) di Safari > \"Tambah ke Layar Utama\".",
          primaryLabel: "Saya mengerti",
          dismissLabel: "Tutup",
        };
      }
      return {
        icon: <Download className="h-5 w-5 text-primary" />,
        title: "Install ndjourney",
        description:
          "Klik ikon Install di address bar, atau buka menu browser > \"Install\".",
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

function IosShareGuide({ device }: { device: "iPhone" | "iPad" }) {
  const isIpad = device === "iPad";

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
        <span className="text-[10px] text-muted-foreground">
          {isIpad ? "Add to Home Screen" : "Tambah ke Layar Utama"}
        </span>
      </div>
    </div>
  );
}