import type { Metadata, Viewport } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import QueryProvider from "@/components/QueryProvider";
import SessionProvider from "@/components/SessionProvider";
import PwaRegister from "@/components/PwaRegister";
import InstallPrompt from "@/components/InstallPrompt";
import BackgroundEffect from "@/components/BackgroundEffect";
import FloatingHearts from "@/components/FloatingHearts";
import "./globals.css";

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "NDjourney",
    template: "%s - NDjourney",
  },
  description: "Tempat semua cerita kita tersimpan selamanya.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "NDjourney",
  },
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
    url: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/icon-72x72.png", sizes: "72x72", type: "image/png" },
      { url: "/icons/icon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/icons/icon-128x128.png", sizes: "128x128", type: "image/png" },
      { url: "/icons/icon-144x144.png", sizes: "144x144", type: "image/png" },
      { url: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-384x384.png", sizes: "384x384", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    other: [
      {
        rel: "apple-touch-icon-precomposed",
        url: "/icons/apple-touch-icon.png",
      },
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFF1F2" },
    { media: "(prefers-color-scheme: dark)", color: "#1A0A0E" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className={`${playfairDisplay.variable} ${inter.variable} antialiased`} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <BackgroundEffect />
          <FloatingHearts />
          <QueryProvider>
            <SessionProvider>
            {children}
            <PwaRegister />
            <InstallPrompt />
            </SessionProvider>
            <Toaster
              position="top-center"
              richColors
              closeButton
              toastOptions={{
                duration: 4000,
              }}
            />
          </QueryProvider>
        </ThemeProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var o=new MutationObserver(function(m){m.forEach(function(n){if(n.type==='attributes'&&n.attributeName==='bis_skin_checked')n.target.removeAttribute('bis_skin_checked')})});o.observe(document.documentElement,{attributes:true,subtree:true,attributeFilter:['bis_skin_checked']});document.querySelectorAll('[bis_skin_checked]').forEach(function(e){e.removeAttribute('bis_skin_checked')})})()`,
          }}
        />
      </body>
    </html>
  );
}
