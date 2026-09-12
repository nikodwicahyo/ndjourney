import Pusher from 'pusher';
import type { SyncScope } from '@/types';

// ponytail: lazy-init — missing env must disable realtime, not crash every importing route at boot.
let _pusher: Pusher | null = null;

function getPusher(): Pusher | null {
  if (_pusher) return _pusher;
  const { PUSHER_APP_ID, NEXT_PUBLIC_PUSHER_APP_KEY, PUSHER_SECRET, NEXT_PUBLIC_PUSHER_CLUSTER } = process.env;
  if (!PUSHER_APP_ID || !NEXT_PUBLIC_PUSHER_APP_KEY || !PUSHER_SECRET || !NEXT_PUBLIC_PUSHER_CLUSTER) {
    console.warn("[pusher] env missing — realtime disabled");
    return null;
  }
  _pusher = new Pusher({
    appId: PUSHER_APP_ID,
    key: NEXT_PUBLIC_PUSHER_APP_KEY,
    secret: PUSHER_SECRET,
    cluster: NEXT_PUBLIC_PUSHER_CLUSTER,
    useTLS: true,
  });
  if (process.env.NODE_ENV !== 'production') {
    (globalThis as unknown as { pusherServer?: Pusher }).pusherServer = _pusher;
  }
  return _pusher;
}

export function getPusherServer(): Pusher | null {
  return getPusher();
}

// Back-compat accessor: throws with a clear message instead of import-time crash.
// We just need to ensure usages update to the new scopes.
export async function triggerCoupleEvent(
  coupleId: string,
  scope: SyncScope,
): Promise<void> {
  try {
    const p = getPusher();
    if (!p) return;
    await p.trigger(
      `private-couple-${coupleId}`,
      'sync-mutate',
      { scope, action: 'REFRESH' },
    );
  } catch (error) {
    console.error(`[PUSHER_TRIGGER_ERROR] ${scope}:`, error);
  }
}
