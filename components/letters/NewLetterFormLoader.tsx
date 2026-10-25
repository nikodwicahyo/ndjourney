"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui";

// Drafts live in localStorage, so the form must render after hydration. Keeping
// it client-only lets the state initializers read the draft before first paint.
const NewLetterForm = dynamic(() => import("./NewLetterForm"), {
  ssr: false,
  loading: () => (
    <div className="space-y-4" aria-hidden="true">
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-56 w-full rounded-xl" />
    </div>
  ),
});

export default function NewLetterFormLoader({ userId }: { userId: string }) {
  return <NewLetterForm userId={userId} />;
}
