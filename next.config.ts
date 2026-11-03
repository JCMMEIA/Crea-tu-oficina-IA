import type { NextConfig } from "next";
// Cabeceras de seguridad. (No se añade Content-Security-Policy todavía: Next usa scripts en línea y habría que probarla con nonce; está en la lista de pendientes.)
const headers = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];
const config: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  poweredByHeader: false,
  async headers() { return [{ source: "/:path*", headers }]; },
};
export default config;
