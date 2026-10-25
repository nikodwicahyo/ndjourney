import type { Metadata } from "next";
import PublicWishList from "@/components/wishlist/PublicWishList";
import ManagePageButton from "@/components/layout/ManagePageButton";
import { Target } from "lucide-react";

export const metadata: Metadata = { title: "Wishlist" };

export default function WishlistPage() {
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

      <PublicWishList />
    </>
  );
}
