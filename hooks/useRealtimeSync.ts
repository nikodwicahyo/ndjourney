'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import type { SyncPayload } from '@/types';
import { queryKeys } from '@/lib/query-keys';

export function useRealtimeSync(coupleId: string | undefined) {
  const queryClient = useQueryClient();
  const { update: updateSession } = useSession();
  const subscribedRef = useRef<string | false>(false);
  // Keep a stable ref to the session updater so the subscription effect doesn't
  // re-run (and re-subscribe) if NextAuth's `update` identity changes.
  const updateSessionRef = useRef(updateSession);

  useEffect(() => {
    // Keep the latest session updater without re-subscribing when NextAuth's
    // `update` identity changes (assigned here, not during render).
    updateSessionRef.current = updateSession;
    if (!coupleId) return;
    if (subscribedRef.current === coupleId) return;
    subscribedRef.current = coupleId;

    const channelName = `private-couple-${coupleId}`;
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    const onSync = (data: SyncPayload) => {
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
          // Every leaderboard tab (per-game and merged "Semua") is prefixed by
          // ["games","leaderboard"]; one invalidation covers all of them.
          queryClient.invalidateQueries({ queryKey: queryKeys.games.leaderboardPrefix, refetchType: 'all' });
          // Arcade endpoint still backs the admin stats panel.
          queryClient.invalidateQueries({ queryKey: queryKeys.games.arcadeLeaderboardPrefix, refetchType: 'all' });
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
          queryClient.invalidateQueries({ queryKey: queryKeys.games.leaderboardPrefix, refetchType: 'all' });
          queryClient.invalidateQueries({ queryKey: queryKeys.partner.all(), refetchType: 'all' });
          queryClient.invalidateQueries({ queryKey: queryKeys.couple.all, refetchType: 'all' });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats(), refetchType: 'all' });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.activity(), refetchType: 'all' });
          queryClient.invalidateQueries({ queryKey: queryKeys.storage.usage(), refetchType: 'all' });
          // Same-user other devices/tabs hold a JWT with the OLD photo and
          // Pusher cannot rewrite their cookie — so pull a real refresh.
          // Payload is required: bare update() is a GET that never fires the
          // jwt "update" trigger. POSTing re-stamps the token from the DB
          // (see the jwt callback) and re-cookies it. On a partner's device
          // this is a harmless no-op (their own row is unchanged).
          if (typeof updateSessionRef.current === 'function') {
            void updateSessionRef.current({});
          }
          break;
        default:
          if (typeof console !== 'undefined' && data?.scope) {
            console.warn('[useRealtimeSync] Unhandled sync scope:', data.scope);
          }
          break;
      }
    };

    // Lazy: pusher-js only matters to signed-in couples, so keep it out of the
    // first-load bundle (the public layout mounts this for guests too, and the
    // import used to be static).
    void (async () => {
      try {
        const { getPusherClient } = await import('@/lib/pusher-client');
        if (cancelled) return;
        const pusher = getPusherClient();
        const channel = pusher.subscribe(channelName);
        channel.bind('sync-mutate', onSync);
        unsubscribe = () => {
          channel.unbind('sync-mutate', onSync);
          pusher.unsubscribe(channelName);
        };
      } catch (error) {
        console.warn('[useRealtimeSync] realtime unavailable:', error);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
      subscribedRef.current = false;
    };
  }, [coupleId, queryClient, updateSession]);
}
