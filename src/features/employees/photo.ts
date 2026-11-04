/** Foto personalizada del cliente: solo PNG/JPG/WebP pequeños, guardados como data URL. Validación pura (se prueba sin servidor). */
export const MAX_PHOTO_BYTES = 150 * 1024;
const MAGIC: [string, number[]][] = [["image/png", [0x89, 0x50, 0x4e, 0x47]], ["image/jpeg", [0xff, 0xd8, 0xff]], ["image/webp", [0x52, 0x49, 0x46, 0x46]]];
/** Devuelve el data URL listo para guardar, o lanza un error legible. Verifica el contenido real (firma del archivo), no solo la extensión. */
export function photoToDataUrl(bytes: Uint8Array, declaredType: string): string {
  if (!bytes.length) throw new Error("El archivo está vacío.");
  if (bytes.length > MAX_PHOTO_BYTES) throw new Error(`La foto pesa demasiado (máximo ${MAX_PHOTO_BYTES / 1024} KB). Reduce su tamaño e inténtalo de nuevo.`);
  const hit = MAGIC.find(([, sig]) => sig.every((b, i) => bytes[i] === b));
  if (!hit || (hit[0] === "image/webp" && String.fromCharCode(...bytes.slice(8, 12)) !== "WEBP")) throw new Error("Usa una imagen PNG, JPG o WebP.");
  if (declaredType && !/^image\/(png|jpe?g|webp)$/.test(declaredType)) throw new Error("Usa una imagen PNG, JPG o WebP.");
  return `data:${hit[0]};base64,${Buffer.from(bytes).toString("base64")}`;
}
export const isSafePhoto = (v: unknown): v is string => typeof v === "string" && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length < MAX_PHOTO_BYTES * 1.4 + 64;
export function cleanName(v: string): string {
  const n = v.replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim();
  if (n.length < 2 || n.length > 60) throw new Error("El nombre debe tener entre 2 y 60 letras.");
  return n;
}
