// Verifica la IA REAL (una llamada mínima) y guarda el resultado que abre/cierra la tienda.   npm run ai:verify
import { getDb } from "../src/server/db";
import { verifyAi } from "../src/server/commerce/gate";
(async () => { const r = await verifyAi(await getDb()); console.log(r.ok ? "✅ IA verificada:" : "❌ IA NO verificada:", r.detail); process.exit(r.ok ? 0 : 1); })().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
