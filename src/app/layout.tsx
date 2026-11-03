import "./globals.css";
import type { Metadata, Viewport } from "next";
import { MetaPixel } from "@/lib/meta";
export const metadata: Metadata = { title: "Crea tu Oficina IA — crea tu agencia de inteligencia artificial", description: "Elige servicios, personaliza agentes y prepara soluciones de inteligencia artificial para ofrecerlas a negocios desde una sola plataforma." };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };
export default function Root({ children }: { children: React.ReactNode }) {
  return (<html lang="es"><body>{children}<MetaPixel /></body></html>);
}
