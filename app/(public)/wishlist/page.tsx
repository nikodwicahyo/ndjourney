import { Suspense } from "react";
import type { Metadata } from "next";
import PublicWishList from "@/components/wishlist/PublicWishList";

export const metadata: Metadata = { title: "Wishlist" };

export default async function WishlistPage() {
  return (
    <>
      <div className="mb-8">
        <h1 className="font-heading text-3xl">Wish List 🎯</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Impian dan keinginan yang ingin diwujudkan bersama
        </p>
      </div>

      <Suspense
        fallback={
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        }
      >
        <PublicWishList />
      </Suspense>
    </>
  );
}
