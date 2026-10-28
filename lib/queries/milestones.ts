import { prisma } from "@/lib/prisma";
import { batchLoadUsers } from "@/lib/batch";
import { toPublicUser } from "@/lib/format";

/**
 * Milestone list with creator + photo relations.
 * Single source for GET /api/milestones and the dashboard timeline page's
 * server-side hydration — both must stay in lockstep.
 *
 * Visibility rules (do not weaken):
 * - authed + couple: own couple rows plus own pre-pairing rows
 * - authed, no couple: own rows plus public rows
 * - anon: isPublic rows only, and only public photos of them
 */
export async function listMilestones(opts: {
  isAuthed: boolean;
  coupleId: string | null;
  userId: string | null;
  page: number;
  limit: number;
}) {
  const { isAuthed, coupleId, userId, page, limit } = opts;

  const where = isAuthed && userId
    ? coupleId
      ? { OR: [{ coupleId }, { coupleId: null, createdById: userId }] }
      : { OR: [{ isPublic: true }, { coupleId: null, createdById: userId }] }
    : { isPublic: true };

  // 1 round-trip (was 2 sequential).
  const [milestones, total] = await Promise.all([
    prisma.milestone.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        title: true,
        description: true,
        date: true,
        icon: true,
        color: true,
        location: true,
        isPublic: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.milestone.count({ where }),
  ]);

  const userIds = milestones.map((m) => m.createdById);
  const milestoneIds = milestones.map((m) => m.id);

  // Couple members share all photos; a solo caller may see private photos
  // only on rows they created — public rows of others stay public-photo-only.
  const privateMilestoneIds =
    isAuthed && coupleId
      ? milestoneIds
      : isAuthed && userId
        ? milestones.filter((m) => m.createdById === userId).map((m) => m.id)
        : [];
  const publicOnlyMilestoneIds = milestoneIds.filter((id) => !privateMilestoneIds.includes(id));
  const publicPhotoRule = {
    isPublic: true,
    OR: [{ albumId: null }, { album: { isPublic: true } }],
  };

  const [userMap, photoRecords] = await Promise.all([
    batchLoadUsers(userIds),
    milestoneIds.length > 0
      ? prisma.milestonePhoto.findMany({
          // anon and non-owners see only public photos of public milestones
          // (a private photo in a public milestone stays hidden).
          where: {
            OR: [
              ...(privateMilestoneIds.length > 0 ? [{ milestoneId: { in: privateMilestoneIds } }] : []),
              ...(publicOnlyMilestoneIds.length > 0
                ? [{ milestoneId: { in: publicOnlyMilestoneIds }, photo: publicPhotoRule }]
                : []),
            ],
          },
          select: {
            milestoneId: true,
            crop: true,
            photo: {
              select: { id: true, url: true, thumbnailUrl: true, caption: true },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const photosByMilestone = new Map<string, Array<{ milestoneId: string; crop: unknown; photo: { id: string; url: string; thumbnailUrl: string | null; caption: string | null } }>>();
  for (const rec of photoRecords) {
    const existing = photosByMilestone.get(rec.milestoneId);
    if (existing) {
      existing.push(rec);
    } else {
      photosByMilestone.set(rec.milestoneId, [rec]);
    }
  }

  const data = milestones.map((m) => ({
    ...m,
    createdBy: toPublicUser(userMap.get(m.createdById)),
    photos: photosByMilestone.get(m.id) ?? [],
  }));

  return { data, total, page, limit };
}
