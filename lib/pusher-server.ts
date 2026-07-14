import Pusher from 'pusher';
import type { SyncScope } from '@/types';

export const pusherServer: Pusher =
  globalThis.pusherServer ??
  new Pusher({
    appId: process.env.PUSHER_APP_ID!,
    key: process.env.NEXT_PUBLIC_PUSHER_APP_KEY!,
    secret: process.env.PUSHER_SECRET!,
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    useTLS: true,
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.pusherServer = pusherServer;
}

// No changes needed to triggerCoupleEvent, it already accepts SyncScope.
// We just need to ensure usages update to the new scopes.
export async function triggerCoupleEvent(
  coupleId: string,
  scope: SyncScope,
): Promise<void> {
  try {
    await pusherServer.trigger(
      `private-couple-${coupleId}`,
      'sync-mutate',
      { scope, action: 'REFRESH' },
    );
  } catch (error) {
    console.error(`[PUSHER_TRIGGER_ERROR] ${scope}:`, error);
  }
}
