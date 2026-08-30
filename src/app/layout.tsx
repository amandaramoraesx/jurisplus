import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/NavBar";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { getCurrentUser } from "@/lib/auth";

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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();

  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col md:flex-row">
        <ServiceWorkerRegister />
        <NavBar isAdmin={user?.role === "admin"} loggedIn={!!user} />
        <div className="flex-1 min-w-0">
          <main
            className={`px-4 pb-6 md:py-6 max-w-3xl mx-auto w-full ${user ? "pt-20 md:pt-6" : "pt-6"}`}
          >
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
