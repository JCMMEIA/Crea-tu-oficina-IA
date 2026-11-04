// Crea (si no existe) la cuenta de un OPERADOR y IMPRIME un enlace de acceso de 30 minutos. Sin registro abierto ni contraseña.
//   npm run admin:link -- tu@correo      (el correo debe estar en PLATFORM_ADMIN_EMAILS)
import { getDb } from "../src/server/db";
import { createPasswordlessUser } from "../src/server/auth";
import { isPlatformAdmin } from "../src/server/commercial/admin";
import { issueAccessLink } from "../src/server/commerce/access";
(async () => {
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  if (!isPlatformAdmin(email)) { console.error("Ese correo no está en PLATFORM_ADMIN_EMAILS."); process.exit(1); }
  const db = await getDb(); const id = await createPasswordlessUser(db, email, "Operador");
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  console.log(`Enlace de acceso (vale 30 min, un solo uso). No lo compartas:\n${site}/acceso?t=${await issueAccessLink(db, id, "acceso", 30)}`); await db.close(); process.exit(0);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
