"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { NotificationsResponse } from "@/types";

export type { NotificationItem, NotificationsResponse } from "@/types";

export const notificationKeys = queryKeys.notifications;

async function fetchNotifications(signal: AbortSignal): Promise<NotificationsResponse> {
  const res = await fetch("/api/notifications", { signal });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error ?? `Gagal memuat notifikasi (${res.status})`);
  }
  return json as NotificationsResponse;
}

/**
 * Partner-authored activity feed for the bell. No polling: realtime
 * (`useRealtimeSync`) invalidates `queryKeys.notifications.all` on any
 * activity payload, so this only needs a generous staleTime for cold loads.
 */
export function useNotifications() {
  return useQuery({
    queryKey: notificationKeys.all,
    queryFn: ({ signal }) => fetchNotifications(signal),
    staleTime: 60_000,
  });
}

/** Marks everything read server-side and clears the badge optimistically. */
export function useMarkNotificationsSeen() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notifications/seen", { method: "POST" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Gagal menandai notifikasi");
      }
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: notificationKeys.all });
      const previous = qc.getQueryData<NotificationsResponse>(notificationKeys.all);
      if (previous) {
        qc.setQueryData<NotificationsResponse>(notificationKeys.all, {
          ...previous,
          unreadCount: 0,
          items: previous.items.map((i) => ({ ...i, unread: false })),
        });
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(notificationKeys.all, context.previous);
      }
    },
  });
}
