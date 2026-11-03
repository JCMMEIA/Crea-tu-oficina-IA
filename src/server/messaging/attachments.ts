/** Validación de archivos recibidos. PREPARADO: aún no se descargan ni procesan adjuntos (solo texto está habilitado). */
export const MAX_BYTES = { image: 5 * 1024 * 1024, document: 10 * 1024 * 1024, voice: 8 * 1024 * 1024 } as const;
const ALLOWED: Record<keyof typeof MAX_BYTES, RegExp> = { image: /^image\/(jpeg|png|webp)$/, document: /^(application\/pdf|text\/plain|text\/csv|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet))$/, voice: /^audio\/(ogg|mpeg|mp4|aac|amr|webm)(;.*)?$/ };
export function validateAttachment(kind: "image" | "document" | "voice" | "audio", a: { mime?: string; size?: number; name?: string }): { ok: true } | { ok: false; reason: string } {
  const k = kind === "audio" ? "voice" : kind;
  if (!a.mime || !ALLOWED[k].test(a.mime.toLowerCase())) return { ok: false, reason: "Tipo de archivo no permitido." };
  if (a.size == null || a.size <= 0) return { ok: false, reason: "No se pudo comprobar el tamaño." };
  if (a.size > MAX_BYTES[k]) return { ok: false, reason: `El archivo supera el máximo de ${MAX_BYTES[k] / 1024 / 1024} MB.` };
  if (a.name && /[\\/\0]|\.\.|\.(exe|bat|cmd|sh|js|msi|scr|vbs|ps1|jar|apk|dll)$/i.test(a.name)) return { ok: false, reason: "Nombre de archivo no permitido." };
  return { ok: true };
}
