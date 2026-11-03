import { OfficeTheme } from "./types";
/** Registro de temas. Hoy solo existe «base»; la fase 2 añadirá estilos por agencia y oficinas premium aquí. */
export const THEMES: Record<string, OfficeTheme> = {
  base: { key: "base", floor: "#eceae4", wall: "#d9d6cd" },
};
export const getTheme = (key?: string): OfficeTheme => THEMES[key ?? "base"] ?? THEMES.base;
