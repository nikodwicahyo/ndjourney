"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Heart, ShieldAlert, Timer, LogIn } from "lucide-react";

function isAuthError(error: Error) {
  return (
    error.message.includes("sesi") ||
    error.message.includes("Sesi") ||
    error.message.includes("401") ||
    error.message.includes("Unauthorized") ||
    error.message.includes("access") ||
    error.message.includes("Access")
  );
}

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  if (isAuthError(error)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center space-y-6 px-4 text-center">
        <Timer className="h-16 w-16 text-destructive/50" />
        <div className="space-y-2">
          <h1 className="font-heading text-3xl text-destructive">
            Sesi Berakhir
          </h1>
          <p className="text-muted-foreground">
            Sesi kamu telah berakhir. Silakan login kembali.
          </p>
        </div>
        <Link
          href="/login?reason=expired"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <LogIn className="h-4 w-4" />
          Login Kembali
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center space-y-6 px-4 text-center">
      <Heart className="h-16 w-16 text-destructive/50" />
      <div className="space-y-2">
        <h1 className="font-heading text-4xl text-destructive">
          Ada yang salah
        </h1>
        <p className="text-muted-foreground">
          {error.message || "Terjadi kesalahan yang tidak terduga"}
        </p>
        <p className="text-sm text-muted-foreground">
          Silakan coba lagi. Jika masalah berlanjut, hubungi pasanganmu.
        </p>
      </div>
      <button
        onClick={reset}
        className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Coba Lagi
      </button>
    </div>
  );
}
