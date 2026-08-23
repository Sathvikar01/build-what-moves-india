import type { Metadata } from "next";
import { Noto_Sans, Noto_Sans_Kannada } from "next/font/google";
import "./globals.css";
import "./proof.css";
import "leaflet/dist/leaflet.css";
import { DemoProvider } from "../src/components/demo-provider";
import { AuthProvider } from "../src/components/auth";

const notoSans = Noto_Sans({ variable: "--font-noto-sans", subsets: ["latin"] });
const notoKannada = Noto_Sans_Kannada({ variable: "--font-noto-kannada", subsets: ["kannada"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "Bengaluru Waste Coordination | Independent Prototype",
  description: "Explainable citizen-to-cleanup waste coordination using clearly labelled synthetic operations.",
  icons: { icon: "/favicon.svg" },
  openGraph: { title: "Bengaluru Smart Waste", description: "From citizen signal to verified cleanup.", type: "website", images: [{ url: "/og.png", width: 1536, height: 1024, alt: "Bengaluru Smart Waste civic operations map illustration" }] },
  twitter: { card: "summary_large_image", title: "Bengaluru Smart Waste", description: "From citizen signal to verified cleanup.", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${notoSans.variable} ${notoKannada.variable}`}><AuthProvider><DemoProvider>{children}</DemoProvider></AuthProvider></body></html>;
}
