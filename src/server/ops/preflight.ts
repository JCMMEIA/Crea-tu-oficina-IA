export type Level = "OK" | "FALTA" | "AVISO";
export interface Check { level: Level; name: string; detail: string }
/** Revisa la configuración de un servidor. NUNCA devuelve valores secretos, solo si están bien o mal. */
export function preflight(env: NodeJS.ProcessEnv = process.env): Check[] {
  const out: Check[] = []; const add = (level: Level, name: string, detail: string) => out.push({ level, name, detail });
  const major = Number(process.versions.node.split(".")[0]);
  major >= 22 ? add("OK", "Node", `versión ${process.versions.node}`) : add("FALTA", "Node", "se necesita la versión 22 o mayor");
  env.NODE_ENV === "production" ? add("OK", "NODE_ENV", "production") : add("AVISO", "NODE_ENV", "no es production (normal solo en pruebas)");
  try { const k = Buffer.from(env.APP_SECRET ?? "", "base64"); k.length === 32 ? add("OK", "APP_SECRET", "32 bytes") : add("FALTA", "APP_SECRET", "debe ser una clave de 32 bytes en base64 (openssl rand -base64 32)"); } catch { add("FALTA", "APP_SECRET", "inválida"); }
  const db = env.DATABASE_URL ?? "";
  /^postgres(ql)?:\/\//.test(db) ? add("OK", "DATABASE_URL", "apunta a PostgreSQL") : add("FALTA", "DATABASE_URL", "sin esto se usa una base local de desarrollo que NO sirve en producción");
  (env.CRON_SECRET ?? "").length >= 24 ? add("OK", "CRON_SECRET", "largo suficiente") : add("FALTA", "CRON_SECRET", "mínimo 24 caracteres");
  (env.SIGNUP_ALLOWED_EMAILS ?? "").trim() ? add("OK", "SIGNUP_ALLOWED_EMAILS", "registro cerrado a una lista") : (env.PILOT_OPEN_SIGNUP === "yes" ? add("AVISO", "SIGNUP_ALLOWED_EMAILS", "registro ABIERTO a cualquiera (PILOT_OPEN_SIGNUP=yes)") : add("FALTA", "SIGNUP_ALLOWED_EMAILS", "sin lista cualquiera puede crear una cuenta; ponla, o PILOT_OPEN_SIGNUP=yes si es a propósito"));
  (env.PLATFORM_ADMIN_EMAILS ?? "").trim() ? add("OK", "PLATFORM_ADMIN_EMAILS", "hay operador") : add("FALTA", "PLATFORM_ADMIN_EMAILS", "nadie podrá abrir el panel /admin");
  /^https:\/\/[^/]+/.test(env.NEXT_PUBLIC_SITE_URL ?? "") ? add("OK", "NEXT_PUBLIC_SITE_URL", "dirección con https") : add("FALTA", "NEXT_PUBLIC_SITE_URL", "debe empezar con https://");
  /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(env.NEXT_PUBLIC_CONTACT_EMAIL ?? "") ? add("OK", "NEXT_PUBLIC_CONTACT_EMAIL", "correo de contacto para privacidad") : add("FALTA", "NEXT_PUBLIC_CONTACT_EMAIL", "la política de privacidad lo necesita (se fija ANTES de compilar)");
  if (env.ANTHROPIC_API_KEY) (Number(env.MODEL_INPUT_USD_PER_MTOK) > 0 && Number(env.MODEL_OUTPUT_USD_PER_MTOK) > 0) ? add("OK", "Claude", "clave y tarifas definidas") : add("FALTA", "Claude", "hay clave pero faltan MODEL_INPUT_USD_PER_MTOK / MODEL_OUTPUT_USD_PER_MTOK");
  else add("AVISO", "Claude", "sin ANTHROPIC_API_KEY: los empleados NO ejecutan tareas reales");
  if (env.BILLING_ENABLED === "true") add("AVISO", "COBROS", "BILLING_ENABLED=true: solo debe estarlo con autorización de José");
  else add("OK", "COBROS", "apagados");
  if (env.STRIPE_SECRET_KEY && !env.STRIPE_SECRET_KEY.startsWith("sk_test_")) add(env.STRIPE_ALLOW_LIVE === "yes" ? "AVISO" : "FALTA", "STRIPE", "la clave NO es de pruebas");
  return out;
}
export const preflightOk = (c: Check[]) => !c.some((x) => x.level === "FALTA");
