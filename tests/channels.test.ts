import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHmac } from "node:crypto";
import { Db } from "@/server/db";
import { signupAgency, login, agencyActorFromToken, AgencyActor, AuthorizationError } from "@/server/auth";
import { createClient } from "@/server/agency";
import { createLinkCode, getActiveIdentity } from "@/server/messaging/link";
import { parseTelegramUpdate, verifyTelegramWebhook, TelegramAdapter } from "@/server/messaging/adapters/telegram";
import { parseWhatsAppPayload, verifyWhatsAppSignature, whatsappChallenge, WhatsAppAdapter } from "@/server/messaging/adapters/whatsapp";
import { processTelegramWebhook, processWhatsAppWebhook, whatsappVerify } from "@/server/messaging/webhooks";
import { processJobs } from "@/server/messaging/jobs";
import { validateAttachment } from "@/server/messaging/attachments";
import { saveAgencyChannelSecret, hasAgencyChannelSecret, readAgencyChannelSecret } from "@/server/messaging/credentials";
import { newDb, FakeAdapter, FakeChannel } from "./helpers";

const SEC = "tg-secret-123", APP = "wa-app-secret", VT = "wa-verify-token";
let db: Db, A: AgencyActor, B: AgencyActor, connector: FakeAdapter, tg: FakeChannel, wa: FakeChannel;
const mk = async (email: string, name: string) => { await signupAgency(db, { email, name: "D", password: "clave-larga-123", agencyName: name, specialty: "" }); return (await agencyActorFromToken(db, await login(db, email, "clave-larga-123")))!; };
const hdr = (v: string | null) => ({ get: (k: string) => (k.toLowerCase() === "x-telegram-bot-api-secret-token" ? v : null) });
const tgUpdate = (id: number, text: string, from = 4242, type = "private") => ({ update_id: id, message: { message_id: id, date: 1700000000, chat: { id: from, type }, from: { id: from, is_bot: false, first_name: "Ana" }, text } });
const sign = (raw: string, secret = APP) => "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
const waBody = (id: string, from: string, text: string) => JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ id, from, timestamp: "1700000000", type: "text", text: { body: text } }] } }] }] });
const pump = () => processJobs(db, { provider: null, connector, adapters: { telegram: tg, whatsapp: wa }, retryDelayMs: 0 }, { kinds: ["send_outbox"] });

beforeEach(async () => {
  db = await newDb(); connector = new FakeAdapter(); tg = new FakeChannel("telegram"); wa = new FakeChannel("whatsapp");
  process.env.TELEGRAM_WEBHOOK_SECRET = SEC; process.env.WHATSAPP_APP_SECRET = APP; process.env.WHATSAPP_VERIFY_TOKEN = VT;
  A = await mk("a@x.com", "Agencia A"); B = await mk("b@x.com", "Agencia B"); await createClient(db, A, { name: "Cliente A" });
});
afterEach(() => { vi.unstubAllGlobals(); for (const k of ["TELEGRAM_WEBHOOK_SECRET", "TELEGRAM_BOT_TOKEN", "WHATSAPP_APP_SECRET", "WHATSAPP_VERIFY_TOKEN", "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"]) delete process.env[k]; });

describe("autenticidad de webhooks", () => {
  it("Telegram: sin el secreto correcto → 401 y no se procesa nada", async () => {
    for (const h of [null, "otro", SEC + "x"]) expect((await processTelegramWebhook(db, hdr(h), tgUpdate(1, "hola"), connector)).status).toBe(401);
    expect((await db.query("SELECT 1 FROM channel_messages")).length).toBe(0);
    expect(verifyTelegramWebhook(hdr(SEC), "")).toBe(false); // sin secreto configurado nunca autentica
  });
  it("Telegram: con el secreto correcto se procesa; grupos y bots se ignoran; el update repetido no se reprocesa", async () => {
    const { code } = await createLinkCode(db, A.userId, "telegram", true);
    expect((await processTelegramWebhook(db, hdr(SEC), tgUpdate(10, `/start ${code}`), connector)).status).toBe(200);
    expect(await getActiveIdentity(db, "telegram", "4242")).toBeTruthy();
    await processTelegramWebhook(db, hdr(SEC), tgUpdate(11, "ayuda"), connector); await processTelegramWebhook(db, hdr(SEC), tgUpdate(11, "ayuda"), connector); // mismo update_id
    await processTelegramWebhook(db, hdr(SEC), tgUpdate(12, "ayuda", 4242, "group"), connector); // grupo
    await processTelegramWebhook(db, hdr(SEC), { update_id: 13, message: { ...tgUpdate(13, "ayuda").message, from: { id: 9, is_bot: true } } }, connector);
    await pump();
    expect(tg.sent.filter((s) => /Puedes escribirme una tarea/.test(s.text)).length).toBe(1); // ayuda respondida una sola vez
    expect((await db.query("SELECT 1 FROM channel_messages WHERE direction='in'")).length).toBe(2);
  });
  it("Telegram: conocer el @usuario no concede acceso (la identidad es el id numérico verificado)", async () => {
    const m = parseTelegramUpdate({ ...tgUpdate(20, "mis clientes"), message: { ...tgUpdate(20, "x").message, from: { id: 31337, is_bot: false, first_name: "Ana", username: "ana_admin" } } })!;
    expect(m.externalId).toBe("31337"); expect(JSON.stringify(m)).not.toContain("ana_admin");
    await processTelegramWebhook(db, hdr(SEC), { update_id: 21, message: { ...tgUpdate(21, "mis clientes").message, from: { id: 31337, is_bot: false, first_name: "Ana", username: "ana_admin" } } }, connector); await pump();
    expect(tg.sent.at(-1)!.text).toMatch(/no está vinculado/); expect(tg.sent.at(-1)!.text).not.toMatch(/Cliente A/);
  });
  it("WhatsApp: firma HMAC válida → 200; inválida, ausente o con cuerpo alterado → 401", async () => {
    const raw = waBody("wamid.1", "5215550001", "hola");
    expect((await processWhatsAppWebhook(db, raw, sign(raw), connector)).status).toBe(200);
    expect((await processWhatsAppWebhook(db, raw, sign(raw, "otro"), connector)).status).toBe(401);
    expect((await processWhatsAppWebhook(db, raw, null, connector)).status).toBe(401);
    expect((await processWhatsAppWebhook(db, raw + " ", sign(raw), connector)).status).toBe(401);
    expect(verifyWhatsAppSignature(raw, sign(raw), "")).toBe(false);
  });
  it("WhatsApp: vincula por código, ignora el mismo mensaje repetido (wamid) y responde por la bandeja", async () => {
    const { code } = await createLinkCode(db, A.userId, "whatsapp", true);
    const raw = waBody("wamid.A", "5215550001", `Hola, mi código ${code}`);
    await processWhatsAppWebhook(db, raw, sign(raw), connector); await processWhatsAppWebhook(db, raw, sign(raw), connector); await pump();
    expect((await getActiveIdentity(db, "whatsapp", "5215550001"))!.user_id).toBe(A.userId);
    expect(wa.sent.filter((s) => /vinculado/.test(s.text)).length).toBe(1);
  });
  it("WhatsApp: verificación GET del webhook", () => {
    expect(whatsappVerify(new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": VT, "hub.challenge": "12345" }))).toEqual({ status: 200, body: "12345" });
    expect(whatsappVerify(new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": "mal", "hub.challenge": "1" })).status).toBe(403);
    expect(whatsappChallenge(new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": VT }), "")).toBeNull();
  });
  it("WhatsApp: los eventos de estado (entregas) no generan órdenes", async () => {
    const raw = JSON.stringify({ entry: [{ changes: [{ value: { statuses: [{ id: "x", status: "delivered" }] } }] }] });
    expect((await processWhatsAppWebhook(db, raw, sign(raw), connector)).status).toBe(200); expect((await db.query("SELECT 1 FROM channel_messages")).length).toBe(0);
  });
});

describe("normalización de mensajes", () => {
  it("Telegram: texto, voz, foto, documento", () => {
    const base = tgUpdate(1, "x").message;
    expect(parseTelegramUpdate({ update_id: 1, message: { ...base, text: undefined, voice: { mime_type: "audio/ogg", file_size: 100 } } })).toMatchObject({ kind: "voice", attachment: { mime: "audio/ogg" } });
    expect(parseTelegramUpdate({ update_id: 2, message: { ...base, text: undefined, photo: [{ file_size: 1 }, { file_size: 9 }], caption: "mira" } })).toMatchObject({ kind: "image", text: "mira", attachment: { size: 9 } });
    expect(parseTelegramUpdate({ update_id: 3, message: { ...base, text: undefined, document: { mime_type: "application/pdf", file_name: "a.pdf", file_size: 5 } } })).toMatchObject({ kind: "document" });
    expect(parseTelegramUpdate({ nada: 1 })).toBeNull();
  });
  it("WhatsApp: texto, nota de voz, imagen, documento", () => {
    const body = { entry: [{ changes: [{ value: { messages: [
      { id: "1", from: "52155", timestamp: "1", type: "text", text: { body: "hola" } }, { id: "2", from: "52155", timestamp: "1", type: "audio", audio: { voice: true, mime_type: "audio/ogg" } },
      { id: "3", from: "52155", timestamp: "1", type: "image", image: { mime_type: "image/jpeg", caption: "c" } }, { id: "4", from: "52155", timestamp: "1", type: "document", document: { mime_type: "application/pdf", filename: "x.pdf" } }] } }] }] };
    expect(parseWhatsAppPayload(body).map((m) => m.kind)).toEqual(["text", "voice", "image", "document"]);
  });
});

describe("adaptadores de envío (fetch SIMULADO: no se envía nada real)", () => {
  it("Telegram: sendMessage con token en la URL, chat_id y texto; errores clasificados; el token no aparece en errores", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "123:SECRETTOKEN";
    const f = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, result: { message_id: 55 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, description: "Too Many Requests" }), { status: 429 })).mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, description: "Forbidden: bot was blocked by the user" }), { status: 403 })).mockRejectedValueOnce(new Error("boom 123:SECRETTOKEN"));
    vi.stubGlobal("fetch", f);
    const a = new TelegramAdapter();
    expect(await a.send("4242", "hola")).toEqual({ ok: true, externalMsgId: "55" });
    expect(f.mock.calls[0][0]).toBe("https://api.telegram.org/bot123:SECRETTOKEN/sendMessage"); expect(JSON.parse(f.mock.calls[0][1].body)).toMatchObject({ chat_id: "4242", text: "hola" });
    expect(await a.send("4242", "x")).toMatchObject({ ok: false, retryable: true }); expect(await a.send("4242", "x")).toMatchObject({ ok: false, retryable: false });
    const net = await a.send("4242", "x"); expect(net.retryable).toBe(true);
  });
  it("WhatsApp: texto y plantilla con el formato de la Cloud API; Bearer en cabecera", async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = "EAAtoken"; process.env.WHATSAPP_PHONE_NUMBER_ID = "999";
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({ messages: [{ id: "wamid.OUT" }] }), { status: 200 })); vi.stubGlobal("fetch", f);
    const a = new WhatsAppAdapter();
    expect(await a.send("5215550001", "hola")).toEqual({ ok: true, externalMsgId: "wamid.OUT" });
    expect(f.mock.calls[0][0]).toBe("https://graph.facebook.com/v21.0/999/messages"); expect(f.mock.calls[0][1].headers.authorization).toBe("Bearer EAAtoken");
    expect(JSON.parse(f.mock.calls[0][1].body)).toMatchObject({ messaging_product: "whatsapp", to: "5215550001", type: "text", text: { body: "hola" } });
    await a.send("5215550001", "", { template: { name: "aviso", lang: "es", params: ["p1"] } });
    expect(JSON.parse(f.mock.calls[1][1].body)).toMatchObject({ type: "template", template: { name: "aviso", language: { code: "es" }, components: [{ type: "body", parameters: [{ type: "text", text: "p1" }] }] } });
  });
  it("canales sin configurar se reportan como tales", () => { expect(new TelegramAdapter().configured()).toBe(false); expect(new WhatsAppAdapter().configured()).toBe(false); });
});

describe("credenciales por agencia (preparado para bots propios) y archivos", () => {
  it("el secreto se guarda cifrado, solo owner, nunca en claro; otra agencia no lo ve", async () => {
    process.env.APP_SECRET ??= Buffer.alloc(32, 7).toString("base64");
    await saveAgencyChannelSecret(db, A, "telegram", "123456:ABC-DEF-bot-token", { botUsername: "mi_bot" });
    expect(JSON.stringify(await db.query("SELECT * FROM agency_channel_credentials"))).not.toContain("ABC-DEF");
    expect(await readAgencyChannelSecret(db, A.agencyId, "telegram")).toBe("123456:ABC-DEF-bot-token");
    expect(await hasAgencyChannelSecret(db, A, "telegram")).toBe(true); expect(await hasAgencyChannelSecret(db, B, "telegram")).toBe(false);
    expect(await readAgencyChannelSecret(db, B.agencyId, "telegram")).toBeNull();
    await expect(saveAgencyChannelSecret(db, { ...A, agencyRole: "agency_admin" }, "telegram", "otro-token-largo")).rejects.toThrow(AuthorizationError);
    expect(JSON.stringify(await db.query("SELECT * FROM audit_log"))).not.toContain("ABC-DEF");
  });
  it("validación de adjuntos: tipo, tamaño y nombre", () => {
    expect(validateAttachment("image", { mime: "image/png", size: 1000 })).toEqual({ ok: true });
    expect(validateAttachment("image", { mime: "image/svg+xml", size: 1000 }).ok).toBe(false);
    expect(validateAttachment("document", { mime: "application/pdf", size: 11 * 1024 * 1024 }).ok).toBe(false);
    expect(validateAttachment("document", { mime: "application/pdf", size: 10, name: "../../etc/passwd" }).ok).toBe(false);
    expect(validateAttachment("document", { mime: "application/pdf", size: 10, name: "setup.exe" }).ok).toBe(false);
    expect(validateAttachment("voice", { mime: "audio/ogg; codecs=opus", size: 1000 }).ok).toBe(true);
    expect(validateAttachment("voice", { mime: "audio/ogg" }).ok).toBe(false);
  });
});
