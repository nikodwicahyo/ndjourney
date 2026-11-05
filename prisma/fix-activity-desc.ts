import { prisma } from "../lib/prisma";

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  const nameMap = new Map(users.map((u) => [u.id, u.name ?? "Pasangan"]));
  const rows = await prisma.activityEvent.findMany({ where: { type: "photo", body: null } });
  let n = 0;
  for (const r of rows) {
    const name = nameMap.get(r.actorId) ?? "Pasangan";
    await prisma.activityEvent.update({
      where: { id: r.id },
      data: { body: `${name} mengunggah ${r.title === "Video baru" ? "video" : "foto"} baru` },
    });
    n++;
  }
  console.log(`updated ${n} rows`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });