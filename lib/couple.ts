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
