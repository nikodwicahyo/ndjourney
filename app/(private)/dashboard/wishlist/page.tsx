import { Suspense } from "react";
import WishlistManager from "@/components/dashboard/WishlistManager";
import PageTransition from "@/components/PageTransition";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Wishlist" };

export default function WishlistManagerPage() {
  return (
    <PageTransition>
      <div>
        <div className="mb-8">
          <h1 className="font-heading text-3xl">Kelola Wish List</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tambah, edit, dan kelola wish list
          </p>
        </div>

        <Suspense
          fallback={
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          }
        >
          <WishlistManager />
        </Suspense>
      </div>
    </PageTransition>
  );
}
