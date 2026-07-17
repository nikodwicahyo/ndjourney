import { Suspense } from "react";
import { LocationManager } from "@/components/dashboard";
import PageTransition from "@/components/PageTransition";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Lokasi Pasangan" };

export default function LocationPage() {
  return (
    <PageTransition>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
        <LocationManager />
      </Suspense>
    </PageTransition>
  );
}
