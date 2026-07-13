'use client';

import { useRealtimeSync } from '@/hooks/useRealtimeSync';

export function RealtimeSyncClient({
  coupleId,
}: {
  coupleId: string | undefined;
}) {
  useRealtimeSync(coupleId);
  return null;
}
