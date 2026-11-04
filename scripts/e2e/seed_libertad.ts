// Siembra dos clientes DIRECTOS (con membresía propia) para la E2E de Mi Plan de Libertad. Uso: DATABASE_URL=... npx tsx scripts/e2e/seed_libertad.ts
import { getDb } from "../../src/server/db";
import { signup } from "../../src/server/auth";
(async () => { const db = await getDb(); for (const [e, n] of [["ana@libertad.test", "Café Luna"], ["beto@libertad.test", "Taller Beto"]]) await signup(db, { email: e, name: "Dueño " + n, password: "clave-larga-123", companyName: n }); console.log("ok"); process.exit(0); })();
