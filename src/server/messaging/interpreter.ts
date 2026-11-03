import { getTemplate } from "../catalog/data";

export const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ\s:.,-]/g, " ").replace(/\s+/g, " ").trim();
const STOP = new Set("para por con sin que como mas muy una uno unos unas los las del esta este esto estos mis mio mia tus tuyo quiero necesito favor porfa puedes puedo hacer haz hazme dame dime cliente empresa tarea cinco cuatro tres dos diez algo hoy ahora luego tambien sobre entre desde hasta cada todo toda todos todas favor".split(" "));
/** Raíz aproximada: sin acentos y recortada a 6 letras (investiga/investigador → «invest»; competidores/competencia → «compet»). */
export const stem = (w: string) => w.slice(0, 6);
const rawWords = (s: string): string[] => [...new Set(norm(s).split(/[\s:.,-]+/).filter((w) => w.length >= 4 && !STOP.has(w) && !/^\d+$/.test(w)))];
export const tokens = (s: string): string[] => [...new Set(norm(s).split(/[\s:.,-]+/).filter((w) => w.length >= 4 && !STOP.has(w) && !/^\d+$/.test(w)).map(stem))];

export interface Candidate { id: string; name: string; roleTitle: string; description: string; departmentName: string; templateKey: string | null }
export interface Ranked { c: Candidate; score: number }

/** Puntúa empleados por coincidencia (ponderada por rareza del término) con su puesto, descripción y responsabilidades. Heurística local, sin IA. */
export function rankEmployees(cands: Candidate[], text: string): Ranked[] {
  const qWords = rawWords(text); const q = [...new Set(qWords.map(stem))]; if (!q.length || !cands.length) return cands.map((c) => ({ c, score: 0 }));
  const docs = cands.map((c) => {
    const t = c.templateKey ? getTemplate(c.templateKey) : undefined;
    return { titleRaw: new Set(rawWords(`${c.roleTitle} ${c.name}`)), title: new Set(tokens(`${c.roleTitle} ${c.name}`)), body: new Set(tokens(`${c.description} ${c.departmentName} ${(t?.responsibilities ?? []).join(" ")} ${(t?.deliverables ?? []).join(" ")}`)) };
  });
  const df = (tok: string) => docs.filter((d) => d.title.has(tok) || d.body.has(tok)).length;
  return cands.map((c, i) => ({ c, score: q.reduce((s, tok) => { const exact = qWords.some((w) => stem(w) === tok && docs[i].titleRaw.has(w)); return s + (docs[i].title.has(tok) ? (exact ? 4.5 : 3) : docs[i].body.has(tok) ? 1 : 0) * Math.log(1 + cands.length / Math.max(1, df(tok))); }, 0) })).sort((a, b) => b.score - a.score);
}
export type Pick = { kind: "chosen"; c: Candidate } | { kind: "ambiguous"; options: Candidate[] } | { kind: "none"; options: Candidate[] };
export function pickEmployee(cands: Candidate[], text: string): Pick {
  const r = rankEmployees(cands, text); const top = r[0], second = r[1];
  if (!top || top.score < 1) return { kind: "none", options: cands.slice(0, 8) };
  if (top.score >= 2 && (!second || top.score >= second.score * 1.2)) return { kind: "chosen", c: top.c };
  return { kind: "ambiguous", options: r.filter((x) => x.score > 0).slice(0, 4).map((x) => x.c) };
}
export const findByName = <T extends { name: string; roleTitle?: string }>(items: T[], q: string): T[] => {
  const n = norm(q); if (!n) return [];
  const exact = items.filter((i) => norm(i.name) === n || (i.roleTitle && norm(i.roleTitle) === n)); if (exact.length) return exact;
  return items.filter((i) => norm(i.name).includes(n) || (i.roleTitle && norm(i.roleTitle).includes(n)));
};
