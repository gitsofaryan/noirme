import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import BottomNav from "@/components/BottomNav";
import { AuthProvider } from "@/hooks/useAuth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingProvider } from "@/hooks/useLoading";
import { MapProvider } from "@/components/Map/MapProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Noirme",
  description: "Real-time social proximity app",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Noirme",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="h-full bg-white text-zinc-900 selection:bg-zinc-200 overflow-hidden" suppressHydrationWarning>
        <Script src="https://js.puter.com/v2/" strategy="afterInteractive" />
        <Script id="register-sw" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').then(
                  function(registration) {
                    console.log('[noirme] ServiceWorker registered with scope:', registration.scope);
                  },
                  function(err) {
                    console.error('[noirme] ServiceWorker registration failed:', err);
                  }
                );
              });
            }
          `}
        </Script>
        <AuthProvider>
          <ErrorBoundary>
            <LoadingProvider>
              <MapProvider>
                <main className="absolute inset-0 pb-16 overflow-hidden">
                  {children}
                </main>
                <BottomNav />
              </MapProvider>
            </LoadingProvider>
          </ErrorBoundary>
        </AuthProvider>
      </body>
    </html>
  );
}
