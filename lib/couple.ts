import { prisma } from './prisma';

export async function getUserCoupleId(
  userId: string,
): Promise<string | null> {
  try {
    const member = await prisma.coupleMember.findUnique({
      where: { userId },
      select: { coupleId: true },
    });
    return member?.coupleId ?? null;
  } catch (error) {
    console.error('[getUserCoupleId]', error);
    return null;
  }
}

/** User ids whose uploads belong to the couple's shared media namespace. */
export async function getCoupleMemberIds(coupleId: string): Promise<string[]> {
  try {
    const members = await prisma.coupleMember.findMany({
      where: { coupleId },
      select: { userId: true },
    });
    return members.map((member) => member.userId);
  } catch (error) {
    console.error('[getCoupleMemberIds]', error);
    return [];
  }
}
