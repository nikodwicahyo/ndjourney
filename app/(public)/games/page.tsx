import { Suspense } from "react";
import type { Metadata } from "next";
import PublicGameClient from "@/components/games/PublicGameClient";
import PageTransition from "@/components/PageTransition";

export const metadata: Metadata = { title: "Games" };

export default async function GamesPage() {
  return (
    <PageTransition>
      <Suspense fallback={null}>
        <PublicGameClient />
      </Suspense>
    </PageTransition>
  );
}
