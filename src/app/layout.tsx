import "./globals.css";
import "./premium.css";
import type { Metadata, Viewport } from "next";
import { MetaPixel } from "@/lib/meta";
const site = process.env.NEXT_PUBLIC_SITE_URL;
export const metadata: Metadata = {
  ...(site ? { metadataBase: new URL(site) } : {}),
  title: { default: "Crea tu Oficina IA — crea tu oficina de empleados de inteligencia artificial", template: "%s — Crea tu Oficina IA" },
  description: "Crea tu oficina de empleados de inteligencia artificial y automatiza tu negocio. Compra, recibe tu acceso por correo y configúrala en minutos.",
  applicationName: "Crea tu Oficina IA",
  openGraph: { type: "website", siteName: "Crea tu Oficina IA", locale: "es_MX" },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Oficina IA", statusBarStyle: "black-translucent" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#060616", colorScheme: "dark" };
export default function Root({ children }: { children: React.ReactNode }) {
  return (<html lang="es"><head><link rel="preload" href="/fonts/inter-latin-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" /></head><body><a className="skip" href="#contenido">Saltar al contenido</a>{children}<MetaPixel /></body></html>);
}
