import type { Metadata } from "next";
import { Fraunces, Noto_Sans_Kannada, Public_Sans } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { DemoProvider } from "../src/components/demo-provider";
import { AuthProvider } from "../src/components/auth";

const publicSans = Public_Sans({ variable: "--font-public-sans", subsets: ["latin"] });
const notoKannada = Noto_Sans_Kannada({ variable: "--font-noto-kannada", subsets: ["kannada"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["opsz"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "Bengaluru Smart Waste | Mahadevapura Pilot",
  description: "Explainable citizen-to-cleanup waste operations for Bengaluru.",
  icons: { icon: "/favicon.svg" },
  openGraph: { title: "Bengaluru Smart Waste", description: "From citizen signal to verified cleanup.", type: "website", images: [{ url: "/og.png", width: 1536, height: 1024, alt: "Bengaluru Smart Waste civic operations map illustration" }] },
  twitter: { card: "summary_large_image", title: "Bengaluru Smart Waste", description: "From citizen signal to verified cleanup.", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${publicSans.variable} ${notoKannada.variable} ${fraunces.variable}`}><AuthProvider><DemoProvider>{children}</DemoProvider></AuthProvider></body></html>;
}
