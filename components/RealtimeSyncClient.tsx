'use client';

import { useSession } from 'next-auth/react';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';

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

function RealtimeSyncInner({ coupleId }: { coupleId: string | undefined }) {
  useRealtimeSync(coupleId);
  return null;
}
