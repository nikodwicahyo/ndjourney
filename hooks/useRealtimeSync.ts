'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { SyncPayload } from '@/types';
import { queryKeys } from '@/lib/query-keys';
import { getPusherClient, disconnectPusherClient } from '@/lib/pusher-client';

export function useRealtimeSync(coupleId: string | undefined) {
  const queryClient = useQueryClient();
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!coupleId) return;
    if (subscribedRef.current) return;
    subscribedRef.current = true;

    const pusher = getPusherClient();
    const channelName = `private-couple-${coupleId}`;
    const channel = pusher.subscribe(channelName);

    channel.bind('sync-mutate', (data: SyncPayload) => {
      switch (data.scope) {
        case 'GALLERY':
          queryClient.invalidateQueries({ queryKey: queryKeys.photos.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.albums.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.storage.usage() });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
          break;
        case 'TIMELINE':
          queryClient.invalidateQueries({ queryKey: queryKeys.milestones.all });
          break;
        case 'LETTERS':
          queryClient.invalidateQueries({ queryKey: queryKeys.letters.all });
          break;
        case 'DAILY_NOTES':
          queryClient.invalidateQueries({ queryKey: queryKeys.notes.all });
          break;
        case 'WISHLIST':
          queryClient.invalidateQueries({ queryKey: queryKeys.wishes.all });
          break;
        case 'DASHBOARD':
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.activity() });
          queryClient.invalidateQueries({ queryKey: queryKeys.storage.usage() });
          queryClient.invalidateQueries({ queryKey: queryKeys.couple.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.partner.all() });
          break;
      }
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
      disconnectPusherClient();
      subscribedRef.current = false;
    };
  }, [coupleId, queryClient]);
}
