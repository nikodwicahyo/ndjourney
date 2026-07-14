'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { SyncPayload } from '@/types';
import { queryKeys } from '@/lib/query-keys';
import { getPusherClient } from '@/lib/pusher-client';

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
          queryClient.invalidateQueries({ queryKey: queryKeys.photos.all, refetchType: 'all' });
          queryClient.invalidateQueries({ queryKey: queryKeys.albums.all, refetchType: 'all' });
          queryClient.invalidateQueries({ queryKey: queryKeys.storage.usage(), refetchType: 'all' });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats(), refetchType: 'all' });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.activity(), refetchType: 'all' });
          break;
        case 'TIMELINE':
          queryClient.invalidateQueries({ queryKey: queryKeys.milestones.all, refetchType: 'all' });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats(), refetchType: 'all' });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.activity(), refetchType: 'all' });
          break;
        case 'LETTERS':
          queryClient.invalidateQueries({ queryKey: queryKeys.letters.all, refetchType: 'all' });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats(), refetchType: 'all' });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.activity(), refetchType: 'all' });
          break;
        case 'DAILY_NOTES':
          queryClient.invalidateQueries({ queryKey: queryKeys.notes.all, refetchType: 'all' });
          break;
        case 'WISHLIST':
          queryClient.invalidateQueries({ queryKey: queryKeys.wishes.all, refetchType: 'all' });
          break;
        case 'GAMES_LEADERBOARD':
          queryClient.invalidateQueries({ queryKey: queryKeys.games.leaderboard(), refetchType: 'all' });
          break;
        case 'GAMES_QUESTIONS':
          queryClient.invalidateQueries({ queryKey: ["games", "questions"], refetchType: 'all' });
          break;
        case 'DASHBOARD':
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats(), refetchType: 'all' });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.activity(), refetchType: 'all' });
          queryClient.invalidateQueries({ queryKey: queryKeys.storage.usage(), refetchType: 'all' });
          queryClient.invalidateQueries({ queryKey: queryKeys.couple.all, refetchType: 'all' });
          queryClient.invalidateQueries({ queryKey: queryKeys.partner.all(), refetchType: 'all' });
          break;
        default:
          break;
      }
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
      subscribedRef.current = false;
    };
  }, [coupleId, queryClient]);
}
