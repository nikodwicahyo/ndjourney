'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

const POLL_INTERVAL = 120_000;

export function useAppVersion() {
  const versionRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function checkVersion() {
      try {
        const res = await fetch('/version.json', { cache: 'no-cache' });
        if (!res.ok) return;
        const data = await res.json();
        const buildTime = data.buildTime as string;
        if (!buildTime) return;

        if (versionRef.current === null) {
          versionRef.current = buildTime;
          return;
        }

        if (versionRef.current !== buildTime) {
          toast.info('Update tersedia — muat ulang untuk versi terbaru', {
            duration: 0,
            id: 'app-update',
            action: {
              label: 'Muat Ulang',
              onClick: () => window.location.reload(),
            },
          });
          versionRef.current = buildTime;
        }
      } catch {}
    }

    checkVersion();
    const interval = setInterval(checkVersion, POLL_INTERVAL);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);
}
