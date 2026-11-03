import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key(): Buffer {
  const s = process.env.APP_SECRET;
  if (!s) throw new Error("Falta APP_SECRET: no se pueden guardar credenciales de forma segura.");
  const b = Buffer.from(s, "base64");
  if (b.length !== 32) throw new Error("APP_SECRET debe ser 32 bytes en base64.");
  return b;
}
/** AES-256-GCM. El texto cifrado no se envía nunca al navegador. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}
export function decryptSecret(blob: string): string {
  const [iv, tag, enc] = blob.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", key(), iv); d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}
