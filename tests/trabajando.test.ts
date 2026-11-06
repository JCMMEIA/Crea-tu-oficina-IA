import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Db } from "@/server/db";
import { Actor } from "@/server/auth";
import { hireFromTemplate } from "@/server/catalog/office";
import { createTask, runTask } from "@/server/tasks";
import { workingEmployeeIds, WORKING_STALE_MINUTES } from "@/server/tasks/working";
import { companyScene } from "@/server/office3d";
import { CompleteRequest, CompleteResult } from "@/server/models";
import { EmployeeState, WorkingDots, minutesText, workingMessage } from "@/components/Working";
import { StatusChip } from "@/lib/ui";
import { newDb, newCompany, ScriptedProvider } from "./helpers";

/** Proveedor simulado (sin costo ni red) que mira la base MIENTRAS «trabaja», como lo vería otra pantalla. */
class SpyProvider extends ScriptedProvider {
  seen: { working: boolean; scene: boolean | undefined }[] = [];
  constructor(private spy: () => Promise<{ working: boolean; scene: boolean | undefined }>) { super([{ text: "Listo." }]); }
  async complete(req: CompleteRequest): Promise<CompleteResult> { this.seen.push(await this.spy()); return super.complete(req); }
}

let db: Db; let owner: Actor;
beforeEach(async () => { db = await newDb(); owner = await newCompany(db, "t@x.com", "Oficina de prueba"); });

describe("estado «trabajando» derivado de datos existentes", () => {
  it("empleado sin tareas no está trabajando", async () => {
    const id = await hireFromTemplate(db, owner, "guionista-storytelling");
    expect((await workingEmployeeIds(db, owner.companyId)).has(id)).toBe(false);
  });

  it("mientras corre la tarea aparece trabajando (en la lista y en la escena de la oficina) y al terminar vuelve a «listo»", async () => {
    const id = await hireFromTemplate(db, owner, "guionista-storytelling");
    const p = new SpyProvider(async () => ({
      working: (await workingEmployeeIds(db, owner.companyId)).has(id),
      scene: (await companyScene(db, owner)).zones.flatMap((z) => z.desks).find((d) => d.id === id)?.working,
    }));
    const t = await createTask(db, owner, { employeeId: id, title: "Guiones", instruction: "Escribe 3 guiones" });
    expect((await workingEmployeeIds(db, owner.companyId)).has(id)).toBe(false); // «pedida» todavía no es «trabajando»
    expect((await runTask(db, owner, t, { provider: p })).status).toBe("completed");
    expect(p.seen).toEqual([{ working: true, scene: true }]);
    expect((await workingEmployeeIds(db, owner.companyId)).has(id)).toBe(false);
    const desk = (await companyScene(db, owner)).zones.flatMap((z) => z.desks).find((d) => d.id === id)!;
    expect(desk.working).toBeFalsy(); expect(desk.status).toBe("active");
  });

  it("si la tarea falla, el empleado tampoco queda «trabajando»", async () => {
    const id = await hireFromTemplate(db, owner, "guionista-storytelling");
    const t = await createTask(db, owner, { employeeId: id, title: "X", instruction: "Haz algo" });
    await runTask(db, owner, t, { provider: new ScriptedProvider(["fatal"]) });
    expect((await db.query("SELECT status FROM tasks WHERE id=$1", [t]))[0].status).toBe("failed");
    expect((await workingEmployeeIds(db, owner.companyId)).has(id)).toBe(false);
  });

  it("una tarea «en progreso» abandonada (sin señales hace mucho) no deja al empleado trabajando para siempre", async () => {
    const id = await hireFromTemplate(db, owner, "guionista-storytelling");
    const t = await createTask(db, owner, { employeeId: id, title: "X", instruction: "Haz algo" });
    await db.query("UPDATE tasks SET status='in_progress' WHERE id=$1", [t]);
    expect((await workingEmployeeIds(db, owner.companyId)).has(id)).toBe(true);
    await db.query("UPDATE tasks SET created_at = now() - interval '2 hours' WHERE id=$1", [t]);
    await db.query("UPDATE task_events SET created_at = now() - interval '2 hours' WHERE task_id=$1", [t]);
    expect(WORKING_STALE_MINUTES).toBeLessThan(120);
    expect((await workingEmployeeIds(db, owner.companyId)).has(id)).toBe(false);
  });

  it("aislamiento: el trabajo de otra empresa no aparece", async () => {
    const other = await newCompany(db, "o@x.com", "Otra");
    const id = await hireFromTemplate(db, other, "guionista-storytelling");
    const t = await createTask(db, other, { employeeId: id, title: "X", instruction: "Haz algo" });
    await db.query("UPDATE tasks SET status='in_progress' WHERE id=$1", [t]);
    expect((await workingEmployeeIds(db, owner.companyId)).size).toBe(0);
    expect((await workingEmployeeIds(db, other.companyId)).has(id)).toBe(true);
  });
});

describe("textos y piezas visuales", () => {
  it("mensaje claro con el nombre y el tiempo máximo", () => {
    expect(workingMessage("Lucía", 120)).toBe("Lucía está trabajando en tu tarea; puede tardar hasta 2 minutos, no cierres ni vuelvas a pulsar.");
    expect(minutesText(30)).toBe("1 minuto"); expect(minutesText(300)).toBe("5 minutos");
  });
  it("EmployeeState: Trabajando… animado, Listo para trabajar, en pausa (con texto, nunca solo color)", () => {
    const h = (el: React.ReactElement) => renderToStaticMarkup(el);
    const w = h(React.createElement(EmployeeState, { status: "active", working: true }));
    expect(w).toContain("Trabajando…"); expect(w).toContain('role="status"'); expect(w).toContain("wk-dots");
    const idle = h(React.createElement(EmployeeState, { status: "active", working: false }));
    expect(idle).toContain("Listo para trabajar"); expect(idle).not.toContain("wk-dots");
    expect(h(React.createElement(EmployeeState, { status: "paused", working: true }))).toContain("En pausa"); // en pausa manda
  });
  it("StatusChip de una tarea en progreso muestra Trabajando… con animación; los demás estados no cambian", () => {
    const h = (s: string) => renderToStaticMarkup(React.createElement(StatusChip, { s }));
    expect(h("in_progress")).toContain("Trabajando…"); expect(h("in_progress")).toContain("wk-dots");
    expect(h("completed")).toContain("Lista"); expect(h("failed")).toContain("No salió"); expect(h("completed")).not.toContain("wk-dots");
  });
  it("los puntos son decorativos para lectores de pantalla (aria-hidden) y existe la regla de movimiento reducido", async () => {
    expect(renderToStaticMarkup(React.createElement(WorkingDots))).toContain('aria-hidden="true"');
    const css = (await import("node:fs")).readFileSync("src/components/working.css", "utf8");
    expect(css).toMatch(/prefers-reduced-motion:reduce\)\{[^}]*animation:none/);
  });
});
