import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LocationManager } from "@/components/dashboard";
import PageTransition from "@/components/PageTransition";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Lokasi Pasangan" };

export default async function LocationPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <PageTransition>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
        <LocationManager />
      </Suspense>
    </PageTransition>
  );
}
