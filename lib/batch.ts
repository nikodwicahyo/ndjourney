import { prisma } from "./prisma";

const userSelect = { id: true, name: true, email: true, image: true } as const;
type UserBasic = { id: string; name: string | null; email: string | null; image: string | null };

const MAX_CACHE_SIZE = 100;
const userCache = new Map<string, UserBasic>();

function ensureCacheLimit() {
  if (userCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = userCache.keys().next().value;
    if (oldestKey !== undefined) {
      userCache.delete(oldestKey);
    }
  }
}

export function clearUserCache() {
  userCache.clear();
}

export async function batchLoadUsers(ids: (string | null | undefined)[]): Promise<Map<string, UserBasic>> {
  const uniqueIds = [...new Set(ids.filter(Boolean))] as string[];
  if (uniqueIds.length === 0) return new Map();

  const cached = new Map<string, UserBasic>();
  const uncachedIds: string[] = [];

  for (const id of uniqueIds) {
    const u = userCache.get(id);
    if (u) cached.set(id, u);
    else uncachedIds.push(id);
  }

  if (uncachedIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: uncachedIds } },
      select: userSelect,
    });
    for (const u of users) {
      ensureCacheLimit();
      userCache.set(u.id, u);
      cached.set(u.id, u);
    }
  }

  return cached;
}

export function mapUsersToRecords<T extends { authorId?: string | null; recipientId?: string | null }>(
  records: T[],
  userMap: Map<string, UserBasic>,
): (T & { author?: UserBasic | null; recipient?: UserBasic | null })[] {
  return records.map((r) => ({
    ...r,
    author: r.authorId ? (userMap.get(r.authorId) ?? null) : null,
    recipient: r.recipientId ? (userMap.get(r.recipientId) ?? null) : null,
  }));
}

export function mapUserToCreatedBy<T extends { createdById?: string | null }>(
  records: T[],
  userMap: Map<string, UserBasic>,
): (T & { createdBy?: UserBasic | null })[] {
  return records.map((r) => ({
    ...r,
    createdBy: r.createdById ? (userMap.get(r.createdById) ?? null) : null,
  }));
}

export function mapUserToUploadedBy<T extends { uploadedById?: string | null }>(
  records: T[],
  userMap: Map<string, UserBasic>,
): (T & { uploadedBy?: UserBasic | null })[] {
  return records.map((r) => ({
    ...r,
    uploadedBy: r.uploadedById ? (userMap.get(r.uploadedById) ?? null) : null,
  }));
}
