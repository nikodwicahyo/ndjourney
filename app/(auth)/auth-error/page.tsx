import Link from "next/link";
import { cookies } from "next/headers";
import { ShieldAlert, Timer, Ban, LogIn, Home, KeyRound, UserX } from "lucide-react";
import PageTransition from "@/components/PageTransition";

type Props = {
  searchParams: Promise<{ error?: string; reason?: string }>;
};

const errorIcons: Record<string, typeof ShieldAlert> = {
  AccessDenied: Ban,
  OAuthAccountNotLinked: UserX,
  OAuthSignin: ShieldAlert,
  OAuthCallback: ShieldAlert,
  SessionRequired: Timer,
  Configuration: ShieldAlert,
  CallbackRouteError: ShieldAlert,
};

const nextAuthErrors: Record<string, { title: string; description: string }> = {
  AccessDenied: {
    title: "Akses Ditolak",
    description:
      "Kamu belum memiliki akses atau token undangan tidak valid. Hubungi pasanganmu untuk mendapatkan link undangan yang benar.",
  },
  OAuthAccountNotLinked: {
    title: "Akun Tidak Terhubung",
    description:
      "Email ini sudah terdaftar dengan metode masuk lain. Silakan login menggunakan email dan password.",
  },
  OAuthSignin: {
    title: "Gagal Masuk dengan Google",
    description:
      "Terjadi kesalahan saat mencoba masuk dengan Google. Silakan coba lagi atau gunakan email dan password.",
  },
  OAuthCallback: {
    title: "Gagal Masuk dengan Google",
    description:
      "Terjadi kesalahan saat memproses login Google. Silakan coba lagi.",
  },
  SessionRequired: {
    title: "Sesi Diperlukan",
    description:
      "Kamu harus login terlebih dahulu untuk mengakses halaman ini.",
  },
  Configuration: {
    title: "Konfigurasi Error",
    description:
      "Terjadi kesalahan konfigurasi server. Silakan hubungi pengembang.",
  },
  CallbackRouteError: {
    title: "Gagal Masuk",
    description:
      "Terjadi kesalahan saat memproses login. Silakan coba lagi.",
  },
  Default: {
    title: "Terjadi Kesalahan",
    description:
      "Terjadi kesalahan yang tidak terduga. Silakan coba lagi.",
  },
};

const reasons: Record<string, { title: string; description: string }> = {
  expired: {
    title: "Sesi Berakhir",
    description:
      "Sesi kamu telah berakhir. Silakan login kembali untuk melanjutkan.",
  },
  unauthorized: {
    title: "Akses Ditolak",
    description:
      "Kamu tidak memiliki akses ke halaman ini. Silakan login dengan akun yang sesuai.",
  },
};

const authErrorReasons: Record<string, { title: string; description: string }> = {
  email_exists: {
    title: "Email Sudah Terdaftar",
    description:
      "Email ini sudah terdaftar. Gunakan akun Google lain atau login dengan email dan password yang sudah didaftarkan sebelumnya.",
  },
  quota_full: {
    title: "Kuota Pendaftaran Penuh",
    description:
      "Maaf, kuota pendaftaran sudah penuh. Hanya 2 pasangan yang diizinkan. Hubungi Admin untuk informasi lebih lanjut.",
  },
};

function getIcon(error?: string, reason?: string, authErrorReason?: string) {
  if (reason === "expired") return Timer;
  if (authErrorReason === "email_exists") return UserX;
  if (authErrorReason === "quota_full") return Ban;
  if (error && errorIcons[error]) return errorIcons[error];
  if (reason === "unauthorized" || error === "AccessDenied") return Ban;
  return ShieldAlert;
}

function getInfo(error?: string, reason?: string, authErrorReason?: string) {
  if (authErrorReason && authErrorReasons[authErrorReason]) return authErrorReasons[authErrorReason];
  if (reason && reasons[reason]) return reasons[reason];
  if (error && nextAuthErrors[error]) return nextAuthErrors[error];
  return nextAuthErrors.Default;
}

export default async function AuthErrorPage({ searchParams }: Props) {
  const { error, reason } = await searchParams;

  const cookieStore = await cookies();
  const authErrorReason = cookieStore.get("auth_error_reason")?.value;

  const info = getInfo(error, reason, authErrorReason);
  const Icon = getIcon(error, reason, authErrorReason);

  return (
    <PageTransition>
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-secondary/30" />
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-secondary/20 blur-3xl" />

        <div className="relative z-10 w-full max-w-sm">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <Icon className="h-8 w-8 text-destructive" />
              </div>
              <h1 className="font-heading text-xl text-foreground">
                {info.title}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {info.description}
              </p>

              <div className="mt-6 flex w-full flex-col gap-3">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <LogIn className="h-4 w-4" />
                  Masuk
                </Link>
                <Link
                  href="/"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Home className="h-4 w-4" />
                  Kembali ke Beranda
                </Link>
              </div>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Butuh bantuan? Hubungi pasanganmu
          </p>
        </div>
      </div>
    </PageTransition>
  );
}
