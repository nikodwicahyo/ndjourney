import { SettingsForm } from "@/components/dashboard";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import PageTransition from "@/components/PageTransition";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <PageTransition>
    <div>
      <div className="mb-8">
        <h1 className="font-heading text-3xl">Pengaturan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Atur profil pasangan dan preferensi
        </p>
      </div>

      <Suspense
        fallback={
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        }
      >
        <SettingsForm />
      </Suspense>
    </div>
    </PageTransition>
  );
}
