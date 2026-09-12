import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { getUserCoupleId } from "@/lib/couple";
import { triggerCoupleEvent } from "@/lib/pusher-server";
import type { SyncScope } from "@/types";

type AuthedHandler = (
  req: Request,
  ctx: { userId: string; coupleId: string; session: Session },
) => Promise<Response>;

/**
 * Wrap an API handler with auth + couple resolution.
 * Eliminates copy-pasted getUserCoupleId / 401 / 404 blocks in every route.
 */
// ponytail: one wrapper replaces ~10 lines of boilerplate per route.
export function withCouple(handler: AuthedHandler, scope?: SyncScope) {
  return async function wrapped(req: Request): Promise<Response> {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const coupleId = await getUserCoupleId(session.user.id);
    if (!coupleId) {
      return NextResponse.json({ error: "Pasangan belum ditemukan" }, { status: 404 });
    }
    const res = await handler(req, { userId: session.user.id, coupleId, session });
    if (scope) void triggerCoupleEvent(coupleId, scope);
    return res;
  };
}

export { getUserCoupleId };
