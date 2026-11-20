import { createHmac, randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const DEVICE_LINK_TTL_MS = 10 * 60 * 1000;
export const DEVICE_LINK_MAX_ATTEMPTS = 3;

// Cost-10 hash of a random 6-digit string. Compared (and discarded) on unknown
// codes so a miss costs the same bcrypt round as a hit — no code-existence
// oracle via response time.
const DUMMY_CODE_HASH = "$2b$10$sF4jCBtGHOpxIGsXtLp3cOooTTCYl5Q7015Ha1d0hf2GGExCrxBiq";

export type DeviceLinkUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: "PARTNER" | "ADMIN";
};

export function generateDeviceCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function isValidDeviceCode(code: unknown): code is string {
  return typeof code === "string" && /^\d{6}$/.test(code);
}

/**
 * Indexed lookup key for a code. bcrypt is intentionally not used here: an
 * O(1) lookup is required, and an HMAC keyed by the server secret makes the
 * 6-digit value unrecoverable from a database dump (the attacker lacks the
 * key). The bcrypt hash stored alongside is the slow verifier.
 */
export function codeLookupHash(code: string): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required for device links");
  return createHmac("sha256", secret).update(code).digest("hex");
}

/** Create a code, invalidating any earlier code for the same user. */
export async function createDeviceLink(userId: string): Promise<{
  code: string;
  expiresAt: string;
}> {
  const code = generateDeviceCode();
  const expiresAt = new Date(Date.now() + DEVICE_LINK_TTL_MS);

  await prisma.deviceLinkCode.deleteMany({ where: { userId } });
  await prisma.deviceLinkCode.create({
    data: {
      userId,
      codeHash: await bcrypt.hash(code, 10),
      lookupHash: codeLookupHash(code),
      expiresAt,
    },
  });

  return { code, expiresAt: expiresAt.toISOString() };
}

/**
 * Verify and atomically claim a code. Returns the linked user, or null for
 * every failure mode (no oracle). The `updateMany` guard makes a code single-use
 * even if two requests race.
 */
export async function consumeDeviceCode(
  code: unknown,
  deviceId?: unknown,
): Promise<DeviceLinkUser | null> {
  if (!isValidDeviceCode(code)) return null;

  const record = await prisma.deviceLinkCode.findUnique({
    where: { lookupHash: codeLookupHash(code) },
    include: { user: true },
  });

  // Always pay one bcrypt round, even on a miss.
  const valid = await bcrypt.compare(code, record?.codeHash ?? DUMMY_CODE_HASH);
  if (!record || !valid) {
    if (record) {
      await prisma.deviceLinkCode.update({
        where: { id: record.id },
        data: {
          attempts: { increment: 1 },
          ...(record.attempts + 1 >= DEVICE_LINK_MAX_ATTEMPTS
            ? { usedAt: new Date() }
            : {}),
        },
      });
    }
    return null;
  }

  if (record.usedAt || record.expiresAt.getTime() <= Date.now()) return null;

  const claimed = await prisma.deviceLinkCode.updateMany({
    where: { id: record.id, usedAt: null, attempts: { lt: DEVICE_LINK_MAX_ATTEMPTS } },
    data: {
      usedAt: new Date(),
      deviceId: typeof deviceId === "string" && deviceId ? deviceId : null,
    },
  });
  if (claimed.count !== 1) return null;

  return {
    id: record.user.id,
    email: record.user.email,
    name: record.user.name,
    image: record.user.image,
    role: record.user.role,
  };
}

/** Revoke every outstanding code for a user (logout / opt-out). */
export async function revokeDeviceLinks(userId: string): Promise<void> {
  await prisma.deviceLinkCode.deleteMany({ where: { userId } });
}
