'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

// How often to check for a new deployment.
const POLL_INTERVAL = 60_000;

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

// Module-level guard so we never schedule more than one reload.
let reloadScheduled = false;

/**
 * Apply a pending update at the least-disruptive moment: immediately if the
 * tab is already hidden (user isn't looking), otherwise as soon as the tab is
 * backgrounded, with a short grace-period fallback so any in-flight action can
 * settle before we refresh.
 */
function scheduleUpdate() {
  if (reloadScheduled) return;
  reloadScheduled = true;

  const doReload = () => window.location.reload();

  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    doReload();
    return;
  }

  const onVisible = () => {
    if (document.visibilityState === 'hidden') {
      window.removeEventListener('visibilitychange', onVisible);
      doReload();
    }
  };
  window.addEventListener('visibilitychange', onVisible);
  window.setTimeout(doReload, 5000);
}

const STORAGE_KEY = 'ndj:app-version';

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

        // First check this session: record the baseline build. If a previous
        // visit stored a different build, the app was just updated — confirm it.
        if (versionRef.current === null) {
          versionRef.current = buildTime;
          const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
          if (stored && stored !== buildTime) {
            toast.success('Aplikasi sudah diperbarui ke versi terbaru 🎉', {
              id: 'app-updated',
              duration: 4000,
            });
          }
          try {
            localStorage.setItem(STORAGE_KEY, buildTime);
          } catch {}
          return;
        }

        if (versionRef.current !== buildTime) {
          toast.loading('Memperbarui aplikasi…', {
            id: 'app-update',
            duration: Infinity,
          });
          await clearServiceWorkerCaches();
          scheduleUpdate();
          versionRef.current = buildTime;
          // NB: intentionally do NOT write the new version to localStorage
          // here — leaving the previous value lets the reloaded page detect
          // the bump and show the "already updated" confirmation.
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
