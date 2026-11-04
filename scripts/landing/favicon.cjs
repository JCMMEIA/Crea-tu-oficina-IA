// Genera los PNG del favicon desde src/app/icon.svg y empaqueta favicon.ico (16/32/48). Uso: NODE_PATH=$(npm root -g) node scripts/landing/favicon.cjs
const { chromium } = require("playwright"); const fs = require("fs"); const path = require("path");
const root = path.join(__dirname, "../.."); const svg = fs.readFileSync(path.join(root, "src/app/icon.svg"), "utf8");
(async () => {
  const b = await chromium.launch(); const render = async (size, maskable) => { const p = await b.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    const inner = maskable ? `<div style="width:${size}px;height:${size}px;background:#6d3df0;display:grid;place-items:center"><div style="width:${size * 0.72}px;height:${size * 0.72}px">${svg}</div></div>` : `<div style="width:${size}px;height:${size}px">${svg}</div>`;
    await p.setContent(`<style>html,body{margin:0;background:transparent}svg{width:100%;height:100%;display:block}</style>${inner}`); const buf = await p.screenshot({ omitBackground: !maskable, clip: { x: 0, y: 0, width: size, height: size } }); await p.close(); return buf; };
  const out = {}; for (const s of [16, 32, 48, 180, 192, 512]) out[s] = await render(s, false); out.maskable = await render(512, true);
  fs.writeFileSync(path.join(root, "src/app/apple-icon.png"), out[180]); fs.writeFileSync(path.join(root, "public/icons/icon-192.png"), out[192]); fs.writeFileSync(path.join(root, "public/icons/icon-512.png"), out[512]); fs.writeFileSync(path.join(root, "public/icons/icon-maskable-512.png"), out.maskable);
  fs.writeFileSync(path.join(root, "public/icons/icon-32.png"), out[32]); fs.writeFileSync(path.join(root, "public/icons/icon-16.png"), out[16]);
  // ICO con PNG incrustados (16, 32, 48)
  const imgs = [16, 32, 48].map((s) => out[s]); const head = Buffer.alloc(6); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(imgs.length, 4);
  let off = 6 + 16 * imgs.length; const dir = imgs.map((img, i) => { const s = [16, 32, 48][i]; const d = Buffer.alloc(16); d[0] = s; d[1] = s; d.writeUInt16LE(1, 4); d.writeUInt16LE(32, 6); d.writeUInt32LE(img.length, 8); d.writeUInt32LE(off, 12); off += img.length; return d; });
  fs.writeFileSync(path.join(root, "src/app/favicon.ico"), Buffer.concat([head, ...dir, ...imgs])); await b.close(); console.log("favicon listo");
})();
