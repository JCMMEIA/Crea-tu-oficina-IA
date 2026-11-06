/** Filtros de seguridad para documentación importada de GitHub. Regla: ante la duda, el archivo NO se guarda (se salta entero, no se "tacha"). */

/** Solo documentación en texto. Todo lo demás (código, binarios, imágenes, configuración) queda fuera. */
export const DOC_EXTENSIONS = [".md", ".markdown", ".mdx", ".txt", ".rst", ".adoc"];

const BLOCKED_DIRS = new Set([".git", ".ssh", ".aws", ".gnupg", ".gpg", ".kube", ".docker", "node_modules", "vendor", "secrets", "secret", "private", "credentials", ".terraform"]);
const BLOCKED_NAME = /^(\.env.*|.*\.env|\.npmrc|\.pypirc|\.netrc|\.htpasswd|\.git-credentials|id_(rsa|dsa|ecdsa|ed25519).*|known_hosts|authorized_keys|kubeconfig|terraform\.tfstate.*|.*\.tfvars|.*\.(pem|key|p12|pfx|jks|keystore|kdbx|crt|cer|der|asc|gpg|sqlite|db|sql|bak|zip|gz|tar|png|jpe?g|gif|pdf|exe|dll|so|bin))$/i;
const SUSPICIOUS_NAME = /(secret|credential|credencial|password|passwd|contrase|private[-_ ]?key|llave|token|apikey|api[-_]key|service[-_]account)/i;

export type Skip = "ruta_bloqueada" | "extension_no_permitida" | "nombre_sospechoso" | "fuera_de_carpetas_elegidas" | "muy_grande" | "binario" | "posible_secreto" | "limite_de_archivos";

/** ¿Está esta ruta dentro de las carpetas/archivos que el cliente eligió? Un filtro que termina en "/" es carpeta; si no, archivo exacto o carpeta. */
export function matchesFilters(path: string, filters: string[]): boolean {
  const p = path.toLowerCase();
  return filters.some((raw) => {
    const f = raw.trim().replace(/^\.?\//, "").toLowerCase(); if (!f) return false;
    return f.endsWith("/") ? p.startsWith(f) : p === f || p.startsWith(f + "/");
  });
}
export function normalizeFilters(input: string[]): string[] {
  return [...new Set(input.map((x) => x.trim().replaceAll("\\", "/").replace(/^\.?\//, "")).filter((x) => x && !x.includes("..") && x.length <= 200))].slice(0, 30);
}
export const DEFAULT_FILTERS = ["README.md", "docs/"];

/** Decide por NOMBRE y RUTA, antes de descargar nada. Devuelve el motivo por el que se salta, o null si es apto. */
export function skipByPath(path: string, filters: string[]): Skip | null {
  const parts = path.split("/"); const name = parts[parts.length - 1];
  if (parts.some((d, i) => i < parts.length - 1 && BLOCKED_DIRS.has(d.toLowerCase()))) return "ruta_bloqueada";
  if (BLOCKED_NAME.test(name)) return "ruta_bloqueada";
  if (!DOC_EXTENSIONS.some((e) => name.toLowerCase().endsWith(e))) return "extension_no_permitida";
  if (SUSPICIOUS_NAME.test(path)) return "nombre_sospechoso";
  if (!matchesFilters(path, filters)) return "fuera_de_carpetas_elegidas";
  return null;
}

/** Binario o no-UTF8: no es documentación de texto. */
export function looksBinary(buf: Buffer): boolean {
  if (buf.includes(0)) return true;
  const s = buf.toString("utf8"); return (s.match(/\uFFFD/g)?.length ?? 0) > Math.max(3, s.length / 200);
}

const PLACEHOLDER = /^(<[^>]*>|\$\{?[A-Z_]+\}?|x{3,}|\*{3,}|\.{3,}|your[-_a-z]*|tu[-_a-z]*|example\w*|ejemplo\w*|changeme|password|contrase[nñ]a|token|secret|null|none|true|false|\{\{.*\}\})$/i;
const SECRET_PATTERNS: [string, RegExp][] = [
  ["llave privada", /-----BEGIN [A-Z0-9 ]*PRIVATE KEY( BLOCK)?-----/],
  ["token de GitHub", /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{30,}\b/],
  ["clave de Anthropic/OpenRouter/OpenAI", /\bsk-(ant|or)-[A-Za-z0-9_-]{16,}|\bsk-[A-Za-z0-9]{32,}\b/],
  ["clave de AWS", /\b(AKIA|ASIA)[0-9A-Z]{16}\b/],
  ["clave de Stripe", /\b(sk|rk)_(live|test)_[A-Za-z0-9]{16,}\b|\bwhsec_[A-Za-z0-9]{16,}/],
  ["token de Slack", /\bxox[baprs]-[A-Za-z0-9-]{10,}/],
  ["clave de Google", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["token JWT", /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/],
  ["token Bearer", /\bBearer\s+[A-Za-z0-9._~+/-]{30,}={0,2}/],
  ["dirección con usuario y contraseña", /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s@/]{3,}@[^\s/]+/i],
];
const ASSIGNMENT = /\b(password|passwd|pwd|contrase[nñ]a|secret|client[_-]?secret|api[_-]?key|apikey|access[_-]?key|auth[_-]?token|private[_-]?key|token)\b["']?\s*[:=]\s*["']?([^\s"'`,;]{8,})/gi;

/** Detector de secretos ANTES de guardar. Devuelve el tipo detectado (nunca el valor) o null. */
export function detectSecret(text: string): string | null {
  for (const [name, re] of SECRET_PATTERNS) if (re.test(text)) return name;
  for (const m of text.matchAll(ASSIGNMENT)) if (!PLACEHOLDER.test(m[2])) return "valor asignado a una clave o contraseña";
  return null;
}

/** Trozos de ~1200 caracteres cortados por títulos/párrafos. Tope por archivo para limitar costo y almacenamiento. */
export function chunkText(text: string, max = 1200, cap = 40): string[] {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n(?=#{1,4} )|\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const out: string[] = []; let cur = "";
  for (const b of blocks) {
    if ((cur + "\n\n" + b).length > max && cur) { out.push(cur); cur = ""; }
    if (b.length > max) { for (let i = 0; i < b.length; i += max) out.push(b.slice(i, i + max)); continue; }
    cur = cur ? cur + "\n\n" + b : b;
  }
  if (cur) out.push(cur);
  return out.slice(0, cap);
}
export const normalizeSearch = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const STOP = new Set("una uno unos unas que con por para los las del como cual cuales cuanto cuanta cuantos donde cuando quien sus mis tus nos son era fue ser hay muy mas pero sin sobre entre desde hasta the and for with".split(" "));
/** Palabras de búsqueda: sin acentos, sin palabras vacías, con prefijo para tolerar plurales (devolución ≈ devoluciones). */
export function queryTerms(q: string, max = 12): string[] {
  const t = normalizeSearch(q).split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w));
  return [...new Set(t)].slice(0, max).map((w) => (w.length >= 6 ? w.slice(0, w.length - 2) : w));
}
