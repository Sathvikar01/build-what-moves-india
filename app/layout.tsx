import type { Metadata } from "next";
import { Archivo, JetBrains_Mono, Noto_Sans_Kannada } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { DemoProvider } from "../src/components/demo-provider";
import { AuthProvider } from "../src/components/auth";

const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jbmono", subsets: ["latin"] });
const notoKannada = Noto_Sans_Kannada({ variable: "--font-noto-kannada", subsets: ["kannada"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "Bengaluru Smart Waste | Mahadevapura Pilot",
  description: "Explainable citizen-to-cleanup waste operations for Bengaluru.",
  icons: { icon: "/favicon.svg" },
  openGraph: { title: "Bengaluru Smart Waste", description: "From citizen signal to verified cleanup.", type: "website", images: [{ url: "/og.png", width: 1536, height: 1024, alt: "Bengaluru Smart Waste civic operations map illustration" }] },
  twitter: { card: "summary_large_image", title: "Bengaluru Smart Waste", description: "From citizen signal to verified cleanup.", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${archivo.variable} ${jetbrainsMono.variable} ${notoKannada.variable}`}><AuthProvider><DemoProvider>{children}</DemoProvider></AuthProvider></body></html>;
}
