import { getDb } from "../src/server/db";
import { enqueue } from "../src/server/messaging/queue";
import { processJobs } from "../src/server/messaging/jobs";
import { runtimeDeps } from "../src/server/messaging/runtime";
async function main() {
  const db = await getDb();
  await enqueue(db, "scan_notifications", {}, { dedupeKey: `scan:${Math.floor(Date.now() / 60_000)}` });
  console.log(await processJobs(db, runtimeDeps()));
  await db.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
