import { getAdapter } from "../connectors";
import { getProvider } from "../models";
import { JobDeps } from "./jobs";
import { TelegramAdapter } from "./adapters/telegram";
import { WhatsAppAdapter } from "./adapters/whatsapp";

/** Dependencias reales de producción: proveedor de IA, conectores y canales (cada uno solo si está configurado). */
export const runtimeDeps = (): JobDeps => ({ provider: getProvider(), connector: getAdapter(), adapters: { telegram: new TelegramAdapter(), whatsapp: new WhatsAppAdapter() } });
export const channelStatus = () => ({ telegram: new TelegramAdapter().configured(), whatsapp: new WhatsAppAdapter().configured() });
