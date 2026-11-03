import { Db } from "../db";
import { AgencyActor, assertAgencyCan, audit } from "../auth";
import { decryptSecret, encryptSecret } from "../connectors/crypto";
import { Channel } from "./types";

/**
 * PREPARADO para bots/números propios de cada agencia (fase posterior): los secretos se guardan cifrados (AES-256-GCM)
 * y nunca se devuelven al navegador. Hoy NINGÚN canal los usa: todo corre por el bot/número central de la plataforma.
 */
export async function saveAgencyChannelSecret(db: Db, a: AgencyActor, channel: Channel, secret: string, meta: Record<string, string> = {}) {
  assertAgencyCan(a, "agency:manage");
  if (secret.length < 8 || secret.length > 600) throw new Error("Secreto inválido.");
  await db.query(`INSERT INTO agency_channel_credentials(agency_id,channel,secret_enc,meta) VALUES($1,$2,$3,$4)
    ON CONFLICT (agency_id,channel) DO UPDATE SET secret_enc=$3, meta=$4`, [a.agencyId, channel, encryptSecret(secret), JSON.stringify(meta)]);
  await audit(db, { userId: a.userId }, "messaging.credential_saved", channel); // sin el secreto
}
export async function hasAgencyChannelSecret(db: Db, a: AgencyActor, channel: Channel) {
  assertAgencyCan(a, "agency:read");
  return (await db.query("SELECT 1 FROM agency_channel_credentials WHERE agency_id=$1 AND channel=$2", [a.agencyId, channel])).length > 0;
}
/** Solo para el servidor que envía mensajes en nombre de esa agencia. */
export async function readAgencyChannelSecret(db: Db, agencyId: string, channel: Channel): Promise<string | null> {
  const r = (await db.query("SELECT secret_enc FROM agency_channel_credentials WHERE agency_id=$1 AND channel=$2", [agencyId, channel]))[0];
  return r ? decryptSecret(r.secret_enc) : null;
}
