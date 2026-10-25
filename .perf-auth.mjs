// Throwaway: mints a short-lived Auth.js session cookie for local audits.
import { encode } from "@auth/core/jwt";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "./lib/generated/prisma/index.js";

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
});
const member = await prisma.coupleMember.findFirst({
  include: { user: true, couple: true },
});
const user = member?.user ?? (await prisma.user.findFirst());
if (!user) throw new Error("no users in db");

const maxAge = 900;
const token = await encode({
  token: {
    sub: user.id,
    name: user.name,
    email: user.email,
    picture: user.image,
    role: user.role,
  },
  secret: process.env.AUTH_SECRET,
  salt: "authjs.session-token",
  maxAge,
});

console.log(
  JSON.stringify({
    userId: user.id,
    name: user.name,
    role: user.role,
    coupleId: member?.coupleId ?? null,
    token,
    maxAge,
  }),
);
await prisma.$disconnect();
