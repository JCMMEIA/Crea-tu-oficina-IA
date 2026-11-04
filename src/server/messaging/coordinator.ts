import { z } from "zod";
import { Db } from "../db";
import { can } from "../auth";
import { ConnectorAdapter } from "../connectors";
import { createTask, DuplicateTaskError } from "../tasks";
import { EMPLOYEES } from "../catalog/data";
import { AccessibleCompany, accessibleCompanies, actorFor } from "./access";
import { Candidate, findByName, norm, pickEmployee } from "./interpreter";
import { confirmLink, extractCode, getActiveIdentity, Identity, redactCodes } from "./link";
import { handleApprovalCommand, Verb } from "./approvals";
import { clean, queueOutbound } from "./notify";
import { enqueue } from "./queue";
import { assistantLabel, getSettings, MessagingSettings } from "./settings";
import { InboundMessage } from "./types";

export interface CoordDeps { connector: ConnectorAdapter; now?: Date }
export type InboundStatus = "duplicate" | "unknown" | "linked" | "link_failed" | "handled" | "rate_limited" | "unsupported";
const PENDING_TTL_MS = 10 * 60_000, MAX_PER_MINUTE = 15;
export const shortId = (id: string) => id.slice(0, 8);
const STATUS_ES: Record<string, string> = { requested: "solicitada", in_progress: "en progreso", completed: "completada", failed: "fallida", awaiting_approval: "esperando tu aprobación", rejected: "rechazada" };
const COMPANY_MENTION = /\b(?:para\s+)?(?:mi\s+)?(?:cliente|empresa)\s+(?:llamad[ao]\s+|de\s+)?([\p{L}0-9][\p{L}0-9 &.'-]{1,40}?)(?=[,.;:!?]|\s+(?:y|para|con|que|sobre|en|de|por)\s|$)/iu;
const redactStored = (t: string) => redactCodes(t).replace(/\b(aprobar|rechazar|confirmar)\s+[A-Z0-9]{4,12}\b/gi, "$1 [código]");

type Pending = { type: "choose_company"; options: { id: string; label: string }[]; text?: string; exp: number }
  | { type: "choose_employee"; options: { id: string; label: string }[]; text: string; companyId: string; exp: number }
  | { type: "need_details"; text: string; companyId: string; employeeId?: string; exp: number };

/** Punto de entrada: un mensaje YA autenticado por el adaptador. Idempotente por (canal, id del mensaje). */
export async function handleInbound(db: Db, msg: InboundMessage, deps: CoordDeps): Promise<InboundStatus> {
  const text0 = clean(msg.text).slice(0, 4000);
  const ins = await db.query("INSERT INTO channel_messages(channel,direction,external_msg_id,external_id,kind,text) VALUES($1,'in',$2,$3,$4,$5) ON CONFLICT (channel,direction,external_msg_id) DO NOTHING RETURNING id",
    [msg.channel, msg.externalMsgId, msg.externalId, msg.kind, redactStored(text0)]);
  if (!ins.length) return "duplicate"; // webhook repetido: no se vuelve a procesar
  const rowId = ins[0].id as number;
  const replies: string[] = [];
  const say = (s: string) => replies.push(s);
  const identity = await getActiveIdentity(db, msg.channel, msg.externalId);
  const flush = async (to: Identity | undefined) => {
    for (let i = 0; i < replies.length; i++) await queueOutbound(db, to ? { identity: to, channel: msg.channel } : { channel: msg.channel, external: msg.externalId }, "reply", replies[i], `reply:${msg.channel}:${msg.externalMsgId}:${i}`, msg.externalMsgId);
  };

  // ---------- Chat desconocido ----------
  if (!identity) {
    const start = text0.match(/^\/start(?:@\w+)?\s+(\S+)/i);
    const code = msg.kind === "text" ? extractCode(start ? start[1] : text0) : null;
    if (code) {
      const r = await confirmLink(db, { channel: msg.channel, externalId: msg.externalId, display: maskDisplay(msg), code });
      if (r.ok) {
        const id = (await getActiveIdentity(db, msg.channel, msg.externalId))!;
        await db.query("UPDATE channel_messages SET identity_id=$2, user_id=$3, status='linked' WHERE id=$1", [rowId, id.id, r.userId]);
        const cs = await accessibleCompanies(db, r.userId);
        if (cs.length === 1) { await db.query("UPDATE channel_identities SET active_company_id=$2 WHERE id=$1", [id.id, cs[0].id]); id.active_company_id = cs[0].id; }
        const st = cs[0] ? await getSettings(db, cs[0].agencyId) : null;
        say(`${st?.welcome || `¡Listo! Tu ${msg.channel === "telegram" ? "Telegram" : "WhatsApp"} quedó vinculado.`}${st ? `\nSoy ${assistantLabel(st)}.` : ""}\nEscribe «ayuda» para ver qué puedo hacer.${cs.length === 0 ? "\nAún no tienes empresas vinculadas a tu cuenta." : ""}`);
        await flush(id); return "linked";
      }
      say({ locked: "Demasiados intentos. Espera unos minutos y genera un código nuevo.", invalid: "El código no es válido o ya venció. Genera uno nuevo en la aplicación → Mi oficina en el celular.", conflict: "Esta cuenta ya está vinculada a otra persona. Quien la vinculó debe revocarla primero.", busy: "El servicio está ocupado. Inténtalo más tarde." }[r.reason]);
      await db.query("UPDATE channel_messages SET status='link_failed' WHERE id=$1", [rowId]);
      await flush(undefined); return "link_failed";
    }
    // Nunca se atienden órdenes de chats no vinculados. Se responde como máximo una vez por hora.
    const recent = await db.query("SELECT 1 FROM outbox WHERE to_external=$1 AND channel=$2 AND created_at > now() - interval '1 hour'", [msg.externalId, msg.channel]);
    if (!recent.length) { say("Este chat no está vinculado a ninguna cuenta. Para usarlo, entra a la aplicación → «Mi oficina en el celular» y genera un código de vinculación."); await flush(undefined); }
    await db.query("UPDATE channel_messages SET status='unknown' WHERE id=$1", [rowId]);
    return "unknown";
  }

  // ---------- Chat vinculado ----------
  await db.query("UPDATE channel_messages SET identity_id=$2, user_id=$3 WHERE id=$1", [rowId, identity.id, identity.user_id]);
  await db.query("UPDATE channel_identities SET last_inbound_at=$2 WHERE id=$1", [identity.id, deps.now ?? new Date()]);
  const perMin = Number((await db.query<{ n: string }>("SELECT count(*) n FROM channel_messages WHERE identity_id=$1 AND direction='in' AND created_at > now() - interval '1 minute'", [identity.id]))[0].n);
  if (perMin > MAX_PER_MINUTE) { if (perMin === MAX_PER_MINUTE + 1) { say("Estás enviando demasiados mensajes. Espera un momento."); await flush(identity); } return "rate_limited"; }
  if (msg.kind !== "text") {
    say(msg.kind === "voice" || msg.kind === "audio" ? "Las notas de voz todavía no están habilitadas. Escríbeme tu mensaje." : msg.kind === "other" ? "Por ahora solo entiendo mensajes de texto." : "El envío de archivos todavía no está habilitado. Escríbeme tu mensaje.");
    await flush(identity); return "unsupported";
  }
  await new Session(db, identity, msg, deps, say, rowId).run(text0);
  await flush(identity);
  return "handled";
}
const maskDisplay = (m: InboundMessage) => `${m.display ? m.display + " " : ""}(${m.channel === "whatsapp" ? "+" : "id "}••••${m.externalId.slice(-4)})`;

class Session {
  private companies: AccessibleCompany[] = [];
  private settingsCache = new Map<string, MessagingSettings & { agencyName: string }>();
  constructor(private db: Db, private id: Identity, private msg: InboundMessage, private deps: CoordDeps, private say: (s: string) => void, private rowId: number) {}
  private tone = (a: string, b: string, agencyId?: string) => ((agencyId && this.settingsCache.get(agencyId)?.tone) === "formal" ? b : a);

  private async settings(c?: AccessibleCompany) {
    const aid = c?.agencyId ?? this.companies[0]?.agencyId; if (!aid) return null;
    if (!this.settingsCache.has(aid)) this.settingsCache.set(aid, await getSettings(this.db, aid));
    return this.settingsCache.get(aid)!;
  }
  private async setPending(p: Pending | null) { await this.db.query("UPDATE channel_identities SET state=$2 WHERE id=$1", [this.id.id, JSON.stringify(p ?? {})]); this.id.state = p ?? {}; }
  private async setActive(c: AccessibleCompany) { await this.db.query("UPDATE channel_identities SET active_company_id=$2 WHERE id=$1", [this.id.id, c.id]); this.id.active_company_id = c.id; }

  async run(raw: string) {
    this.companies = await accessibleCompanies(this.db, this.id.user_id); // acceso recalculado en CADA mensaje
    const n = norm(raw.replace(/^\//, "").replace(/@\w+/, ""));
    const pend = this.id.state?.type && this.id.state.exp > Date.now() ? (this.id.state as Pending) : null;
    if (!pend && this.id.state?.type) await this.setPending(null);
    // Comandos explícitos tienen prioridad sobre una pregunta pendiente
    const cmd = await this.command(n, raw);
    if (cmd) { if (pend) await this.setPending(null); return; }
    if (pend) return this.answerPending(pend, raw, n);
    return this.freeText(raw);
  }

  // ---------- comandos ----------
  private async command(n: string, raw: string): Promise<boolean> {
    let m: RegExpMatchArray | null;
    if (/^(ayuda|help|menu|comandos|start|hola|buenas?|buenos dias|buenas tardes|buenas noches)$/.test(n)) { await this.help(); return true; }
    if (/^(mis )?(clientes|empresas)$/.test(n) || /^(cambiar (de )?(empresa|cliente)|empresa activa)$/.test(n)) { await this.listCompanies(); return true; }
    if ((m = n.match(/^(?:empresa|cliente)\s+(.+)$/))) { await this.selectCompanyBy(m[1]); return true; }
    if (/^(mis )?empleados$/.test(n)) { await this.withCompany(raw, (c) => this.listEmployees(c)); return true; }
    if (/^((mis )?tareas )?pendientes$|^mis tareas$/.test(n)) { await this.withCompany(raw, (c) => this.pending(c)); return true; }
    if ((m = n.match(/^estado(?: de)?(?: la)?(?: tarea)?\s+([a-f0-9-]{4,36})$/))) { await this.withCompany(raw, (c) => this.status(c, m![1])); return true; }
    if ((m = n.match(/^(?:ver )?resultados?(?: de)?(?: la)?(?: tarea)?\s*([a-f0-9-]{4,36})?$/))) { await this.withCompany(raw, (c) => this.results(c, m![1])); return true; }
    if ((m = n.match(/^(aprobar|rechazar|confirmar)(?:\s+([a-z0-9-]{4,12}))?$/))) {
      if (!m[2]) this.say(`Para ${m[1]} una acción responde con su código, por ejemplo: ${m[1].toUpperCase()} AB12CD. Los códigos llegan en el aviso de cada aprobación. Un «sí» o «ok» no basta.`);
      else this.say(await handleApprovalCommand(this.db, this.id, m[1] as Verb, m[2], this.deps.connector, this.deps.now));
      return true;
    }
    if (/^(baja|stop|parar|no mas mensajes|cancelar avisos)$/.test(n)) {
      await this.db.query("UPDATE channel_identities SET prefs=$2 WHERE id=$1", [this.id.id, JSON.stringify({ task_done: false, errors: false, approvals: false, alerts: false, digest: "off" })]);
      this.say("Listo: no te enviaré más avisos automáticos. Seguiré respondiendo cuando me escribas. Puedes reactivarlos en la aplicación → Mi oficina en el celular."); return true;
    }
    if (/^notificaciones$/.test(n)) { const p = this.id.prefs; this.say(`Avisos: tareas terminadas ${p.task_done ? "sí" : "no"} · errores ${p.errors ? "sí" : "no"} · aprobaciones ${p.approvals ? "sí" : "no"} · alertas ${p.alerts ? "sí" : "no"} · resumen ${p.digest === "daily" ? "diario" : "no"}. Cámbialos en la aplicación.`); return true; }
    if ((m = raw.match(/^\s*\/?asigna(?:r|le)?\s+(?:a\s+)?(.+?)\s*[:\-–]\s*([\s\S]+)$/i))) { await this.assignExplicit(m[1], m[2]); return true; }
    return false;
  }

  private async help() {
    const c = this.companies.find((x) => x.id === this.id.active_company_id); const st = await this.settings(c);
    const name = st ? assistantLabel(st) : "tu asistente";
    this.say(`${st?.welcome ? st.welcome + "\n\n" : ""}Soy ${name}. Puedes escribirme una tarea con tus palabras («Investiga cinco competidores para mi cliente X») o usar:\n• mis clientes / cambiar empresa\n• mis empleados\n• tareas pendientes\n• estado <id>\n• ver resultados [id]\n• asignar <empleado>: <instrucción>\n• aprobar / rechazar <código>\n• notificaciones · baja · ayuda${c ? `\n\nEmpresa activa: ${c.name}` : ""}`);
  }
  private label(c: AccessibleCompany) { return `${c.name} (${c.agencyName})`; }
  private async listCompanies() {
    if (!this.companies.length) return this.say("Tu cuenta no tiene empresas vinculadas todavía.");
    const options = this.companies.slice(0, 20).map((c) => ({ id: c.id, label: this.label(c) }));
    await this.setPending({ type: "choose_company", options, exp: Date.now() + PENDING_TTL_MS });
    this.say(`Tus empresas:\n${options.map((o, i) => `${i + 1}) ${o.label}${o.id === this.id.active_company_id ? " ← activa" : ""}`).join("\n")}\nResponde con el número o el nombre para cambiar.`);
  }
  private async selectCompanyBy(q: string) {
    const num = q.match(/^\d+$/) ? Number(q) : 0;
    const hit = num ? this.companies[num - 1] : findByName(this.companies, q)[0];
    if (!hit) return this.say("No encontré esa empresa entre las tuyas. Escribe «mis clientes» para ver la lista.");
    await this.setActive(hit); await this.setPending(null); this.say(`Empresa activa: ${hit.name} (${hit.agencyName}).`);
  }
  /** Devuelve la empresa activa (validada hoy) o pregunta cuál usar guardando lo que el usuario quería hacer. */
  private async withCompany(originalText: string, fn: (c: AccessibleCompany) => Promise<void>) {
    if (!this.companies.length) return this.say("Tu cuenta no tiene empresas vinculadas todavía.");
    let c = this.companies.find((x) => x.id === this.id.active_company_id);
    if (!c && this.companies.length === 1) { c = this.companies[0]; await this.setActive(c); }
    if (!c) {
      const options = this.companies.slice(0, 20).map((x) => ({ id: x.id, label: this.label(x) }));
      await this.setPending({ type: "choose_company", options, text: originalText, exp: Date.now() + PENDING_TTL_MS });
      return this.say(`¿Con qué empresa?\n${options.map((o, i) => `${i + 1}) ${o.label}`).join("\n")}\nResponde con el número o el nombre.`);
    }
    await fn(c);
  }

  private async listEmployees(c: AccessibleCompany) {
    const rows = await this.db.query("SELECT e.name,e.role_title,e.status,d.name dep FROM employees e JOIN departments d ON d.id=e.department_id WHERE e.company_id=$1 ORDER BY d.name,e.created_at LIMIT 30", [c.id]);
    if (!rows.length) return this.say(`${c.name} aún no tiene empleados de IA.`);
    this.say(`Empleados de ${c.name}:\n${rows.map((r) => `• ${r.name}${r.role_title && r.role_title !== r.name ? `, ${r.role_title}` : ""} — ${r.dep}${r.status !== "active" ? ` (${r.status === "paused" ? "en pausa" : "inactivo"})` : ""}`).join("\n")}`);
  }
  private async pending(c: AccessibleCompany) {
    const t = await this.db.query("SELECT t.id,t.title,t.status,e.name en FROM tasks t JOIN employees e ON e.id=t.employee_id WHERE t.company_id=$1 AND t.status IN ('requested','in_progress','awaiting_approval') ORDER BY t.created_at DESC LIMIT 8", [c.id]);
    this.say(t.length ? `Pendientes en ${c.name}:\n${t.map((x) => `• #${shortId(x.id)} ${x.title} — ${x.en} (${STATUS_ES[x.status]})`).join("\n")}` : `No hay tareas pendientes en ${c.name}.`);
  }
  private async findTask(c: AccessibleCompany, idq: string) {
    const rows = await this.db.query("SELECT t.*, e.name en FROM tasks t JOIN employees e ON e.id=t.employee_id WHERE t.company_id=$1 AND t.id LIKE $2 LIMIT 2", [c.id, idq.replace(/[%_]/g, "") + "%"]);
    return rows.length === 1 ? rows[0] : rows.length > 1 ? "ambiguous" : null; // solo busca dentro de la empresa activa
  }
  private async status(c: AccessibleCompany, idq: string) {
    const t = await this.findTask(c, idq);
    if (t === "ambiguous") return this.say("Hay varias tareas con ese inicio. Escribe más caracteres del id.");
    if (!t) return this.say("No encontré esa tarea en la empresa activa.");
    this.say(`#${shortId(t.id)} ${t.title}\nEstado: ${STATUS_ES[t.status]} · ${t.en}${t.error ? `\nError: ${String(t.error).slice(0, 300)}` : ""}${t.status === "completed" && t.result ? `\nResultado: escribe «ver resultados ${shortId(t.id)}».` : ""}`);
  }
  private async results(c: AccessibleCompany, idq?: string) {
    if (idq) {
      const t = await this.findTask(c, idq);
      if (t === "ambiguous") return this.say("Hay varias tareas con ese inicio. Escribe más caracteres del id.");
      if (!t) return this.say("No encontré esa tarea en la empresa activa.");
      return this.say(t.status === "completed" ? `Resultado de #${shortId(t.id)} (${t.en}):\n\n${t.result ?? "(sin texto)"}` : `La tarea #${shortId(t.id)} está ${STATUS_ES[t.status]}.`);
    }
    const t = await this.db.query("SELECT id,title FROM tasks WHERE company_id=$1 AND status='completed' ORDER BY finished_at DESC NULLS LAST LIMIT 5", [c.id]);
    this.say(t.length ? `Últimos resultados en ${c.name}:\n${t.map((x) => `• #${shortId(x.id)} ${x.title}`).join("\n")}\nEscribe «ver resultados <id>».` : `Aún no hay resultados en ${c.name}.`);
  }

  // ---------- asignación de tareas ----------
  private async candidates(c: AccessibleCompany): Promise<Candidate[]> {
    const st = await this.settings(c); const allowed = st?.allowedTemplateKeys ?? [];
    const rows = await this.db.query("SELECT e.id,e.name,e.role_title,e.description,e.template_key,d.name dep FROM employees e JOIN departments d ON d.id=e.department_id WHERE e.company_id=$1 AND e.status='active' ORDER BY e.created_at", [c.id]);
    return rows.filter((r) => !allowed.length || !r.template_key || allowed.includes(r.template_key)).map((r) => ({ id: r.id, name: r.name, roleTitle: r.role_title, description: r.description, departmentName: r.dep, templateKey: r.template_key }));
  }
  /** «para mi cliente X»: si X no es una empresa a la que tiene acceso, se dice «no la encontré» (sin revelar si existe en otra agencia). */
  private detectCompany(text: string): { company?: AccessibleCompany; unknownName?: string } {
    const m = text.match(COMPANY_MENTION);
    if (m) { const hit = findByName(this.companies, m[1])[0]; return hit ? { company: hit } : { unknownName: m[1].trim() }; }
    if (this.companies.length > 1) { const nt = norm(text); const hits = this.companies.filter((c) => new RegExp(`(^|\\s)${norm(c.name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`).test(nt)); if (hits.length === 1) return { company: hits[0] }; }
    return {};
  }
  private async freeText(raw: string) {
    if (extractCode(raw) && norm(raw.replace(/[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}/, "")).length < 4) return this.say("Este chat ya está vinculado. Si ese código era para vincular otra cuenta, úsalo desde el chat de esa cuenta.");
    if (norm(raw).length < 4) return this.say("No te entendí. Escribe «ayuda» para ver lo que puedo hacer.");
    const d = this.detectCompany(raw);
    if (d.unknownName) return this.say(`No encontré la empresa «${d.unknownName}» entre tus empresas. Escribe «mis clientes» para ver la lista.`);
    if (d.company) return this.plan(d.company, raw);
    await this.withCompany(raw, (c) => this.plan(c, raw));
  }
  private async plan(c: AccessibleCompany, text: string, employeeId?: string) {
    const cands = await this.candidates(c);
    if (!cands.length) return this.say(`${c.name} no tiene empleados disponibles para asignar por mensaje.`);
    const words = norm(text).split(" ").filter((w) => w.length > 2).length;
    let chosen: Candidate | undefined = employeeId ? cands.find((x) => x.id === employeeId) : undefined;
    if (!chosen) {
      const p = pickEmployee(cands, text.replace(COMPANY_MENTION, " ")); // el nombre de la empresa no debe influir en la elección del empleado
      if (p.kind === "chosen") chosen = p.c;
      else {
        const options = p.options.map((o) => ({ id: o.id, label: `${o.name} — ${o.departmentName}` }));
        await this.setPending({ type: "choose_employee", options, text, companyId: c.id, exp: Date.now() + PENDING_TTL_MS });
        return this.say(`${p.kind === "ambiguous" ? "Puede hacerlo más de un empleado" : "No identifiqué qué empleado es el adecuado"} (${c.name}). ¿Con cuál?\n${options.map((o, i) => `${i + 1}) ${o.label}`).join("\n")}\nResponde con el número o el nombre.`);
      }
    }
    if (words < 3) { await this.setPending({ type: "need_details", text, companyId: c.id, employeeId: chosen.id, exp: Date.now() + PENDING_TTL_MS }); return this.say(`Para ${chosen.name} necesito un poco más de detalle: ¿qué necesitas exactamente y para qué?`); }
    await this.create(c, chosen, text);
  }
  private async assignExplicit(who: string, instruction: string) {
    await this.withCompany(`asignar ${who}: ${instruction}`, async (c) => {
      const cands = await this.candidates(c); const hits = findByName(cands, who);
      if (hits.length === 1) return this.plan(c, instruction, hits[0].id);
      if (!hits.length) return this.say(`No encontré un empleado «${who}» disponible en ${c.name}. Escribe «mis empleados».`);
      const options = hits.slice(0, 6).map((o) => ({ id: o.id, label: `${o.name} — ${o.departmentName}` }));
      await this.setPending({ type: "choose_employee", options, text: instruction, companyId: c.id, exp: Date.now() + PENDING_TTL_MS });
      this.say(`Hay varios con ese nombre:\n${options.map((o, i) => `${i + 1}) ${o.label}`).join("\n")}`);
    });
  }
  private async answerPending(p: Pending, raw: string, n: string) {
    const num = /^\d+$/.test(n) ? Number(n) : 0;
    if (p.type === "need_details") { await this.setPending(null); const c = this.companies.find((x) => x.id === p.companyId); return c ? this.plan(c, `${p.text}. ${raw}`, p.employeeId) : this.say("Ya no tienes acceso a esa empresa."); }
    const opt = (num ? p.options[num - 1] : p.options.find((o) => norm(o.label).includes(n) && n.length >= 3)) ?? null;
    if (!opt) return this.say("No entendí tu elección. Responde con el número de la lista o escribe «ayuda».");
    await this.setPending(null);
    if (p.type === "choose_company") {
      const c = this.companies.find((x) => x.id === opt.id); if (!c) return this.say("Ya no tienes acceso a esa empresa.");
      await this.setActive(c); this.say(`Empresa activa: ${c.name}.`);
      if (p.text) await this.run(p.text);
      return;
    }
    const c = this.companies.find((x) => x.id === p.companyId); if (!c) return this.say("Ya no tienes acceso a esa empresa.");
    const emp = (await this.candidates(c)).find((e) => e.id === opt.id); if (!emp) return this.say("Ese empleado ya no está disponible.");
    await this.plan(c, p.text, emp.id);
  }

  /** Registra la tarea en el MOTOR EXISTENTE (createTask) y la encola; el actor se reconstruye con los permisos de hoy. */
  private async create(c: AccessibleCompany, emp: Candidate, instruction: string) {
    const actor = await actorFor(this.db, this.id.user_id, c.id);
    if (!actor) return this.say("Ya no tienes acceso a esa empresa.");
    if (!can(actor, "tasks:create")) return this.say(`Tu rol en ${c.name} no permite asignar tareas.`);
    try {
      const taskId = await createTask(this.db, actor, { employeeId: emp.id, title: instruction.replace(/\s+/g, " ").slice(0, 80), instruction }, { createdBy: `canal:${this.msg.channel}` });
      await this.db.query("INSERT INTO channel_tasks(task_id,identity_id,user_id,company_id,agency_id,channel,inbound_msg_id) VALUES($1,$2,$3,$4,$5,$6,$7)", [taskId, this.id.id, this.id.user_id, c.id, c.agencyId, this.msg.channel, this.msg.externalMsgId]);
      await this.db.query("UPDATE channel_messages SET task_id=$2, company_id=$3, agency_id=$4 WHERE id=$1", [this.rowId, taskId, c.id, c.agencyId]);
      await enqueue(this.db, "run_task", { taskId, identityId: this.id.id }, { dedupeKey: `run_task:${taskId}` });
      if (this.id.active_company_id !== c.id) await this.setActive(c); // el contexto sigue a la última empresa con la que trabajó
      this.say(`✅ Recibido. Tarea #${shortId(taskId)} asignada a ${emp.name}${emp.roleTitle && emp.roleTitle !== emp.name ? `, ${emp.roleTitle}` : ""} (${c.name}). Te aviso cuando esté lista.`);
    } catch (e: any) {
      if (e instanceof DuplicateTaskError) return this.say(`Ya existe una tarea igual (#${shortId(e.existingId)}). No la dupliqué: escribe «estado ${shortId(e.existingId)}».`);
      if (e instanceof z.ZodError) return this.say("Escribe una instrucción para el empleado.");
      this.say(`No pude crear la tarea: ${String(e.message).slice(0, 160)}`);
    }
  }
}
