import { NextResponse } from "next/server";
import { getGameQuestionCounts } from "@/lib/queries/games";

/**
 * Active question totals per game type — the dashboard tab chips and the
 * "is there more than the first page?" check. Aggregate only (no question
 * text or answer key), so it shares the public listing's trust level.
 */
export async function GET() {
  try {
    const counts = await getGameQuestionCounts();
    return NextResponse.json(
      { data: counts },
      { headers: { "Cache-Control": "private, no-cache" } },
    );
  } catch (error) {
    console.error("Error counting questions:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
