import Link from "next/link";
import dynamic from "next/dynamic";
import PageTransition from "@/components/PageTransition";

const RegisterForm = dynamic(
  () => import("@/components/auth/RegisterForm"),
  {
    loading: () => <div className="h-48 animate-pulse rounded-xl bg-muted" />,
  },
);

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const expectedToken = (process.env.INVITE_TOKEN || "").trim();
  const isValid = !expectedToken || token.trim() === expectedToken;

  if (!isValid) {
    return (
      <PageTransition>
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-secondary/30" />
        <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-secondary/20 blur-3xl" />

        <div className="relative z-10 w-full max-w-sm">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <span className="text-2xl">🔒</span>
              </div>
              <h1 className="font-heading text-xl text-foreground">Undangan Tidak Valid</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Token undangan tidak valid. Periksa kembali link undangan dari pasanganmu.
              </p>
              <Link
                href="/"
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Kembali ke Beranda
              </Link>
            </div>
          </div>
        </div>
      </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-secondary/30" />
      <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-secondary/20 blur-3xl" />

      <div className="relative z-10 w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <div className="mb-4">
            <span className="inline-block text-5xl">💌</span>
          </div>
          <h1 className="font-heading text-3xl">
            Kamu Diundang!
          </h1>
          <p className="text-sm text-muted-foreground">
            Buat akun untuk mulai menulis cerita bersama.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <RegisterForm token={token} />
        </div>

        <div className="text-center">
          <Link
            href="/"
            className="text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
          >
            ⬅️ Kembali ke Beranda
          </Link>
        </div>
      </div>
    </div>
    </PageTransition>
  );
}
