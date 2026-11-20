"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui";
import { noopSubscribe } from "@/lib/native/store";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type InstallableNavigator = Navigator & { install?: () => Promise<void> };

const supportsInstallApi = (): boolean =>
  typeof (Navigator.prototype as InstallableNavigator).install === "function";

/**
 * Explicit desktop PWA install control. Hidden unless the browser exposes a
 * real install path — browsers with no install API get manual instructions from
 * the existing global InstallPrompt instead of a dead button.
 */
export default function PwaInstallButton() {
  const canUseInstallApi = useSyncExternalStore(noopSubscribe, supportsInstallApi, () => false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (canUseInstallApi) return;
    const handler = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [canUseInstallApi]);

  if (!canUseInstallApi && !deferred && !status) return null;

  async function install() {
    if (busy) return;
    setBusy(true);
    setStatus("");
    try {
      if (canUseInstallApi) {
        // Must stay inside the click handler to retain transient activation.
        await (navigator as InstallableNavigator).install!();
        setStatus("Aplikasi terpasang atau sudah terbuka.");
      } else if (deferred) {
        const event = deferred;
        setDeferred(null);
        await event.prompt();
        const { outcome } = await event.userChoice;
        setStatus(outcome === "accepted" ? "Aplikasi terpasang." : "Instalasi dibatalkan.");
      }
    } catch (error) {
      setStatus(
        error instanceof Error && error.name === "AbortError"
          ? "Instalasi dibatalkan."
          : "Instalasi tidak dapat dimulai.",
      );
    } finally {
      setBusy(false);
    }
  }

  const installed = status.startsWith("Aplikasi terpasang");

  return (
    <div>
      {installed ? null : (
        <Button type="button" className="min-h-11" aria-disabled={busy} onClick={() => void install()}>
          <Download aria-hidden="true" className="mr-1.5 h-4 w-4" />
          Install aplikasi
        </Button>
      )}
      <p role="status" className="mt-2 text-xs text-muted-foreground">
        {status ||
          "Jika tombol tidak muncul, gunakan menu browser → Install aplikasi / Add to Home Screen."}
      </p>
    </div>
  );
}
