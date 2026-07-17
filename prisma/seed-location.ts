import { prisma } from "../lib/prisma";

async function main() {
  console.log("📍 Seeding location data for testing...\n");

  const partners = await prisma.user.findMany({
    where: { role: "PARTNER" },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true },
  });

  if (partners.length < 2) {
    console.error("❌ Need at least 2 PARTNER users. Found:", partners.length);
    process.exit(1);
  }

  const [p1, p2] = partners;
  console.log(`  Partner 1: ${p1.name} (${p1.email})`);
  console.log(`  Partner 2: ${p2.name} (${p2.email})`);

  const member = await prisma.coupleMember.findFirst({
    where: { userId: p1.id },
    select: { coupleId: true },
  });

  if (!member) {
    console.error("❌ No couple found for partner users. Run the main seed first (npm run db:seed)");
    process.exit(1);
  }

  console.log(`  Couple ID: ${member.coupleId}\n`);

  const now = new Date();
  const recent = new Date(now.getTime() - 5000);

  const coords = [
    { lat: -6.1751, lng: 106.8272, accuracy: 20 },
    { lat: -6.1795, lng: 106.8300, accuracy: 25 },
  ];

  for (let i = 0; i < 2; i++) {
    const user = i === 0 ? p1 : p2;
    const { lat, lng, accuracy } = coords[i];

    await prisma.locationShare.upsert({
      where: { userId: user.id },
      create: { userId: user.id, coupleId: member.coupleId, isSharing: true },
      update: { isSharing: true },
    });
    console.log(`  ✅ LocationShare — ${user.name}: sharing enabled`);

    await prisma.userLocation.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        coupleId: member.coupleId,
        latitude: lat,
        longitude: lng,
        accuracy,
        heading: i === 0 ? 135 : 315,
        speed: null,
        altitude: null,
        deviceType: "mobile",
        updatedAt: recent,
      },
      update: {
        latitude: lat,
        longitude: lng,
        accuracy,
        heading: i === 0 ? 135 : 315,
        speed: null,
        altitude: null,
        deviceType: "mobile",
        updatedAt: recent,
      },
    });
    console.log(`  ✅ UserLocation — ${user.name}: (${lat}, ${lng}) ±${accuracy}m`);
  }

  console.log("\n🎉 Location seed complete!");
  console.log("   Login as both partners — map, distance, bearing will show immediately.");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
