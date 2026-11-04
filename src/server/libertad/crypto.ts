import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * Cifrado en la aplicación (AES-256-GCM) de los datos personales de Mi Plan de Libertad. La clave de cada persona se DERIVA (HKDF-SHA256) de APP_SECRET y de
 * (oficina, usuario): no hay clave nueva que administrar y la base de datos por sí sola no revela el contenido.
 * Si APP_SECRET se cambia, los planes guardados dejan de poder leerse: hay que exportarlos antes (ver docs/libertad/ARQUITECTURA.md).
 */
const keyFor = (companyId: string, userId: string) => {
  const raw = process.env.APP_SECRET; if (!raw) throw new Error("Falta APP_SECRET: no se pueden proteger los datos personales.");
  const master = Buffer.from(raw, "base64"); if (master.length < 16) throw new Error("APP_SECRET no es válida.");
  return Buffer.from(hkdfSync("sha256", master, Buffer.from("mi-plan-de-libertad:v1"), Buffer.from(`${companyId}:${userId}`), 32));
};
export function encryptJson(companyId: string, userId: string, value: unknown): string {
  const iv = randomBytes(12); const c = createCipheriv("aes-256-gcm", keyFor(companyId, userId), iv); const ct = Buffer.concat([c.update(JSON.stringify(value), "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), ct.toString("base64")].join(".");
}
export function decryptJson<T = unknown>(companyId: string, userId: string, blob: string): T {
  const [v, iv, tag, ct] = blob.split("."); if (v !== "v1" || !iv || !tag || !ct) throw new Error("Formato de datos no válido.");
  const d = createDecipheriv("aes-256-gcm", keyFor(companyId, userId), Buffer.from(iv, "base64")); d.setAuthTag(Buffer.from(tag, "base64"));
  try { return JSON.parse(Buffer.concat([d.update(Buffer.from(ct, "base64")), d.final()]).toString("utf8")) as T; } catch { throw new Error("No se pudieron leer los datos (clave distinta o datos alterados)."); }
}
