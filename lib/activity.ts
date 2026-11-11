import { prisma } from "@/lib/prisma";
import { getPusherServer } from "@/lib/pusher-server";
import { redis, cacheKey } from "@/lib/redis";
import { LOCATION_STALE_AFTER_SECONDS } from "@/lib/geo";
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
  // the bell navigates with router.push, which does not get the SW's origin
  // guard — reject backslashes (a URL parser folds them into "/") and control
  // bytes here too.
  if (/[\\\u0000-\u001f]/.test(href)) return null;
  return href;
}

type ActivityEventRef = { id: string; createdAt: Date };

// Pusher + cache + native-push fan-out. Split from the row write so a caller
// that must create its event inside a transaction (the location re-online
// claim) can fan out only after that transaction commits.
async function fanOutActivity(
  coupleId: string,
  actorId: string,
  scope: SyncScope,
  input: EmitActivityInput,
  href: string | null,
  event: ActivityEventRef,
): Promise<void> {
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
  if (input.level !== "both") return;

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
  // web-push rejects a bare endpoint string with "You must pass in a
  // subscription with at least an endpoint." — it needs the keys object.
  const payload = JSON.stringify({ title: input.title, body: input.body, url: href });
  const vapidDetails = {
    subject: process.env.CONTACT_EMAIL ?? "mailto:app@couple-web",
    publicKey,
    privateKey,
  };
  // allSettled: one dead endpoint must not delay the others; each row keeps
  // its own guard so a 404/410 prunes exactly its own subscription.
  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { vapidDetails, timeout: 5000 },
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
    }),
  );
}

function activityData(coupleId: string, actorId: string, input: EmitActivityInput, href: string | null) {
  return {
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
  };
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
      data: activityData(coupleId, actorId, input, href),
    });

    await fanOutActivity(coupleId, actorId, scope, input, href, event);
  } catch (error) {
    console.error("[ACTIVITY_ERROR]", error);
  }
}

const LOCATION_REONLINE_COOLDOWN_MS = 5 * 60 * 1000;

/** Serializes re-online claiming per actor, across every server instance. */
function locationReonlineLockKey(actorId: string): string {
  return `location-reonline:${actorId}`;
}

/**
 * Bell + push for "the device GPS is posting again". A normal 8–30 s ping must
 * stay silent: only a gap at least as long as the UI's "Offline" threshold is a
 * recovery. The cooldown is shared with the share-on event, so turning sharing
 * on (which already notifies) does not double-notify on the first fix — unless
 * the GPS took longer than the cooldown to acquire, in which case "GPS aktif"
 * is the useful message.
 *
 * Concurrency: every open tab posts a fix at once on unlock/reconnect, and all
 * of them used to read "no recent event" before any insert committed — one row,
 * bell entry and push each. The claim (gap → cooldown → insert) now runs in one
 * transaction behind a transaction-scoped advisory lock keyed by actor, so
 * concurrent callers, devices and serverless instances serialize: the losers
 * see the winner's committed row and return without notifying.
 *
 * Fail-open: a notification failure never blocks the position write.
 */
export async function notifyLocationReonline(
  coupleId: string,
  actorId: string,
  actorName: string | null,
  previousUpdatedAt: Date | null,
): Promise<void> {
  try {
    const now = Date.now();

    if (previousUpdatedAt) {
      const gapMs = now - previousUpdatedAt.getTime();
      if (gapMs < LOCATION_STALE_AFTER_SECONDS * 1000) return;
    }

    const input: EmitActivityInput = {
      type: "location",
      action: "updated",
      title: "Partner online",
      body: `${actorName || "Pasangan"} kembali online - Sharing live location`,
      href: "/location",
      level: "both",
    };
    const href = sanitizeHref(input.href);

    const event = await prisma.$transaction(async (tx) => {
      // Same pattern as couple formation (lib/auth.ts): the lock is released
      // on commit/rollback, so a crashed caller can never wedge the actor.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${locationReonlineLockKey(actorId)}))`;

      const lastLocationEvent = await tx.activityEvent.findFirst({
        where: { coupleId, actorId, type: "location" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      if (
        lastLocationEvent &&
        Date.now() - lastLocationEvent.createdAt.getTime() < LOCATION_REONLINE_COOLDOWN_MS
      ) {
        return null;
      }

      return tx.activityEvent.create({
        data: activityData(coupleId, actorId, input, href),
      });
    });

    // Winner only: fan out after commit so a rolled-back row never notifies.
    if (!event) return;
    await fanOutActivity(coupleId, actorId, "LOCATION", input, href, event);
  } catch (error) {
    console.error("[LOCATION_REONLINE_ERROR]", error);
  }
}
