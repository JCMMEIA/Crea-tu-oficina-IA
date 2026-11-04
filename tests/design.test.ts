import { describe, it, expect } from "vitest";
import fs from "node:fs"; import path from "node:path";
import { TESTIMONIALS } from "@/content/testimonials";

const root = path.join(__dirname, "..");
const files = (dir: string): string[] => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((d) => d.isDirectory() ? files(path.join(dir, d.name)) : /\.(tsx?|css)$/.test(d.name) ? [path.join(dir, d.name)] : []);
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2705}\u{274C}\u{2753}]/u;
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("sistema de diseño premium", () => {
  it("la landing, el panel, la demostración y «oficinas» no usan emojis como iconos", () => {
    const targets = ["src/app/page.tsx", ...files("src/features/funnel"), "src/app/(agency)/layout.tsx", "src/app/(agency)/agencia/page.tsx", "src/lib/guide.tsx", ...files("src/components/shell"), ...files("src/app/panel-demo"), ...files("src/app/oficinas"), "src/lib/demo_data.ts"];
    const bad = targets.filter((f) => EMOJI.test(strip(fs.readFileSync(path.join(root, f), "utf8"))));
    expect(bad).toEqual([]);
  });
  it("la demostración del panel NO toca la base de datos ni sesiones (solo datos de ejemplo y catálogo)", () => {
    for (const f of [...files("src/app/panel-demo"), "src/lib/demo_data.ts", ...files("src/components/shell").filter((x) => /Demo/.test(x))]) {
      const s = strip(fs.readFileSync(path.join(root, f), "utf8"));
      expect(s, f).not.toMatch(/getDb|currentActor|requireAgency|requireUser|requireOperator|db\.query|"use server"|fetch\(/);
    }
  });
  it("testimonios: sin testimonios reales la sección se oculta; los que existan deben tener nombre, cargo y texto", () => {
    expect(Array.isArray(TESTIMONIALS)).toBe(true);
    for (const t of TESTIMONIALS) { expect(t.name.length).toBeGreaterThan(1); expect(t.role.length).toBeGreaterThan(1); expect(t.quote.length).toBeGreaterThan(10); }
    const page = fs.readFileSync(path.join(root, "src/features/funnel/components/Testimonials.tsx"), "utf8");
    expect(page).toMatch(/!TESTIMONIALS\.length && !preview/);
    expect(page).not.toMatch(/★|⭐|Carlos Méndez|Ana Rivas|Diego Salazar/);
  });
  it("tokens del sistema: paleta, espaciado y tipografía definidos en un solo lugar", () => {
    const css = fs.readFileSync(path.join(root, "src/app/premium.css"), "utf8");
    for (const v of ["--bg", "--panel", "--brand", "--grad", "--text", "--muted", "--line", "--ok", "--warn", "--bad", "--r", "--s1", "--s9", "--font"]) expect(css).toContain(v + ":");
    expect(fs.existsSync(path.join(root, "public/fonts/inter-latin-wght-normal.woff2"))).toBe(true);
  });
  it("favicon e identidad: svg, ico, apple-icon, iconos del manifest y metadatos", () => {
    for (const f of ["src/app/icon.svg", "src/app/favicon.ico", "src/app/apple-icon.png", "src/app/manifest.ts", "public/icons/icon-192.png", "public/icons/icon-512.png", "public/icons/icon-maskable-512.png"]) expect(fs.existsSync(path.join(root, f)), f).toBe(true);
    const ico = fs.readFileSync(path.join(root, "src/app/favicon.ico")); expect(ico.readUInt16LE(2)).toBe(1); expect(ico.readUInt16LE(4)).toBe(3); // 3 tamaños: 16, 32, 48
    const layout = fs.readFileSync(path.join(root, "src/app/layout.tsx"), "utf8"); expect(layout).toMatch(/themeColor/); expect(layout).toMatch(/manifest/);
  });
  it("todas las imágenes de la landing existen y pesan poco", () => {
    for (const f of ["panel", "vista-inicio", "vista-nueva-oficina", "vista-mis-oficinas", "vista-empleados", "vista-departamentos", "vista-automatizaciones", "vista-configuracion", "vista-facturacion"]) { const p = path.join(root, `public/landing/${f}.webp`); expect(fs.existsSync(p), f).toBe(true); expect(fs.statSync(p).size, f).toBeLessThan(120_000); }
  });
});
