import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  return { rules: [{ userAgent: "*", allow: ["/", "/planes", "/demo", "/ayuda"], disallow: ["/admin", "/agencia", "/oficina", "/api", "/empezar", "/gracias"] }], ...(site ? { sitemap: `${site}/sitemap.xml` } : {}) };
}
