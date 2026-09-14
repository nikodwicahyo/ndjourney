import { Suspense } from "react";
import type { Metadata } from "next";
import PublicWishList from "@/components/wishlist/PublicWishList";
import ManagePageButton from "@/components/layout/ManagePageButton";
import { Target } from "lucide-react";

export const metadata: Metadata = { title: "Wishlist" };

export default async function WishlistPage() {
  return (
    <>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-heading text-xl sm:text-2xl lg:text-3xl break-words"><Target className="h-6 w-6 text-primary" /> Wish List</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Impian dan keinginan yang ingin diwujudkan bersama
          </p>
        </div>
        <ManagePageButton href="/dashboard/wishlist" label="Kelola Wish List" />
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
