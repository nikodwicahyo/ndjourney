'use client';

import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

// pusher-js (~35 KB raw) is only needed for signed-in visitors. The dynamic
// import keeps it out of the public first load entirely: guests download
// nothing, members fetch it right after hydration.
const RealtimeSyncInner = dynamic(
  () => import('./RealtimeSyncInner').then((m) => m.RealtimeSyncInner),
  { ssr: false },
);

// Mounted from the (cookie-free) public layout, so the auth check happens here
// instead of on the server. Guests subscribe to nothing: the channel is private
// and /api/pusher/auth would just reject them.
//
// The layout passes a guessed couple id (first couple in DB) so the server
// stays static. For an authenticated visitor we resolve their OWN couple id
// client-side and re-subscribe, so realtime updates target the right channel
// instead of a stranger's.
export function RealtimeSyncClient({
  coupleId,
}: {
  coupleId: string | undefined;
}) {
  const { status } = useSession();
  const [resolved, setResolved] = useState<string | undefined>(coupleId);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    fetch('/api/partner')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled && j?.coupleId) setResolved(j.coupleId);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [status]);

  if (status !== 'authenticated') return null;

  return <RealtimeSyncInner coupleId={resolved} />;
}