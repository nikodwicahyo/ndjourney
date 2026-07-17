'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import type { SyncPayload } from '@/types';
import { queryKeys } from '@/lib/query-keys';
import { getPusherClient } from '@/lib/pusher-client';

export function useRealtimeSync(coupleId: string | undefined) {
  const queryClient = useQueryClient();
  const { update: updateSession } = useSession();
  const subscribedRef = useRef(false);
  // Keep a stable ref to the session updater so the subscription effect doesn't
  // re-run (and re-subscribe) if NextAuth's `update` identity changes.
  const updateSessionRef = useRef(updateSession);
  updateSessionRef.current = updateSession;

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
          queryClient.invalidateQueries({ queryKey: queryKeys.storage.usage(), refetchType: 'all' });
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
          // QA leaderboard (per-type keys are prefixed by ["games","leaderboard"]).
          queryClient.invalidateQueries({ queryKey: queryKeys.games.leaderboard(), refetchType: 'all' });
          // Arcade leaderboards (per-type keys are prefixed by the arcade prefix).
          queryClient.invalidateQueries({ queryKey: queryKeys.games.arcadeLeaderboardPrefix, refetchType: 'all' });
          // Merged "Semua" tab (note: key does not start with "games").
          queryClient.invalidateQueries({ queryKey: ["leaderboard", "all-qa"], refetchType: 'all' });
          break;
        case 'GAMES_QUESTIONS':
          // Literal prefix (not queryKeys.games.questions()) — the factory
          // injects concrete trailing params that would break prefix matching.
          queryClient.invalidateQueries({ queryKey: ["games", "questions"], refetchType: 'all' });
          break;
        case 'DASHBOARD':
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats(), refetchType: 'all' });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.activity(), refetchType: 'all' });
          queryClient.invalidateQueries({ queryKey: queryKeys.storage.usage(), refetchType: 'all' });
          queryClient.invalidateQueries({ queryKey: queryKeys.couple.all, refetchType: 'all' });
          queryClient.invalidateQueries({ queryKey: queryKeys.partner.all(), refetchType: 'all' });
          break;
        case 'LOCATION':
          // Live location changed (share toggle or position update): refresh the
          // location query so the map, distance and "Meet" state update in real
          // time. Polling in usePartnerLocation covers Pusher disconnects.
          queryClient.invalidateQueries({ queryKey: queryKeys.location.all, refetchType: 'all' });
          queryClient.invalidateQueries({ queryKey: queryKeys.partner.all(), refetchType: 'all' });
          break;
        case 'PROFILE':
          // Profile photo (or name) changed: refresh every query that embeds a
          // user image so avatars update live across notes, letters, milestones,
          // the games leaderboard and the partner/couple data — plus the local
          // NextAuth session so the Sidebar/Navbar avatar updates too.
          queryClient.invalidateQueries({ queryKey: queryKeys.notes.all, refetchType: 'all' });
          queryClient.invalidateQueries({ queryKey: queryKeys.letters.all, refetchType: 'all' });
          queryClient.invalidateQueries({ queryKey: queryKeys.milestones.all, refetchType: 'all' });
          queryClient.invalidateQueries({ queryKey: queryKeys.games.leaderboard(), refetchType: 'all' });
          queryClient.invalidateQueries({ queryKey: queryKeys.partner.all(), refetchType: 'all' });
          queryClient.invalidateQueries({ queryKey: queryKeys.couple.all, refetchType: 'all' });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats(), refetchType: 'all' });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.activity(), refetchType: 'all' });
          queryClient.invalidateQueries({ queryKey: queryKeys.storage.usage(), refetchType: 'all' });
          if (typeof updateSessionRef.current === 'function') {
            void updateSessionRef.current();
          }
          break;
        default:
          if (typeof console !== 'undefined' && data?.scope) {
            console.warn('[useRealtimeSync] Unhandled sync scope:', data.scope);
          }
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
