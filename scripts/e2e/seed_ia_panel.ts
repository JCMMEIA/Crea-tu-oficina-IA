// Siembra el operador de la E2E del panel /admin/ia. Uso: DATABASE_URL=... npx tsx scripts/e2e/seed_ia_panel.ts
import { getDb } from "../../src/server/db";
import { signup } from "../../src/server/auth";
(async () => { const db = await getDb(); await signup(db, { email: "op@ejemplo.test", name: "Operador", password: "clave-larga-123", companyName: "Operación" }); console.log("ok"); process.exit(0); })();
