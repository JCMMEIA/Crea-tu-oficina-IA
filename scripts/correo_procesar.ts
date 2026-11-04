// Entrega ahora los correos pendientes (útil justo después de arreglar la configuración).   npm run correo:procesar
import { getDb } from "../src/server/db";
import { processEmails } from "../src/server/commerce/mail";
(async () => { const db = await getDb(); const r = await processEmails(db); console.log(`Enviados: ${r.sent} · fallidos: ${r.failed}${r.skipped ? ` · sin proveedor: ${r.skipped} en cola` : ""}`); await db.close(); process.exit(r.failed ? 1 : 0); })().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
