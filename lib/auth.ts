import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { getCached, setCached, redis, withRedisTimeout } from "./redis";
import { safeTokenEqual } from "./api-body";

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

// Precomputed bcrypt hash of a random string — compared (and discarded) on
// auth misses so absent and Google-only accounts take the same time as a
// real password check (see authorize below).
const DUMMY_PASSWORD_HASH =
  "$2b$10$yMDs43qYtWpB8Xj5/iui.OvHazl1SNd4e8b1QM8kNXNYndG2JcX8C";

export { normalizeEmail };

// Per-account brute-force backoff (see P1 auth plan). Per-IP throttling on
// [...nextauth] is bypassed by distributed stuffing, so every credentials
// failure — including unknown emails, uniformly — increments a Redis
// counter; past the threshold the attempt pays a progressive delay instead
// of failing fast. No hard lockout: lockout lets an attacker DoS the
// victim's account. All Redis access is fail-open (login must survive a
// Redis outage).
const AUTH_FAIL_WINDOW_SECONDS = 15 * 60;
const AUTH_FAIL_THRESHOLD = 5;
const AUTH_FAIL_MAX_DELAY_MS = 2000;

/** Pure delay math — exported for tests. 0 below threshold, +500ms per failure after, capped. */
export function authFailDelayMs(failCount: number): number {
  if (failCount < AUTH_FAIL_THRESHOLD) return 0;
  return Math.min(AUTH_FAIL_MAX_DELAY_MS, 500 * (failCount - AUTH_FAIL_THRESHOLD + 1));
}

function authFailKey(email: string): string {
  return `auth:fail:${email}`;
}

export async function recordAuthFailure(email: string): Promise<void> {
  try {
    if (!redis) return;
    const count = await withRedisTimeout(redis.incr(authFailKey(email)));
    if (count === 1) {
      await withRedisTimeout(redis.expire(authFailKey(email), AUTH_FAIL_WINDOW_SECONDS));
    }
    const delay = authFailDelayMs(count);
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  } catch {
    // fail-open — throttling must never break login.
  }
}

export async function clearAuthFailures(email: string): Promise<void> {
  try {
    if (redis) await withRedisTimeout(redis.del(authFailKey(email)));
  } catch {
    // fail-open.
  }
}

export async function ensureCouple(userId: string): Promise<void> {
  // Pairing state machine — see P1 split-brain fix. Former shape was
  // check-then-act without mutual exclusion: concurrent first-logins both
  // saw "no couple" and each created one (skipDuplicates swallowed the
  // P2002 that should have stopped the loser). Now the whole
  // read-decide-write runs inside one transaction behind an advisory lock
  // (same pattern as the register-quota fix), and the unique singleton on
  // Couple is the backstop for any lock-bypassing writer.
  let partnerIds: string[] = [];
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('couple-formation'))`;

      const existingMember = await tx.coupleMember.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (existingMember) return;

      const partnerCount = await tx.user.count({
        where: { role: "PARTNER" },
      });

      if (partnerCount < 2) return;

      const allPartners = await tx.user.findMany({
        where: { role: "PARTNER" },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });

      if (allPartners.length < 2) return;
      partnerIds = allPartners.map((p) => p.id);

      const existingCoupleMember = await tx.coupleMember.findFirst({
        where: { userId: { in: partnerIds } },
        select: { coupleId: true, userId: true },
      });

      if (existingCoupleMember) {
        // idempotent join with size cap — never grow a couple past 2.
        // Serialized by the lock, so count-then-create cannot race.
        const memberCount = await tx.coupleMember.count({
          where: { coupleId: existingCoupleMember.coupleId },
        });
        if (memberCount >= 2) return;
        // idempotent join — a lock-bypassing writer racing us hits P2002,
        // treat as success.
        try {
          await tx.coupleMember.create({
            data: { coupleId: existingCoupleMember.coupleId, userId },
          });
        } catch (e: unknown) {
          if ((e as { code?: string })?.code !== "P2002") throw e;
        }
        return;
      }

      const couple = await tx.couple.create({ data: {} });
      // No skipDuplicates: a conflict must raise P2002 so the catch below
      // rejoins the winner instead of silently leaving an orphan couple.
      await tx.coupleMember.createMany({
        data: allPartners.map((p) => ({
          coupleId: couple.id,
          userId: p.id,
        })),
      });
    });
  } catch (e: unknown) {
    // Lost the race (singleton guard or member conflict): rejoin the winner.
    if ((e as { code?: string })?.code === "P2002") {
      if (partnerIds.length === 0) {
        const partners = await prisma.user.findMany({
          where: { role: "PARTNER" },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        });
        partnerIds = partners.map((p) => p.id);
      }
      const retry = await prisma.coupleMember.findFirst({
        where: { userId: { in: partnerIds } },
        select: { coupleId: true },
      });
      if (retry) {
        try {
          await prisma.coupleMember.create({
            data: { coupleId: retry.coupleId, userId },
          });
        } catch (e2: unknown) {
          if ((e2 as { code?: string })?.code !== "P2002") throw e2;
        }
      }
      return;
    }
    console.error("ensureCouple error:", e);
    return;
  }
}

const prismaAdapter = PrismaAdapter(prisma);

// Wrap getSessionAndUser to cache session and user database queries.
// NOTE: inert under the JWT session strategy (Auth.js never calls adapter
// session methods then) — kept so a future strategy switch stays cached.
const originalGetSessionAndUser = prismaAdapter.getSessionAndUser;
if (originalGetSessionAndUser) {
  prismaAdapter.getSessionAndUser = async (sessionToken) => {
    const cacheK = `session:${sessionToken}`;
    try {
      const cached = await getCached<{ session: any; user: any }>(cacheK);
      if (cached) {
        return {
          session: {
            ...cached.session,
            expires: new Date(cached.session.expires),
          },
          user: {
            ...cached.user,
            createdAt: cached.user.createdAt ? new Date(cached.user.createdAt) : undefined,
            updatedAt: cached.user.updatedAt ? new Date(cached.user.updatedAt) : undefined,
            emailVerified: cached.user.emailVerified ? new Date(cached.user.emailVerified) : null,
          },
        };
      }
    } catch (e) {
      console.error("Session cache read error:", e);
    }

    const result = await originalGetSessionAndUser(sessionToken);
    if (result) {
      try {
        // strip sensitive fields before caching — adapter user rows
        // can carry password hashes; Redis must never hold them.
        // SEC: short TTL bounds the stale-authz window after role/session revocation.
        const { password: _pw, ...safeUser } = result.user as unknown as Record<string, unknown>;
        await setCached(cacheK, { session: result.session, user: safeUser }, 300); // Cache for 5 minutes
      } catch (e) {
        console.error("Session cache write error:", e);
      }
    }
    return result;
  };
}

// Wrap updateSession and deleteSession to invalidate cache on changes
const originalUpdateSession = prismaAdapter.updateSession;
if (originalUpdateSession) {
  prismaAdapter.updateSession = (session) => {
    const resultPromise = originalUpdateSession(session);
    if (resultPromise && typeof (resultPromise as any).then === "function") {
      (resultPromise as any).then((result: any) => {
        if (result) {
          const cacheK = `session:${result.sessionToken}`;
          if (redis) {
            redis.del(`cache:${cacheK}`).catch((e) =>
              console.error("Session cache update invalidation error:", e)
            );
          }
        }
      }).catch((e: unknown) => {
        // never swallow silently — session still returns, but log it.
        console.error("Session cache update invalidation error:", e);
      });
    }
    return resultPromise;
  };
}

const originalDeleteSession = prismaAdapter.deleteSession;
if (originalDeleteSession) {
  prismaAdapter.deleteSession = (sessionToken) => {
    const cacheK = `session:${sessionToken}`;
    if (redis) {
      redis.del(`cache:${cacheK}`).catch((e) =>
        console.error("Session cache delete invalidation error:", e)
      );
    }
    return originalDeleteSession(sessionToken);
  };
}

// Credentials verification, extracted for tests. Every failure path records
// the per-account counter (unknown emails included — uniform behavior, no
// throttle oracle); success clears it. Returns the NextAuth user shape or null.
export async function authorizeCredentials(credentials: {
  email?: unknown;
  password?: unknown;
} | undefined) {
  if (!credentials?.email || !credentials?.password) return null;

  const email = normalizeEmail(credentials.email as string);

  const user = await prisma.user.findUnique({
    where: { email },
  });

  // MR-10: constant-time miss — without this, absent emails return
  // ~instantly while present ones pay bcrypt.compare, leaking
  // registration/method via timing.
  if (!user?.password) {
    await bcrypt.compare(
      credentials.password as string,
      DUMMY_PASSWORD_HASH,
    );
  }

  if (!user) {
    await recordAuthFailure(email);
    return null;
  }

  if (!user.password) {
    try {
      const cookieStore = await cookies();
      cookieStore.set("auth_error_reason", "google_only", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60,
        path: "/",
      });
    } catch (e) {
      console.error("Failed to set auth error cookie:", e);
    }
    await recordAuthFailure(email);
    return null;
  }

  const isValid = await bcrypt.compare(
    credentials.password as string,
    user.password,
  );

  if (!isValid) {
    await recordAuthFailure(email);
    return null;
  }

  await clearAuthFailures(email);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    role: user.role,
  };
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: prismaAdapter,
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  // JWT strategy is REQUIRED with a Credentials provider: Auth.js mints
  // credentials sessions as JWTs unconditionally (no Session row is ever
  // created), so "database" can never validate them — every password login
  // bounced back to /login despite a valid cookie (proven end-to-end).
  // Trade-off, accepted: no server-side session revocation; bound by the
  // 3-day maxAge below. The adapter stays for OAuth users/accounts linking.
  session: { strategy: "jwt", maxAge: 3 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/auth-error",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        return authorizeCredentials(credentials);
      },
    }),
  ],
  callbacks: {
    async signIn({ account, user }) {
      try {
        if (account?.provider === "credentials") {
          if (user.id) await ensureCouple(user.id);
          return true;
        }

        if (account?.provider === "google") {
          const email = user.email ? normalizeEmail(user.email) : null;

          const cookieStore = await cookies();
          const inviteToken = (cookieStore.get("invite_token")?.value ?? "").trim();
          const expected = (process.env.INVITE_TOKEN || "").trim();
          const hasValidInvite = safeTokenEqual(inviteToken, expected);

          if (hasValidInvite) {
            cookieStore.delete("invite_token");

            if (email) {
              const existing = await prisma.user.findUnique({
                where: { email },
                select: { id: true },
              });

              if (existing) {
                cookieStore.set("auth_error_reason", "email_exists", {
                  httpOnly: true,
                  secure: process.env.NODE_ENV === "production",
                  sameSite: "lax",
                  maxAge: 60,
                  path: "/",
                });
                return false;
              }
            }

            const partnerCount = await prisma.user.count({
              where: { role: "PARTNER" },
            });

            if (partnerCount >= 2) {
              cookieStore.set("auth_error_reason", "quota_full", {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                maxAge: 60,
                path: "/",
              });
              return false;
            }

            if (user.id) await ensureCouple(user.id);
            return true;
          }

          if (email) {
            const existing = await prisma.user.findUnique({
              where: { email },
              select: { id: true, role: true },
            });

            if (existing) {
              await ensureCouple(existing.id);
              return true;
            }
          }

          return false;
        }

        if (user.id) await ensureCouple(user.id);
        return true;
      } catch (error) {
        console.error("signIn callback error:", error);
        return false;
      }
    },
    async jwt({ token, user, trigger }) {
      // Persist identity into the token at sign-in — later session calls
      // carry only the token (no `user`), so everything session needs must
      // be stamped here. `sub` is set by core; role is ours to keep.
      if (user?.id) {
        (token as { role?: string }).role =
          (user as { role?: string }).role || "PARTNER";
        // Stamp explicitly rather than relying on core's defaultToken — the
        // token must carry the photo from the very first login, for both
        // credentials and OAuth sign-ins.
        token.name = user.name ?? token.name;
        token.email = user.email ?? token.email;
        token.picture = user.image ?? token.picture;
      }
      // Profile edits call update() after PUT /api/user — re-stamp the token
      // from the DB so Navbar/Sidebar avatars refresh in realtime instead of
      // going stale until re-login. Fail-open: keep the old token on error.
      if (trigger === "update" && token.sub) {
        try {
          const fresh = await prisma.user.findUnique({
            where: { id: token.sub },
            select: { name: true, image: true, role: true },
          });
          if (fresh) {
            token.name = fresh.name;
            token.picture = fresh.image;
            (token as { role?: string }).role = fresh.role;
          }
        } catch (e) {
          console.error("jwt update refresh error:", e);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.sub as string) ?? "";
        (session.user as { role: string }).role =
          (token as { role?: string }).role || "PARTNER";
      }
      return session;
    },
  },
});
