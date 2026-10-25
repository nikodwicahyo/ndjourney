import type { Metadata } from "next";
import PublicTimelineList from "@/components/timeline/PublicTimelineList";
import ManagePageButton from "@/components/layout/ManagePageButton";
import PageTransition from "@/components/PageTransition";
import { CalendarDays } from "lucide-react";

export const metadata: Metadata = { title: "Timeline" };

export const revalidate = 60;

export default function TimelinePage() {
  return (
    <PageTransition>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-heading text-xl sm:text-2xl lg:text-3xl break-words"><CalendarDays className="h-6 w-6 text-primary" /> Love Timeline</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Setiap momen indah dalam perjalanan kita
          </p>
        </div>
        <ManagePageButton href="/dashboard/timeline" label="Kelola Timeline" />
      </div>

      <PublicTimelineList />
    </PageTransition>
  );
}
