import { Navbar, BottomNav } from "@/components/layout";
import LayoutTransition from "@/components/LayoutTransition";
import PublicMusicPlayer from "@/components/layout/PublicMusicPlayer";
import { RealtimeSyncClient } from "@/components/RealtimeSyncClient";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  let coupleId: string | undefined;

  if (session?.user) {
    const membership = await prisma.coupleMember.findUnique({
      where: { userId: session.user.id },
      select: { coupleId: true },
    });
    coupleId = membership?.coupleId ?? undefined;
  }

  return (
    <>
      {coupleId && <RealtimeSyncClient coupleId={coupleId} />}
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
