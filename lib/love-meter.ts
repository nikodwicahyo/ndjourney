import { prisma } from "@/lib/prisma";

export type LoveMeterCounts = {
  milestoneCount: number;
  noteCount: number;
  letterCount: number;
  photoCount: number;
};

export type LoveMeterTargets = {
  targetMilestones: number;
  targetNotes: number;
  targetLetters: number;
  targetPhotos: number;
};

type LoveMeterDbState = LoveMeterTargets & {
  targetSetAt: Date | null;
  targetMetAt: Date | null;
};

export type LoveMeterState = LoveMeterDbState & {
  justMet: boolean;
  justUpdated: boolean;
};

function computeTarget(value: number): number {
  if (value === 0) return 3;
  if (value < 10) return Math.ceil(value * 1.1);
  if (value < 25) return Math.ceil(value * 1.3);
  if (value < 50) return Math.ceil(value * 1.5);
  if (value < 100) return Math.ceil(value * 1.7);
  if (value < 250) return Math.ceil(value * 2);
  if (value < 500) return Math.ceil(value * 2.5);
  return Math.ceil(value * 3);
}

export function calculateTargets(counts: LoveMeterCounts): LoveMeterTargets {
  return {
    targetMilestones: computeTarget(counts.milestoneCount),
    targetNotes: computeTarget(counts.noteCount),
    targetLetters: computeTarget(counts.letterCount),
    targetPhotos: computeTarget(counts.photoCount),
  };
}

function allMet(counts: LoveMeterCounts, targets: LoveMeterTargets): boolean {
  return (
    counts.milestoneCount >= targets.targetMilestones &&
    counts.noteCount >= targets.targetNotes &&
    counts.letterCount >= targets.targetLetters &&
    counts.photoCount >= targets.targetPhotos
  );
}

export async function ensureLoveMeterTargets(
  counts: LoveMeterCounts,
): Promise<LoveMeterState> {
  const config = await prisma.coupleConfig.findFirst({ take: 1 });
  if (!config) {
    return {
      targetMilestones: computeTarget(0),
      targetNotes: computeTarget(0),
      targetLetters: computeTarget(0),
      targetPhotos: computeTarget(0),
      targetSetAt: null,
      targetMetAt: null,
      justMet: false,
      justUpdated: false,
    };
  }

  const now = new Date();
  const existingTargets: LoveMeterDbState = {
    targetMilestones: config.targetMilestones ?? 0,
    targetNotes: config.targetNotes ?? 0,
    targetLetters: config.targetLetters ?? 0,
    targetPhotos: config.targetPhotos ?? 0,
    targetSetAt: config.targetSetAt,
    targetMetAt: config.targetMetAt,
  };

  if (!config.targetMilestones) {
    const fresh = calculateTargets(counts);
    await prisma.coupleConfig.update({
      where: { id: config.id },
      data: {
        targetMilestones: fresh.targetMilestones,
        targetNotes: fresh.targetNotes,
        targetLetters: fresh.targetLetters,
        targetPhotos: fresh.targetPhotos,
        targetSetAt: now,
        targetMetAt: null,
      },
    });
    return { ...fresh, targetSetAt: now, targetMetAt: null, justMet: false, justUpdated: false };
  }

  const met = allMet(counts, existingTargets);
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  if (met && existingTargets.targetMetAt) {
    const diff = now.getTime() - new Date(existingTargets.targetMetAt).getTime();
    if (diff >= sevenDays) {
      const fresh = calculateTargets(counts);
      await prisma.coupleConfig.update({
        where: { id: config.id },
        data: {
          targetMilestones: fresh.targetMilestones,
          targetNotes: fresh.targetNotes,
          targetLetters: fresh.targetLetters,
          targetPhotos: fresh.targetPhotos,
          targetSetAt: now,
          targetMetAt: null,
        },
      });
      return { ...fresh, targetSetAt: now, targetMetAt: null, justMet: false, justUpdated: true };
    }
    return { ...existingTargets, justMet: true, justUpdated: false };
  }

  if (met && !existingTargets.targetMetAt) {
    await prisma.coupleConfig.update({
      where: { id: config.id },
      data: { targetMetAt: now },
    });
    return { ...existingTargets, targetMetAt: now, justMet: true, justUpdated: false };
  }

  if (!met && existingTargets.targetMetAt) {
    await prisma.coupleConfig.update({
      where: { id: config.id },
      data: { targetMetAt: null },
    });
    return { ...existingTargets, targetMetAt: null, justMet: false, justUpdated: false };
  }

  return { ...existingTargets, justMet: false, justUpdated: false };
}
