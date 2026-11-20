import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Smartphone } from "lucide-react";
import { auth } from "@/lib/auth";
import NativeLoginForm from "@/components/auth/NativeLoginForm";

export const metadata: Metadata = { title: "Hubungkan Perangkat" };

export default async function NativeLoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-secondary/30" />
      <div className="relative z-10 w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <span className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Smartphone className="h-8 w-8 text-primary" />
          </span>
          <h1 className="font-heading text-2xl text-foreground sm:text-3xl">Hubungkan Perangkat</h1>
          <p className="text-sm text-muted-foreground">
            Buka aplikasi web di komputer, masuk ke Pengaturan → Hubungkan perangkat, lalu masukkan kodenya di sini.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <NativeLoginForm />
        </div>
      </div>
    </div>
  );
}
