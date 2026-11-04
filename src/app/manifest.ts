import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "Crea tu Oficina IA", short_name: "Oficina IA", description: "Tu oficina de empleados de inteligencia artificial.", start_url: "/", display: "standalone", background_color: "#060616", theme_color: "#060616", lang: "es",
    icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }, { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }] };
}
