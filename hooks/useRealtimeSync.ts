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
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.activity() });
          break;
        case 'TIMELINE':
          queryClient.invalidateQueries({ queryKey: queryKeys.milestones.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.activity() });
          break;
        case 'LETTERS':
          queryClient.invalidateQueries({ queryKey: queryKeys.letters.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.activity() });
          break;
        case 'DAILY_NOTES':
          queryClient.invalidateQueries({ queryKey: queryKeys.notes.all });
          break;
        case 'WISHLIST':
          queryClient.invalidateQueries({ queryKey: queryKeys.wishes.all });
          break;
        case 'GAMES_LEADERBOARD':
          queryClient.invalidateQueries({ queryKey: queryKeys.games.leaderboard() });
          break;
        case 'GAMES_QUESTIONS':
          // Invalidate list/manager views (no random count/exclude params)
          // Matches:
          // - GameManager: ["games", "questions", "all", sortOrder]
          // - useAllQuestions/useQuestions list views: ["games", "questions", type, "all", "all"]
          queryClient.invalidateQueries({
            predicate: (query) => {
               const key = query.queryKey as any[];
               if (key[0] !== 'games' || key[1] !== 'questions') return false;
               
               // GameManager format: ["games", "questions", "all", sortOrder]
               if (key[2] === 'all') return true;
               
               // Standard queryKeys format: ["games", "questions", type, count, exclude]
               // List views have count="all" and exclude="all"
               if (key.length >= 5 && key[3] === 'all' && key[4] === 'all') return true;
               
               return false;
            }
          });
          break;
        case 'DASHBOARD':
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.activity() });
          queryClient.invalidateQueries({ queryKey: queryKeys.storage.usage() });
          queryClient.invalidateQueries({ queryKey: queryKeys.couple.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.partner.all() });
          break;
        default:
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
