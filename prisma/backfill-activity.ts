import { prisma } from "../lib/prisma";

async function main() {
  // Photos
  const photos = await prisma.photo.findMany({
    where: { coupleId: { not: null } },
    select: { id: true, coupleId: true, uploadedById: true, isVideo: true, createdAt: true },
  });
  let n = 0;
  for (const p of photos) {
    const existing = await prisma.activityEvent.findFirst({
      where: { coupleId: p.coupleId!, actorId: p.uploadedById, type: "photo", createdAt: p.createdAt },
    });
    if (existing) continue;
    await prisma.activityEvent.create({
      data: {
        coupleId: p.coupleId!,
        actorId: p.uploadedById,
        type: "photo",
        action: "created",
        title: p.isVideo ? "Video baru" : "Foto baru",
        body: null,
        href: `/dashboard/gallery?photo=${p.id}`,
        level: "both",
        createdAt: p.createdAt,
      },
    });
    n++;
  }
  console.log(`backfilled ${n} photo events`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });