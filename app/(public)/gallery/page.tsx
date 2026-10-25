import type { Metadata } from "next";
import PublicGallery from "@/components/gallery/PublicGallery";
import PageTransition from "@/components/PageTransition";
import ScrollToTopButton from "@/components/ui/ScrollToTopButton";

export const metadata: Metadata = { title: "Gallery" };

export const revalidate = 60;

export default function GalleryPage() {
  return (
    <PageTransition>
      <PublicGallery />
      <ScrollToTopButton variant="public" />
    </PageTransition>
  );
}
