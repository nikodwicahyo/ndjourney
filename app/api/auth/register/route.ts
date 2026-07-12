import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { checkRateLimit } from "@/lib/redis";
import { ensureCouple } from "@/lib/auth";

const registerSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi").max(100),
  email: z.string().email("Email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  inviteToken: z.string().min(1, "Token undangan wajib diisi"),
});

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validasi gagal" },
        { status: 400 },
      );
    }

    let { name, email, password, inviteToken } = parsed.data;
    email = normalizeEmail(email);

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

    if (inviteToken !== process.env.INVITE_TOKEN) {
      return NextResponse.json(
        { error: "Token undangan tidak valid" },
        { status: 403 },
      );
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email sudah terdaftar" },
        { status: 409 },
      );
    }

    const partnerCount = await prisma.user.count({
      where: { role: "PARTNER" },
    });

    if (partnerCount >= 2) {
      return NextResponse.json(
        { error: "Kuota pendaftaran penuh. Hanya 2 pasangan yang diizinkan." },
        { status: 403 },
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
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

    await ensureCouple(user.id);

    return NextResponse.json(
      { data: user, message: "Registrasi berhasil" },
      { status: 201 },
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
}
