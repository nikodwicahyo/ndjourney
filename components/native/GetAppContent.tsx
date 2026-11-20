"use client";

import { useSyncExternalStore, useState } from "react";
import Link from "next/link";
import { Apple, Check, Copy, Download, Smartphone } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui";
import { noopSubscribe } from "@/lib/native/store";
import { getNativePlatform } from "@/lib/location/platform";
import { APK_URL } from "@/lib/native/version";
import PwaInstallButton from "@/components/native/PwaInstallButton";

const APP_URL = "https://ndjourney.vercel.app/get-app";

function isInstalledPwa(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

type View = "android" | "ios" | "desktop" | "native";

function detectView(): View {
  const native = getNativePlatform();
  if (native) return "native";
  const android = /Android/i.test(navigator.userAgent);
  // An installed Android PWA still needs the APK for background tracking —
  // showing Safari instructions there was plain wrong.
  if (isInstalledPwa()) return android ? "android" : "ios";
  if (android) return "android";
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return "ios";
  return "desktop";
}

function AndroidSteps() {
  return (
    <>
      <a
        href={APK_URL}
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        <Download aria-hidden="true" className="mr-2 h-4 w-4" />
        Unduh APK
      </a>
      <ol className="mt-4 space-y-2 text-sm text-muted-foreground">
        <li>1. Buka file APK yang terunduh.</li>
        <li>2. Izinkan &quot;Install dari sumber ini&quot; bila diminta.</li>
        <li>3. Tekan Install, lalu buka NDjourney.</li>
      </ol>
      <p className="mt-3 text-xs text-muted-foreground">
        Saat ada versi baru, aplikasi akan menampilkan notifikasi &quot;Versi baru tersedia&quot;.
        Pembaruan tetap membutuhkan unduhan dan pemasangan manual.
      </p>
    </>
  );
}

function IosSteps() {
  return (
    <>
      <p className="text-sm text-muted-foreground">
        Di iPhone/iPad, aplikasi dipasang sebagai PWA dari Safari. Ini gratis, tetapi pelacakan
        lokasi hanya berjalan selagi aplikasi terbuka.
      </p>
      <ol className="mt-4 space-y-2 text-sm text-muted-foreground">
        <li>1. Buka halaman ini di Safari.</li>
        <li>2. Ketuk tombol Bagikan (kotak dengan panah ke atas).</li>
        <li>3. Pilih &quot;Tambahkan ke Layar Utama&quot;, lalu ketuk Tambahkan.</li>
      </ol>
    </>
  );
}

export default function GetAppContent() {
  // Client-only snapshot with a null server value keeps the static shell stable.
  const view = useSyncExternalStore(noopSubscribe, detectView, () => null);
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(APP_URL);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (!view) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h1 className="text-balance font-heading text-2xl">Pasang NDjourney</h1>
        {view === "native" ? (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-muted-foreground">
              Kamu sudah membuka NDjourney di aplikasi. Tidak perlu memasang ulang.
            </p>
            <Link href="/" className={buttonVariants()}>
              Kembali ke beranda
            </Link>
          </div>
        ) : view === "android" ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Versi Android memberi izin lokasi latar belakang, sehingga posisi tetap dikirim
              meski layar mati.
            </p>
            <div className="mt-5">
              <AndroidSteps />
            </div>
          </>
        ) : view === "ios" ? (
          <div className="mt-4">
            <IosSteps />
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Buka halaman ini di ponsel untuk memasang aplikasi. Salin tautan ini lalu kirim ke
              ponselmu.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <input
                readOnly
                aria-label="Tautan halaman pemasangan"
                value={APP_URL}
                className="min-h-11 min-w-0 flex-1 rounded-md border border-border bg-muted px-3 text-sm"
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button type="button" className="min-h-11" onClick={() => void copyLink()}>
                {copied ? (
                  <Check aria-hidden="true" className="mr-1.5 h-4 w-4" />
                ) : (
                  <Copy aria-hidden="true" className="mr-1.5 h-4 w-4" />
                )}
                {copied ? "Tersalin" : "Salin"}
              </Button>
            </div>
            <div className="mt-4">
              <PwaInstallButton />
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-muted/40 p-4">
                <h2 className="flex items-center gap-2 text-sm font-medium">
                  <Smartphone aria-hidden="true" className="h-4 w-4" /> Android
                </h2>
                <div className="mt-3">
                  <AndroidSteps />
                </div>
              </div>
              <div className="rounded-xl bg-muted/40 p-4">
                <h2 className="flex items-center gap-2 text-sm font-medium">
                  <Apple aria-hidden="true" className="h-4 w-4" /> iPhone / iPad
                </h2>
                <div className="mt-3">
                  <IosSteps />
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
