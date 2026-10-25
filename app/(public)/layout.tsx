import { Navbar, BottomNav } from "@/components/layout";
import LayoutTransition from "@/components/LayoutTransition";
import PublicMusicPlayer from "@/components/layout/PublicMusicPlayer";
import { RealtimeSyncClient } from "@/components/RealtimeSyncClient";
import { prisma } from "@/lib/prisma";

// The public segment must not read cookies: auth() here forced EVERY public
// page to render dynamically, which silently disabled the `revalidate` on
// /gallery and /timeline and made TTFB depend on the database. Session-aware
// UI (navbar, realtime) is resolved client-side instead.
async function getCoupleId(): Promise<string | undefined> {
  try {
    const couple = await prisma.couple.findFirst({ select: { id: true } });
    return couple?.id;
  } catch {
    return undefined;
  }
}

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const coupleId = await getCoupleId();

  return (
    <>
      <RealtimeSyncClient coupleId={coupleId} />
      <Navbar />
      <main className="min-h-screen pt-16 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] lg:pb-0 overflow-x-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:px-10">
          <LayoutTransition>{children}</LayoutTransition>
        </div>
      </main>
      <BottomNav />
      <PublicMusicPlayer />
    </>
  );
}
