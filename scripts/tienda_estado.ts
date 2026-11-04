// Dice si la tienda está ABIERTA y, si no, por qué (sin mostrar claves).   npm run tienda:estado
import { getDb } from "../src/server/db";
import { purchasesOpen } from "../src/server/commerce/gate";
(async () => { const g = await purchasesOpen(await getDb()); console.log(g.open ? "✅ Tienda ABIERTA: cobros, precio, correo e IA verificados." : "🔒 Tienda CERRADA:\n - " + g.reasons.join("\n - ")); process.exit(0); })().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
