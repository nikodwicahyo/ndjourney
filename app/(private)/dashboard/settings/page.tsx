import { SettingsForm } from "@/components/dashboard";
import PushSettingsToggle from "@/components/notifications/PushSettingsToggle";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import PageTransition from "@/components/PageTransition";
import { Settings as SettingsIcon } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <PageTransition>
    <div>
      <div className="mb-8">
        <h1 className="flex items-center gap-2 font-heading text-xl sm:text-2xl lg:text-3xl break-words">
          <SettingsIcon className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
          Pengaturan
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Atur profil pasangan dan preferensi
        </p>
      </div>

      <section className="mb-8 w-full max-w-xl empty:hidden">
        <PushSettingsToggle />
      </section>

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
