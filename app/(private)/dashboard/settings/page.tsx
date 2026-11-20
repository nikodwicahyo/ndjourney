import { SettingsForm } from "@/components/dashboard";
import PushSettingsToggle from "@/components/notifications/PushSettingsToggle";
import DeviceLinkPanel from "@/components/location/DeviceLinkPanel";
import NativePermissionGuide from "@/components/location/NativePermissionGuide";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import PageTransition from "@/components/PageTransition";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <PageTransition>
    <div>
      <div className="mb-8">
        <h1 className="font-heading text-xl sm:text-2xl lg:text-3xl break-words">Pengaturan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Atur profil pasangan dan preferensi
        </p>
      </div>

      <section className="mb-8 w-full max-w-xl empty:hidden">
        <PushSettingsToggle />
      </section>

      <NativePermissionGuide />
      <DeviceLinkPanel />

      <section className="mb-8 w-full max-w-xl rounded-2xl border border-border bg-card p-5">
        <h2 className="font-heading text-lg">Pasang aplikasi</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Unduh APK Android atau lihat cara menambahkan NDjourney ke layar utama.
        </p>
        <Link
          href="/get-app"
          className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Buka panduan pemasangan
        </Link>
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
