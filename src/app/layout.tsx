import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/NavBar";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Juris+",
  description:
    "Sistema de estudos para a faculdade de Direito: aulas, presença, notas, provas, palestras, grupos e vade mecum.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Juris+",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#5b3a8e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col md:flex-row">
        <ServiceWorkerRegister />
        <NavBar />
        <div className="flex-1 min-w-0">
          <header className="md:hidden flex items-center justify-center gap-2 h-14 border-b border-black/10 dark:border-white/10">
            <span className="text-lg">⚖️</span>
            <span className="text-lg font-bold tracking-tight">Juris+</span>
          </header>
          <main className="px-4 py-6 pb-24 md:pb-6 max-w-3xl mx-auto w-full">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
