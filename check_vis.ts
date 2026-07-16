import { PrismaClient } from "./lib/generated/prisma";
const p = new PrismaClient();
(async () => {
  const pub = await p.photo.count({ where: { isPublic: true, isMilestoneOnly: false } });
  const priv = await p.photo.count({ where: { isPublic: false, isMilestoneOnly: false } });
  console.log("public:", pub, "private:", priv);
  await p.$disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
