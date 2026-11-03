import { prisma } from "@/lib/prisma";
import { getPusherServer } from "@/lib/pusher-server";
import { redis, cacheKey } from "@/lib/redis";
import type { SyncScope } from "@/types";
import type { Prisma } from "@/lib/generated/prisma";
import { sendNotification } from "web-push";

export type ActivityLevel = "both" | "bell";

export type EmitActivityInput = {
  type: string; // "photo" | "video" folded into "photo" | "letter" | "milestone" | "note" | "wish" | "game" | "arcade" | "profile" | "location" | "questions"
  action: string; // "created" | "updated" | "scored"
  title: string; // complete Indonesian string, e.g. "Foto baru"
  body?: string | null; // complete Indonesian string, includes actor name
  href?: string | null; // site-relative deep link; sanitized
  level: ActivityLevel;
  meta?: Prisma.InputJsonObject; // e.g. { thumbnailUrl, video?, count }
};

const ACTIVITY_SCOPE: Record<string, SyncScope> = {
  photo: "GALLERY",
  letter: "LETTERS",
  milestone: "TIMELINE",
  note: "DAILY_NOTES",
  wish: "WISHLIST",
  game: "GAMES_LEADERBOARD",
  arcade: "GAMES_LEADERBOARD",
  profile: "PROFILE",
  location: "LOCATION",
  questions: "GAMES_QUESTIONS",
} as const;

function sanitizeHref(href: string | null | undefined): string | null {
  if (typeof href !== "string" || !href.startsWith("/") || href.startsWith("//")) {
    return null;
  }
  return href;
}

// Central activity helper: persist + fan-out. Fail-open — any downstream
// failure (pusher, redis, web-push) is logged and never blocks the write.
export async function emitActivity(
  coupleId: string,
  actorId: string,
  input: EmitActivityInput,
): Promise<void> {
  try {
    const href = sanitizeHref(input.href);
    const scope: SyncScope = ACTIVITY_SCOPE[input.type] ?? "DASHBOARD";

    // 2. always written — the content mutation must succeed whatever else fails.
    const event = await prisma.activityEvent.create({
      data: {
        couple: { connect: { id: coupleId } },
        actor: { connect: { id: actorId } },
        type: input.type,
        action: input.action,
        title: input.title,
        body: input.body ?? null,
        href,
        level: input.level,
        // Json? column: omit (NULL) when no meta instead of sending literal null.
        ...(input.meta ? { meta: input.meta } : {}),
      },
    });

    // 3. pusher — same internals as triggerCoupleEvent, carried inline so
    //    lib/pusher-server.ts stays untouched (Task 5 extends SyncPayload).
    const pusher = getPusherServer();
    if (pusher) {
      try {
        await pusher.trigger(`private-couple-${coupleId}`, "sync-mutate", {
          scope,
          action: "REFRESH",
          activity: {
            id: event.id,
            type: input.type,
            action: input.action,
            title: input.title,
            body: input.body,
            href,
            createdAt: event.createdAt,
          },
        });
      } catch (error) {
        console.error(`[ACTIVITY_PUSHER_ERROR] ${scope}:`, error);
      }
    }

    // 4. kill the <=120 s dashboard staleness on live updates.
    await redis?.del(cacheKey("dashboard", "activity", coupleId));

    // 5. native push fan-out to partners (never the actor) when level === "both".
    if (input.level === "both") {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      const privateKey = process.env.VAPID_PRIVATE_KEY;
      if (!publicKey || !privateKey) {
        console.warn("[activity] VAPID keys missing — push notifications skipped");
        return;
      }
      const members = await prisma.coupleMember.findMany({
        where: { coupleId, userId: { not: actorId } },
        select: { userId: true },
      });
      const userIds = members.map((m) => m.userId);
      const subs = userIds.length
        ? await prisma.pushSubscription.findMany({ where: { userId: { in: userIds } } })
        : [];
      for (const sub of subs) {
        try {
          await sendNotification(
            sub.endpoint as unknown as Parameters<typeof sendNotification>[0],
            JSON.stringify({ title: input.title, body: input.body, url: href }),
            {
              vapidDetails: {
                subject: process.env.CONTACT_EMAIL ?? "mailto:app@couple-web",
                publicKey,
                privateKey,
              },
            },
          );
        } catch (error) {
          const statusCode = (error as { statusCode?: number })?.statusCode;
          // 404/410 = subscription gone — prune exactly that row.
          if (statusCode === 404 || statusCode === 410) {
            await prisma.pushSubscription.delete({ where: { endpoint: sub.endpoint } });
          } else {
            console.error("[ACTIVITY_PUSH_ERROR]", error);
          }
        }
      }
    }
  } catch (error) {
    console.error("[ACTIVITY_ERROR]", error);
  }
}
