"use client";

import { useSession } from "next-auth/react";
import StatsCards from "./StatsCards";
import QuickActions from "./QuickActions";
import RecentActivity from "./RecentActivity";
import { Skeleton } from "@/components/ui";
import { Heart } from "lucide-react";
import { Suspense } from "react";

export default function DashboardClient() {
  const { data: session } = useSession();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl">
          Halo, {session?.user?.name || "Pasangan"} {session?.user?.name ? "💕" : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Selamat datang di dashboard cinta kalian
        </p>
      </div>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Heart className="h-4 w-4 fill-primary text-primary" />
          <h2 className="font-heading text-lg font-semibold">Statistik</h2>
        </div>
        <StatsCards />
      </section>

      <section>
        <h2 className="mb-4 font-heading text-lg font-semibold">
          Quick Actions
        </h2>
        <QuickActions />
      </section>

      <section>
        <h2 className="mb-4 font-heading text-lg font-semibold">
          Aktivitas Terbaru
        </h2>
        <RecentActivity />
      </section>
    </div>
  );
}
