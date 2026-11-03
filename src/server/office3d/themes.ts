import { OfficeTheme } from "./types";
/** Registro de temas. Hoy solo existe «base»; la fase 2 añadirá estilos por agencia y oficinas premium aquí. */
export const THEMES: Record<string, OfficeTheme> = {
  base: { key: "base", floor: "#eceae4", wall: "#d9d6cd" },
  moderno: { key: "moderno", floor: "#eceae4", wall: "#d9d6cd" },
  calido: { key: "calido", floor: "#f0e3cf", wall: "#dcc9a8" },
  fresco: { key: "fresco", floor: "#e2eef0", wall: "#c5dbdf" },
};
export const getTheme = (key?: string): OfficeTheme => THEMES[key ?? "base"] ?? THEMES.base;
