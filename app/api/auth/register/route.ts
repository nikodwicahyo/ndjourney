import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { checkRateLimit } from "@/lib/redis";
import { withAnonymousRateLimit } from "@/lib/rate-limit";
import { safeTokenEqual } from "@/lib/api-body";
import { ensureCouple, normalizeEmail } from "@/lib/auth";

const registerSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi").max(100),
  email: z.string().email("Email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter").max(72, "Password maksimal 72 karakter"),
  inviteToken: z.string().min(1, "Token undangan wajib diisi"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (body == null) return NextResponse.json({ error: "Body JSON tidak valid" }, { status: 400 });
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validasi gagal" },
        { status: 400 },
      );
    }

    let { name, email, password, inviteToken } = parsed.data;
    email = normalizeEmail(email);

    // per-IP gate first (per-email alone is bypassed by rotating emails).
    const ipRl = await withAnonymousRateLimit(request, { maxRequests: 10, windowSeconds: 3600, keyPrefix: "register" });
    if (!ipRl.allowed) return ipRl.response ?? NextResponse.json({ error: "Terlalu banyak percobaan registrasi. Coba lagi nanti." }, { status: 429 });

    const { allowed } = await checkRateLimit(
      `register:${email}`,
      3,
      3600,
    );

    if (!allowed) {
      return NextResponse.json(
        { error: "Terlalu banyak percobaan registrasi. Coba lagi dalam 1 jam." },
        { status: 429 },
      );
    }

    const expectedInvite = (process.env.INVITE_TOKEN ?? "").trim();
    if (!expectedInvite || !safeTokenEqual((inviteToken ?? "").trim(), expectedInvite)) {
      return NextResponse.json(
        { error: "Token undangan tidak valid" },
        { status: 403 },
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // MR-09: quota check-then-create raced — two concurrent registers at
    // count==1 both passed and both created. Serialize the check+create behind
    // a transaction-scoped advisory lock (released on commit/rollback).
    // P2002 mapping below stays as the backstop for same-email races.
    const outcome = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('couple-register-quota'))`;

      const existingUser = await tx.user.findUnique({ where: { email } });
      if (existingUser) return { kind: "duplicate" as const };

      const partnerCount = await tx.user.count({
        where: { role: "PARTNER" },
      });
      if (partnerCount >= 2) return { kind: "quota" as const };

      const created = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });
      return { kind: "created" as const, user: created };
    });

    if (outcome.kind === "duplicate") {
      return NextResponse.json(
        { error: "Email sudah terdaftar" },
        { status: 409 },
      );
    }

    if (outcome.kind === "quota") {
      return NextResponse.json(
        { error: "Kuota pendaftaran penuh. Hanya 2 pasangan yang diizinkan." },
        { status: 403 },
      );
    }

    await ensureCouple(outcome.user.id);

    return NextResponse.json(
      { data: outcome.user, message: "Registrasi berhasil" },
      { status: 201 },
    );
  } catch (error) {
    // concurrent same-email registers race findUnique→create; map P2002 to 409.
    if ((error as { code?: string })?.code === "P2002") {
      return NextResponse.json(
        { error: "Email sudah terdaftar" },
        { status: 409 },
      );
    }
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
}
