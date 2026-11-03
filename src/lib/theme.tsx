"use client";
export function ThemeToggle() {
  return (<button className="ghost" style={{ margin: "10px" }} aria-label="Cambiar entre modo claro y oscuro" onClick={() => {
    const r = document.documentElement; const cur = r.dataset.theme ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    r.dataset.theme = cur === "dark" ? "light" : "dark"; try { localStorage.setItem("theme", r.dataset.theme); } catch {}
  }}>🌓 Claro / oscuro</button>);
}
