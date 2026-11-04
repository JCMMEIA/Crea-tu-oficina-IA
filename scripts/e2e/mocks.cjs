// SERVIDORES SIMULADOS para las pruebas de extremo a extremo (NO son Stripe, Resend ni Claude reales):
//   Stripe (sesiones de pago, suscripciones, portal) · Resend (correos) · Anthropic (mensajes). Un solo puerto.   node scripts/e2e/mocks.cjs 3199
const http = require("http"); const PORT = Number(process.argv[2] || 3199); const base = `http://127.0.0.1:${PORT}`;
const sessions = []; const mails = []; const subCalls = []; let aiCalls = 0;
const body = (req) => new Promise((r) => { let b = ""; req.on("data", (d) => (b += d)); req.on("end", () => r(b)); });
http.createServer(async (req, res) => {
  const u = new URL(req.url, base); const send = (c, j, t = "application/json") => { res.writeHead(c, { "content-type": t }); res.end(typeof j === "string" ? j : JSON.stringify(j)); };
  if (req.method === "POST" && u.pathname === "/v1/checkout/sessions") { const f = Object.fromEntries(new URLSearchParams(await body(req))); const id = "cs_test_" + (sessions.length + 1); sessions.push({ id, form: f }); return send(200, { id, url: `${base}/pay/${id}` }); }
  if (u.pathname.startsWith("/pay/")) return send(200, `<h1>Pago de prueba (Stripe SIMULADO)</h1><p>${u.pathname}</p>`, "text/html");
  if (req.method === "POST" && u.pathname.startsWith("/v1/subscriptions/")) { subCalls.push({ id: u.pathname.split("/").pop(), form: Object.fromEntries(new URLSearchParams(await body(req))) }); return send(200, {}); }
  if (req.method === "POST" && u.pathname === "/v1/billing_portal/sessions") return send(200, { url: `${base}/portal` });
  if (u.pathname === "/portal") return send(200, "<h1>Portal de pagos (SIMULADO)</h1>", "text/html");
  if (req.method === "POST" && u.pathname === "/emails") { const j = JSON.parse(await body(req)); mails.push(j); return send(200, { id: "mail_" + mails.length }); }
  if (req.method === "POST" && u.pathname === "/v1/messages") { aiCalls++; await body(req); return send(200, { id: "msg_sim", type: "message", role: "assistant", model: "simulado", content: [{ type: "text", text: "Respuesta SIMULADA del modelo para la prueba de extremo a extremo." }], stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 120, output_tokens: 30 } }); }
  if (u.pathname === "/__sessions") return send(200, sessions); if (u.pathname === "/__mails") return send(200, mails); if (u.pathname === "/__subcalls") return send(200, subCalls); if (u.pathname === "/__ai") return send(200, { calls: aiCalls });
  send(404, { error: "no existe" });
}).listen(PORT, "127.0.0.1", () => console.log("mocks en " + base));
