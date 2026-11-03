import { getDb } from "../src/server/db";
import { getProvider } from "../src/server/models";
import { runDueAutomations } from "../src/server/automations";
const db = await getDb();
console.log(await runDueAutomations(db, { provider: getProvider() }));
await db.close();
