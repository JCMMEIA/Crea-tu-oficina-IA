import "./globals.css";
import type { Metadata, Viewport } from "next";
export const metadata: Metadata = { title: "Crea tu Oficina IA", description: "Construye una oficina con empleados de inteligencia artificial, con supervisión humana." };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };
export default function Root({ children }: { children: React.ReactNode }) {
  return (<html lang="es"><body>{children}</body></html>);
}
