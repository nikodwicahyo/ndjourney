import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { getCached, setCached, redis } from "./redis";

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export async function ensureCouple(userId: string): Promise<void> {
  try {
    const existingMember = await prisma.coupleMember.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (existingMember) return;

    const partnerCount = await prisma.user.count({
      where: { role: "PARTNER" },
    });

    if (partnerCount < 2) return;

    const allPartners = await prisma.user.findMany({
      where: { role: "PARTNER" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    if (allPartners.length < 2) return;

    const existingCoupleMember = await prisma.coupleMember.findFirst({
      where: { userId: { in: allPartners.map((p) => p.id) } },
      select: { coupleId: true, userId: true },
    });

    if (existingCoupleMember) {
      await prisma.coupleMember.create({
        data: { coupleId: existingCoupleMember.coupleId, userId },
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      const couple = await tx.couple.create({ data: {} });
      await tx.coupleMember.createMany({
        data: allPartners.map((p) => ({
          coupleId: couple.id,
          userId: p.id,
        })),
      });
    });
  } catch (error) {
    console.error("ensureCouple error:", error);
  }
}

const prismaAdapter = PrismaAdapter(prisma);

// Wrap getSessionAndUser to cache session and user database queries
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
        await setCached(cacheK, result, 1800); // Cache for 30 minutes (1800s)
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
      }).catch(() => {});
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

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: prismaAdapter,
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  session: { strategy: "database", maxAge: 3 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
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
        if (!credentials?.email || !credentials?.password) return null;

        const email = normalizeEmail(credentials.email as string);

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) return null;

        if (!user.password) {
          try {
            const cookieStore = await cookies();
            cookieStore.set("auth_error_reason", "google_only", {
              httpOnly: false,
              secure: process.env.NODE_ENV === "production",
              sameSite: "lax",
              maxAge: 60,
              path: "/",
            });
          } catch (e) {
            console.error("Failed to set auth error cookie:", e);
          }
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password,
        );

        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
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
          const inviteToken = cookieStore.get("invite_token")?.value;
          const hasValidInvite = inviteToken && inviteToken === process.env.INVITE_TOKEN;

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
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        (session.user as { role: string }).role =
          (user as { role?: string }).role || "PARTNER";
      }
      return session;
    },
  },
});
