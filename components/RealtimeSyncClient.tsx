'use client';

import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';

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
export function RealtimeSyncClient({
  coupleId,
}: {
  coupleId: string | undefined;
}) {
  const { status } = useSession();
  if (status !== 'authenticated') return null;

  return <RealtimeSyncInner coupleId={coupleId} />;
}
