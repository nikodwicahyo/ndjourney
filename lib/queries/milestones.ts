import { prisma } from "@/lib/prisma";
import { batchLoadUsers } from "@/lib/batch";
import { toPublicUser } from "@/lib/format";

/**
 * Milestone list with creator + photo relations.
 * Single source for GET /api/milestones and the dashboard timeline page's
 * server-side hydration — both must stay in lockstep.
 *
 * Visibility rules (do not weaken):
 * - authed + couple: own couple rows plus legacy shared (coupleId null)
 * - anon/unpaired: isPublic rows only, and only public photos of them
 */
export async function listMilestones(opts: {
  isAuthed: boolean;
  coupleId: string | null;
  page: number;
  limit: number;
}) {
  const { isAuthed, coupleId, page, limit } = opts;

  const where = isAuthed && coupleId
    ? { OR: [{ coupleId }, { coupleId: null }] }
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

  const [userMap, photoRecords] = await Promise.all([
    batchLoadUsers(userIds),
    milestoneIds.length > 0
      ? prisma.milestonePhoto.findMany({
          // anon and unpaired callers see only public photos of public
          // milestones (private photo in a public milestone stays hidden).
          where: {
            milestoneId: { in: milestoneIds },
            ...(isAuthed && coupleId ? {} : {
              photo: {
                isPublic: true,
                OR: [{ albumId: null }, { album: { isPublic: true } }],
              },
            }),
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
