'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

// How often to check for a new deployment.
const POLL_INTERVAL = 60_000;

// Flag set right before we reload for an update. Its mere presence on the next
// load proves the app was just updated — so we don't have to re-fetch and trust
// a (possibly still-stale) version.json to confirm it.
const UPDATED_FLAG = 'ndj:app-prev-version';

/**
 * Tell the active Service Worker to delete all caches so the next
 * page load fetches everything fresh from the network.
 */
async function clearServiceWorkerCaches(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({ type: 'CLEAR_CACHES' });
  } catch {
    // Service worker not available — nothing to clear
  }
}

function markUpdated(oldVersion: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(UPDATED_FLAG, oldVersion || '1');
    }
  } catch {
    // ignore storage failures
  }
}

function consumeUpdated(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const v = localStorage.getItem(UPDATED_FLAG);
    if (v) localStorage.removeItem(UPDATED_FLAG);
    return v;
  } catch {
    return null;
  }
}

// Module-level guard so we never schedule more than one reload.
let reloadScheduled = false;

function reloadNow(): void {
  if (reloadScheduled) return;
  reloadScheduled = true;
  window.location.reload();
}

export function useAppVersion() {
  const versionRef = useRef<string | null>(null);

  useEffect(() => {
    async function checkVersion() {
      try {
        const res = await fetch('/version.json', { cache: 'no-cache' });
        if (!res.ok) return;
        const data = await res.json();
        const buildTime = data.buildTime as string;
        if (!buildTime) return;

        // First check after a (re)load. If we arrived here because an update was
        // just applied, a flag was set right before the reload — confirm it.
        if (versionRef.current === null) {
          versionRef.current = buildTime;
          const updatedFrom = consumeUpdated();
          if (updatedFrom) {
            toast.success('Aplikasi sudah diperbarui ke versi terbaru 🎉', {
              id: 'app-updated',
              duration: 6000,
            });
          }
          return;
        }

        if (versionRef.current !== buildTime) {
          toast.loading('Pembaruan tersedia, memuat ulang…', {
            id: 'app-update',
            duration: Infinity,
          });
          await clearServiceWorkerCaches();
          markUpdated(versionRef.current ?? '');
          versionRef.current = buildTime;
          reloadNow();
        }
      } catch {
        // Network error — we'll retry on the next interval.
      }
    }

    checkVersion();
    const interval = setInterval(checkVersion, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []);
}
