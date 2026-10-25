import type { Metadata } from "next";
import PublicGameClient from "@/components/games/PublicGameClient";
import PageTransition from "@/components/PageTransition";

export const metadata: Metadata = { title: "Games" };

export default function GamesPage() {
  return (
    <PageTransition>
      <PublicGameClient />
    </PageTransition>
  );
}
