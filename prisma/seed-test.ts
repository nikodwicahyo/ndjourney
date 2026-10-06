/**
 * Seed khusus TEST database (E2E/Playwright). Idempotent dan non-destruktif
 * (kecuali flag --reset): menyiapkan SATU couple utuh —
 * TEST_USER_EMAIL (partner A, dari secrets) + partner B pendamping.
 * Couple utuh itu syarat konten E2E (editor surat, peta lokasi, /api/partner
 * semuanya butuh pasangan; user tanpa couple hanya dapat 404/empty state).
 *
 * TEST_DATABASE_URL dipakai sebagai DATABASE_URL (dipetakan sebelum Prisma
 * Client dibuat, karena ../lib/prisma membaca env saat modul dimuat).
 * Kredensial tidak pernah di-log.
 *
 *   npm run db:seed:test   (env dari shell / CI Secrets / .env.test yang di-source)
 *
 * Flag opsional --reset: hapus SEMUA user (cascade ke konten) lalu bangun
 * ulang dari nol. Hanya untuk test database — jangan pernah ke production.
 * Wajib dipakai bila test-DB terkontaminasi data lain (kuota 2-partner penuh,
 * singleton-couple terisi pasangan lain) — persis kondisi branch test saat ini.
 */
async function main(): Promise<void> {
  const testUrl = process.env.TEST_DATABASE_URL?.trim();
  if (!testUrl) {
    throw new Error("TEST_DATABASE_URL wajib diisi (connection string database khusus testing).");
  }
  const email = process.env.TEST_USER_EMAIL?.toLowerCase().trim();
  const password = process.env.TEST_USER_PASSWORD ?? "";
  if (!email) {
    throw new Error("TEST_USER_EMAIL wajib diisi.");
  }
  if (!password) {
    throw new Error("TEST_USER_PASSWORD wajib diisi.");
  }

  // Map sebelum Prisma Client diinisialisasi.
  process.env.DATABASE_URL = testUrl;
  const [{ prisma }, { default: bcrypt }] = await Promise.all([
    import("../lib/prisma"),
    import("bcryptjs"),
  ]);

  try {
    if (process.argv.includes("--reset")) {
      const deleted = await prisma.user.deleteMany({});
      console.log(`[seed:test] reset: ${deleted.count} user dihapus dari test database.`);
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.upsert({
      where: { email },
      update: { name: "E2E Partner", password: hashedPassword, role: "PARTNER" },
      create: { name: "E2E Partner", email, password: hashedPassword, role: "PARTNER" },
      select: { id: true, email: true, role: true },
    });
    console.log(`[seed:test] test user siap: ${user.email} (${user.role})`);

    // Partner B pendamping — tidak pernah login (password acak), hanya agar
    // user test punya pasangan. Email bisa dioverride via TEST_PARTNER_EMAIL.
    const partnerEmail = (process.env.TEST_PARTNER_EMAIL?.toLowerCase().trim() || "e2e-partner@example.com");
    const partner = await prisma.user.upsert({
      where: { email: partnerEmail },
      update: { name: "E2E Partner B", role: "PARTNER" },
      create: {
        name: "E2E Partner B",
        email: partnerEmail,
        password: await bcrypt.hash(crypto.randomUUID(), 12),
        role: "PARTNER",
      },
      select: { id: true, email: true },
    });

    await ensureTestCouple(prisma, user.id, partner.id);
    // Couple pairing tidak perlu di-seed manual selain ini: login credentials
    // pertama juga memicu ensureCouple() otomatis via signIn callback.
  } finally {
    await prisma.$disconnect();
  }
}

type SeedPrisma = {
  coupleMember: {
    findUnique(args: { where: { userId: string } }): Promise<{ coupleId: string } | null>;
    create(args: { data: { coupleId: string; userId: string } }): Promise<unknown>;
    createMany(args: { data: Array<{ coupleId: string; userId: string }>; skipDuplicates?: boolean }): Promise<unknown>;
    count(args: { where: { coupleId: string } }): Promise<number>;
  };
  couple: {
    create(args: { data: Record<string, never> }): Promise<{ id: string }>;
    findFirst(args: {
      orderBy: { createdAt: "asc" };
      include: { _count: { select: { members: true } } };
    }): Promise<{ id: string; _count: { members: number } } | null>;
  };
};

/**
 * Pasangkan user test ke satu couple, menghormati batasan DB: maksimal SATU
 * baris Couple (unique singleton) dan maksimal 2 anggota (aturan aplikasi).
 * Idempoten — aman di-rerun dan aman bila user sudah berpasangan.
 */
async function ensureTestCouple(prisma: SeedPrisma, userAId: string, userBId: string): Promise<void> {
  const aMember = await prisma.coupleMember.findUnique({ where: { userId: userAId } });
  if (aMember) {
    console.log("[seed:test] test user sudah berpasangan, dipertahankan.");
    return;
  }

  const bMember = await prisma.coupleMember.findUnique({ where: { userId: userBId } });
  if (bMember) {
    const n = await prisma.coupleMember.count({ where: { coupleId: bMember.coupleId } });
    if (n < 2) {
      await prisma.coupleMember.create({ data: { coupleId: bMember.coupleId, userId: userAId } });
      console.log("[seed:test] test user digabung ke couple partner B.");
      return;
    }
    console.warn("[seed:test] PERINGATAN: couple penuh — test user tanpa pasangan. Jalankan dengan --reset.");
    return;
  }

  const existing = await prisma.couple.findFirst({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { members: true } } },
  });
  if (!existing) {
    const created = await prisma.couple.create({ data: {} });
    await prisma.coupleMember.createMany({
      data: [
        { coupleId: created.id, userId: userAId },
        { coupleId: created.id, userId: userBId },
      ],
    });
    console.log("[seed:test] couple test baru dibuat (2 anggota).");
    return;
  }
  if (existing._count.members < 2) {
    await prisma.coupleMember.createMany({
      data: [
        { coupleId: existing.id, userId: userAId },
        { coupleId: existing.id, userId: userBId },
      ],
      skipDuplicates: true,
    });
    console.log("[seed:test] test user + partner B dimasukkan ke couple yang ada.");
    return;
  }
  console.warn("[seed:test] PERINGATAN: couple penuh — test user tanpa pasangan. Jalankan dengan --reset.");
}

main().catch((e: unknown) => {
  console.error("[seed:test] gagal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
