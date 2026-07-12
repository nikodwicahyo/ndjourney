import { Navbar, BottomNav } from "@/components/layout";
import LayoutTransition from "@/components/LayoutTransition";
import PublicMusicPlayer from "@/components/layout/PublicMusicPlayer";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
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
