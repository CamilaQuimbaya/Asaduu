import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, DM_Mono, Instrument_Sans } from "next/font/google";
import { EVENT } from "@/lib/config";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], weight: ["400", "600", "800"], variable: "--f-display" });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--f-body" });
const mono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--f-mono" });

const description = `${EVENT.dateLabel} · ${EVENT.place}. Confirma tu asistencia, cuadra el carro y tu aporte.`;

export const metadata: Metadata = {
  metadataBase: process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? new URL(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
    : new URL("http://localhost:3000"),
  title: EVENT.title,
  description,
  openGraph: { title: `🔥 ${EVENT.title} · ¡Estás invitado!`, description, type: "website", locale: "es_CO" },
  twitter: { card: "summary_large_image", title: EVENT.title, description },
  appleWebApp: { capable: true, title: EVENT.title, statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#18120e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO" className={`${bricolage.variable} ${instrument.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
