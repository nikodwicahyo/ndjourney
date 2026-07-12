import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import LoginForm from "@/components/auth/LoginForm";
import AuthReasonAlert from "@/components/auth/AuthReasonAlert";
import PageTransition from "@/components/PageTransition";

export const metadata: Metadata = {
  title: "Login",
};

type Props = {
  searchParams: Promise<{ reason?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { reason } = await searchParams;

  return (
    <PageTransition>
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-secondary/30" />
      <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-secondary/20 blur-3xl" />

      <div className="relative z-10 w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <div className="mb-4">
            <span className="inline-block text-5xl">💕</span>
          </div>
          <h1 className="font-heading text-3xl text-foreground">
            NDjourney
          </h1>
          <p className="text-sm text-muted-foreground">
            Tempat semua cerita kita tersimpan selamanya.
          </p>
        </div>

        <Suspense fallback={null}>
          <AuthReasonAlert reason={reason} />
        </Suspense>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-muted" />}>
            <LoginForm />
          </Suspense>
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
