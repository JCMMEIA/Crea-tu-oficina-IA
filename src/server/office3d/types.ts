/**
 * Escena de oficina: descripción serializable, independiente del renderizador (3D, 2D o futuros).
 * Se genera SOLO con datos reales. Puntos de extensión para la fase 2: `theme`, `rooms`, `tour`.
 */
export type DeskStatus = "active" | "paused" | "inactive";
export type ZoneStatus = "empty" | "needs_setup" | "ready";

export interface Desk {
  id: string; label: string; roleTitle: string; departmentName: string;
  status: DeskStatus; skillName: string; skillVersion: number; skillCustomized: boolean;
  needs: string[];                      // aplicaciones que le faltan por conectar (texto para la persona)
  x: number; z: number;                 // centro en unidades de escena
  href: string; skillHref: string;      // accesos rápidos
}
export interface Zone {
  id: string; key: string; kind: "department" | "client" | "automation";
  label: string; color: string; icon: string;
  x: number; z: number; w: number; d: number; // centro y tamaño
  status: ZoneStatus; statusLabel: string; notes: string[];
  services: string[]; desks: Desk[];
  href?: string; companyId?: string;    // en la escena de agencia: la oficina de ese cliente
}
export interface Reception { x: number; z: number; w: number; d: number }
export interface SceneBrand { name: string; color: string; logo: string | null; tagline: string }

/** Registro de temas: en la fase 2 se añaden estilos por agencia / oficinas premium sin tocar los renderizadores. */
/** Elementos decorativos reutilizables (los dibujan igual la vista 2D y la 3D). */
export type DecorKind = "plant" | "blocks" | "neon" | "holo" | "star" | "tower" | "crystal" | "cactus" | "flask" | "coral" | "bubble" | "palm" | "dish" | "column" | "fountain" | "sofa" | "lamp";
export type BackdropKind = "garden" | "skyline" | "night" | "hall" | "sea";
export type PatternKind = "none" | "studs" | "tiles" | "planks" | "marble" | "grid" | "sand" | "waves";
/** «Personaliza tu oficina»: aspecto ya resuelto (estilo + espacio + interruptores). Solo presentación: nunca cambia empleados ni departamentos. */
export interface ThemeLook {
  style: string; space: string; label: string;
  bgFrom: string; bgTo: string; accent: string; accent2: string; desk: string; deskTop: string; screen: string;
  lightColor: string; ambient: number; sun: number; margin: number; pattern: PatternKind;
  backdrop: BackdropKind | null; skyFrom: string; skyTo: string; decor: DecorKind[];
  fx: { motion: boolean; lights: boolean; premium: boolean; immersive: boolean };
}
export interface OfficeTheme { key: string; floor: string; wall: string; accent?: string; premium?: boolean; look?: ThemeLook }
export interface OfficeScene {
  version: 1; kind: "company" | "agency"; title: string; subtitle: string;
  brand: SceneBrand; theme: OfficeTheme; reception: Reception;
  zones: Zone[]; bounds: { w: number; d: number };
  stats: { zones: number; employees: number; automations: number };
  /** Reservado fase 2: salas adicionales (reuniones, estudio…) y recorridos guiados. */
  rooms: { id: string; kind: string; x: number; z: number; w: number; d: number }[];
  tour: { id: string; title: string; focus: string }[];
}
