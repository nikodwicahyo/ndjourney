import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, Heart } from "lucide-react";
import LoginForm from "@/components/auth/LoginForm";
import AuthReasonAlert from "@/components/auth/AuthReasonAlert";
import PageTransition from "@/components/PageTransition";
import { getPublicCoupleConfig } from "@/lib/couple-config";
import { APP_NAME, resolveTagline } from "@/lib/couple-display";

export const metadata: Metadata = {
  title: "Login",
};

type Props = {
  searchParams: Promise<{ reason?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { reason } = await searchParams;
  const config = await getPublicCoupleConfig();

  return (
    <PageTransition>
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-secondary/30" />
      <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-secondary/20 blur-3xl" />

      <div className="relative z-10 w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <div className="mb-4">
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"><Heart className="h-8 w-8 fill-primary text-primary" /></span>
          </div>
          <h1 className="font-heading text-2xl text-foreground sm:text-3xl break-words">
            {APP_NAME}
          </h1>
          <p className="text-sm text-muted-foreground">
            {resolveTagline(config?.tagline)}
          </p>
        </div>

        <Suspense fallback={null}>
          <AuthReasonAlert reason={reason} />
        </Suspense>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <Suspense fallback={<div className="h-48 animate-pulse motion-reduce:animate-none rounded-xl bg-muted" />}>
            <LoginForm />
          </Suspense>
        </div>

        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    </div>
    </PageTransition>
  );
}
