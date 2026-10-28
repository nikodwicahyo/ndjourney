import { HydrationBoundary } from "@tanstack/react-query";
import LetterViewer from "@/components/letters/LetterViewer";
import PageTransition from "@/components/PageTransition";
import { auth } from "@/lib/auth";
import { getLetterDetail } from "@/lib/queries/letter";
import { prefetchServerQueries } from "@/lib/server-prefetch";
import { queryKeys } from "@/lib/query-keys";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Letter" };

export default async function LetterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Seed react-query server-side so the letter paints with the first HTML.
  // getLetterDetail returns the letter payload itself (NOT the API's
  // `{ data: ... }` envelope) — useLetter reads that same shape. Locked
  // capsules hydrate the partial payload (no content leak).
  const state = await prefetchServerQueries([async (qc) => {
    const session = await auth();
    if (!session?.user) return;
    const result = await getLetterDetail(session.user.id, id);
    if (result.status !== "ok") return;
    await qc.prefetchQuery({
      queryKey: queryKeys.letters.detail(id),
      queryFn: async () => result.data,
    });
  }]);

  return (
    <HydrationBoundary state={state}>
      <PageTransition>
        <div>
          <LetterViewer id={id} />
        </div>
      </PageTransition>
    </HydrationBoundary>
  );
}
