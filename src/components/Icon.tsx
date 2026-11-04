import type { SVGProps } from "react";

/** Iconos de la interfaz: SVG en línea, trazo de 1.75, 24×24, un solo estilo (sin emojis). Heredan el color (currentColor). Son decorativos salvo que se pase `title`. */
const P: Record<string, React.ReactNode> = {
  building: <><path d="M3 21h18" /><path d="M5 21V10l7-5 7 5v11" /><path d="M9 21v-6h6v6" /><path d="M4 10h16" /><path d="M9 13h.01M15 13h.01" /></>,
  landmark: <><path d="M3 10l9-6 9 6" /><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8" /><path d="M3 21h18M3 10h18" /></>,
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c.6-3.4 3.2-5.2 6.5-5.2s5.9 1.8 6.5 5.2" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14.2c2.5.2 4.1 1.7 4.5 4.3" /></>,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" /></>,
  layers: <><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 12.5l9 5 9-5" /><path d="M3 17l9 5 9-5" /></>,
  card: <><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19M6 15h4" /></>,
  cursor: <path d="M5 3l14 7-6 2-2 6-6-15z" />,
  shield: <><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9.5C7.2 20 4 16.5 4 12V6l8-3z" /><path d="M9 12l2.2 2.2L15.5 10" /></>,
  play: <path d="M7 4.5v15l12-7.5-12-7.5z" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  home: <><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  plusbox: <><rect x="3.5" y="3.5" width="17" height="17" rx="4" /><path d="M12 8v8M8 12h8" /></>,
  grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
  template: <><rect x="3.5" y="4" width="17" height="16" rx="2.5" /><path d="M3.5 9h17M9 9v11" /></>,
  receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" /><path d="M9 8h6M9 12h6" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.3a2.6 2.6 0 015 .9c0 1.8-2.5 2.2-2.5 3.8M12 17h.01" /></>,
  bell: <><path d="M6 9a6 6 0 0112 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z" /><path d="M10 20a2 2 0 004 0" /></>,
  megaphone: <><path d="M3 11v3a1 1 0 001 1h2l7 4V6L6 10H4a1 1 0 00-1 1z" /><path d="M16 9.5a4 4 0 010 5M18.5 7a7.5 7.5 0 010 10" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  trend: <><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3.5 7l8.5 6 8.5-6" /></>,
  workflow: <><rect x="3" y="3.5" width="6" height="6" rx="1.5" /><rect x="15" y="14.5" width="6" height="6" rx="1.5" /><path d="M9 6.5h4a2 2 0 012 2v6" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2.5" /><path d="M9 7V5a1.5 1.5 0 011.5-1.5h3A1.5 1.5 0 0115 5v2M3 13h18" /></>,
  pause: <path d="M8 5v14M16 5v14" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  lock: <><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 018 0v2.5" /></>,
  sparkle: <><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" /></>,
  external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" /></>,
  logout: <><path d="M9 4H5a1 1 0 00-1 1v14a1 1 0 001 1h4" /><path d="M16 8l4 4-4 4M20 12H9" /></>,
};
export type IconName = keyof typeof P;
export function Icon({ name, size = 20, title, ...rest }: { name: IconName; size?: number; title?: string } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title} focusable="false" {...rest}>{title && <title>{title}</title>}{P[name]}</svg>);
}
/** Marca: el mismo edificio/oficina que el favicon, dentro de un cuadro redondeado morado. */
export function BrandMark({ size = 36 }: { size?: number }) {
  return (<span className="brand-mark" style={{ width: size, height: size }} aria-hidden="true"><Icon name="landmark" size={Math.round(size * 0.58)} /></span>);
}
