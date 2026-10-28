'use client';

import { useRealtimeSync } from '@/hooks/useRealtimeSync';

// Split out so pusher-js loads lazily (see RealtimeSyncClient).
export function RealtimeSyncInner({ coupleId }: { coupleId: string | undefined }) {
  useRealtimeSync(coupleId);
  return null;
}
