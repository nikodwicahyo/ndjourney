import type { Metadata } from "next";
import PageTransition from "@/components/PageTransition";
import GetAppContent from "@/components/native/GetAppContent";

export const metadata: Metadata = {
  title: "Pasang aplikasi",
  description: "Pasang NDjourney di Android atau tambahkan ke layar utama di iPhone.",
};

export default function GetAppPage() {
  return (
    <PageTransition>
      <div className="py-4">
        <GetAppContent />
      </div>
    </PageTransition>
  );
}
