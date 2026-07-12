import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Navbar, Sidebar, BottomNav } from "@/components/layout";
import LayoutTransition from "@/components/LayoutTransition";

export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <>
      <Navbar />
      <div className="flex min-h-screen pt-16 overflow-x-hidden">
        <Sidebar />
        <main className="flex-1 w-0 min-w-0 px-4 py-6 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] sm:px-6 lg:px-8 lg:pb-6 xl:px-10">
          <LayoutTransition>{children}</LayoutTransition>
        </main>
      </div>
      <BottomNav />
    </>
  );
}
