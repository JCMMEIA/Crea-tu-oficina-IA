import { Db, newId } from "../db";
import { Actor, assertCan, audit } from "../auth";

/**
 * Inventario de la empresa (cargado por CSV) y regla de resurtido. TODO el cálculo es código determinista:
 * ningún modelo de IA decide cantidades. Regla: un producto está «bajo el mínimo» si stock < mínimo; se repone hasta el máximo.
 */
export interface Item { sku: string; name: string; stock: number; min: number; max: number; cost: number; supplier: string }
export interface Line { sku: string; nombre: string; stock: number; minimo: number; maximo: number; unidades: number; costo_unitario: number; proveedor: string }
export interface Analysis { total_productos: number; bajo_minimo: Line[]; total_unidades: number; costo_estimado: number }

export function analyze(items: Item[]): Analysis {
  const low = items.filter((i) => i.stock < i.min).sort((a, b) => a.sku.localeCompare(b.sku))
    .map((i) => ({ sku: i.sku, nombre: i.name, stock: i.stock, minimo: i.min, maximo: i.max, unidades: i.max - i.stock, costo_unitario: i.cost, proveedor: i.supplier }));
  return { total_productos: items.length, bajo_minimo: low, total_unidades: low.reduce((n, l) => n + l.unidades, 0), costo_estimado: Math.round(low.reduce((n, l) => n + l.unidades * l.costo_unitario, 0) * 100) / 100 };
}

// ---------- CSV ----------
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let cur: string[] = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true; else if (c === ",") { cur.push(f); f = ""; } else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; cur.push(f); f = ""; if (cur.some((x) => x.trim())) rows.push(cur); cur = []; } else f += c;
  }
  cur.push(f); if (cur.some((x) => x.trim())) rows.push(cur); return rows;
}
const COLS: Record<string, string> = { sku: "sku", codigo: "sku", producto: "name", nombre: "name", stock: "stock", existencia: "stock", existencias: "stock", minimo: "min", maximo: "max", costo: "cost", precio: "cost", proveedor: "supplier" };
export const MAX_ROWS = 500;

export function parseInventory(csv: string): { items: Item[]; errors: string[] } {
  const errors: string[] = []; const rows = parseCsv(csv.slice(0, 200_000));
  if (rows.length < 2) return { items: [], errors: ["El archivo no tiene datos. Debe tener una fila de títulos y al menos un producto."] };
  const head = rows[0].map((h) => COLS[norm(h)] ?? "");
  for (const need of ["sku", "name", "stock", "min", "max"]) if (!head.includes(need)) errors.push(`Falta la columna «${need === "name" ? "producto" : need === "min" ? "mínimo" : need === "max" ? "máximo" : need}».`);
  if (errors.length) return { items: [], errors };
  if (rows.length - 1 > MAX_ROWS) return { items: [], errors: [`Máximo ${MAX_ROWS} productos por carga.`] };
  const items: Item[] = []; const seen = new Set<string>();
  rows.slice(1).forEach((r, idx) => {
    const line = idx + 2; const g = (k: string) => (r[head.indexOf(k)] ?? "").trim();
    const sku = g("sku"), name = g("name"); const stock = Number(g("stock")), min = Number(g("min")), max = Number(g("max")), cost = g("cost") === "" ? 0 : Number(g("cost"));
    if (!sku || sku.length > 40) return void errors.push(`Fila ${line}: SKU vacío o demasiado largo.`);
    if (seen.has(sku)) return void errors.push(`Fila ${line}: SKU repetido (${sku}).`); seen.add(sku);
    if (!name || name.length > 120) return void errors.push(`Fila ${line}: nombre vacío o demasiado largo.`);
    for (const [k, v] of [["stock", stock], ["mínimo", min], ["máximo", max]] as const) if (!Number.isInteger(v) || v < 0 || v > 1_000_000) return void errors.push(`Fila ${line}: «${k}» debe ser un número entero de 0 en adelante.`);
    if (min > max) return void errors.push(`Fila ${line}: el mínimo (${min}) no puede ser mayor que el máximo (${max}).`);
    if (!Number.isFinite(cost) || cost < 0) return void errors.push(`Fila ${line}: costo inválido.`);
    items.push({ sku, name, stock, min, max, cost, supplier: g("supplier").slice(0, 80) });
  });
  return { items, errors };
}

/** Reemplaza TODO el inventario de la empresa por el del archivo (todo o nada). */
export async function importInventory(db: Db, actor: Actor, csv: string): Promise<{ loaded: number }> {
  assertCan(actor, "knowledge:manage");
  const { items, errors } = parseInventory(csv);
  if (errors.length) throw new Error(errors.slice(0, 5).join(" "));
  await db.tx(async (t) => {
    await t.query("DELETE FROM inventory_items WHERE company_id=$1", [actor.companyId]);
    for (const i of items) await t.query("INSERT INTO inventory_items(company_id,sku,name,stock,min_stock,max_stock,unit_cost,supplier) VALUES($1,$2,$3,$4,$5,$6,$7,$8)", [actor.companyId, i.sku, i.name, i.stock, i.min, i.max, i.cost, i.supplier]);
  });
  await audit(db, { companyId: actor.companyId, userId: actor.userId }, "inventory.import", actor.companyId, { rows: items.length });
  return { loaded: items.length };
}
export async function loadItems(db: Db, companyId: string): Promise<Item[]> {
  return (await db.query("SELECT sku,name,stock,min_stock,max_stock,unit_cost::float cost,supplier FROM inventory_items WHERE company_id=$1 ORDER BY sku", [companyId]))
    .map((r) => ({ sku: r.sku, name: r.name, stock: r.stock, min: r.min_stock, max: r.max_stock, cost: Number(r.cost), supplier: r.supplier }));
}
export async function listInventory(db: Db, actor: Actor) { assertCan(actor, "read"); const items = await loadItems(db, actor.companyId); return { items, analysis: analyze(items) }; }
export async function listDrafts(db: Db, actor: Actor) {
  assertCan(actor, "read");
  return db.query("SELECT id,task_id,items,total_units,total_cost::float total_cost,status,created_at,decided_at FROM restock_drafts WHERE company_id=$1 ORDER BY created_at DESC LIMIT 20", [actor.companyId]);
}

// ---------- Herramientas internas que usan los empleados ----------
export const INTERNAL_TOOLKITS = new Set(["inventario"]);
export interface ToolCtx { companyId: string; taskId: string }
export interface ToolResult { ok: boolean; data?: unknown; error?: string }

/** Resumen humano de una solicitud de aprobación interna (lo que ve la persona que decide). */
export async function describeApproval(db: Db, companyId: string, toolkit: string, action: string, args: any): Promise<string | null> {
  if (toolkit !== "inventario" || action !== "solicitar_resurtido") return null;
  const d = (await db.query("SELECT total_units, items FROM restock_drafts WHERE id=$1 AND company_id=$2", [String(args?.draft_id ?? ""), companyId]))[0];
  return d ? `resurtir ${(d.items as Line[]).length} productos (${d.total_units} unidades) — no se envía ninguna compra` : "resurtir inventario (borrador no encontrado)";
}

export async function executeInternal(db: Db, ctx: ToolCtx, action: string, args: any): Promise<ToolResult> {
  const items = await loadItems(db, ctx.companyId);
  switch (action) {
    case "leer_inventario": return { ok: true, data: { productos: items.map((i) => ({ sku: i.sku, nombre: i.name, stock: i.stock, minimo: i.min, maximo: i.max, proveedor: i.supplier })) } };
    case "calcular_resurtido": return { ok: true, data: analyze(items) };
    case "guardar_borrador_resurtido": {
      const a = analyze(items); // se recalcula en el servidor: el modelo NO puede inflar cantidades
      if (!a.bajo_minimo.length) return { ok: true, data: { mensaje: "No hay productos bajo el mínimo; no se creó borrador." } };
      const id = newId();
      await db.query("INSERT INTO restock_drafts(id,company_id,task_id,items,total_units,total_cost) VALUES($1,$2,$3,$4,$5,$6)", [id, ctx.companyId, ctx.taskId, JSON.stringify(a.bajo_minimo), a.total_unidades, a.costo_estimado]);
      return { ok: true, data: { draft_id: id, productos: a.bajo_minimo.length, total_unidades: a.total_unidades, costo_estimado: a.costo_estimado, estado: "borrador (no enviado)" } };
    }
    case "solicitar_resurtido": { // solo se ejecuta DESPUÉS de que una persona aprueba
      const id = String(args?.draft_id ?? "");
      const r = await db.query("UPDATE restock_drafts SET status='aprobado_sin_enviar', decided_at=now() WHERE id=$1 AND company_id=$2 AND status='borrador' RETURNING total_units", [id, ctx.companyId]);
      if (!r.length) return { ok: false, error: "El borrador no existe, ya fue decidido o es de otra empresa." };
      return { ok: true, data: { mensaje: "Orden aprobada y registrada. NO se envió ninguna compra al proveedor: todavía no existe integración de compras.", unidades: r[0].total_units } };
    }
  }
  return { ok: false, error: "Acción desconocida." };
}
/** Si se rechaza la solicitud, el borrador queda marcado como rechazado. */
export async function markDraftRejected(db: Db, companyId: string, args: any) {
  await db.query("UPDATE restock_drafts SET status='rechazado', decided_at=now() WHERE id=$1 AND company_id=$2 AND status='borrador'", [String(args?.draft_id ?? ""), companyId]);
}
