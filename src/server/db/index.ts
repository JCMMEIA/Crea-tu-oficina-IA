import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type Row = Record<string, any>;
export interface Db {
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export const newId = () => randomUUID();
const schema = () => fs.readFileSync(path.join(process.cwd(), "src/server/db/schema.sql"), "utf8");

/** PGlite = Postgres embebido (desarrollo y pruebas). Mismo SQL que Postgres de producción. */
export async function createPgliteDb(dataDir?: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  if (dataDir) fs.mkdirSync(path.dirname(dataDir), { recursive: true });
  const pg = dataDir ? new PGlite(dataDir) : new PGlite();
  await pg.exec(schema());
  const wrap = (c: { query: (s: string, p?: unknown[]) => Promise<{ rows: any[] }> }): Omit<Db, "close"> => ({
    query: async (sql, params) => (await c.query(sql, params as any[])).rows,
    tx: async (fn) => pg.transaction(async (t) => fn({ ...wrap(t as any), close: async () => {} } as Db)),
  });
  return { ...wrap(pg as any), close: () => pg.close() } as Db;
}

export async function createPgDb(url: string): Promise<Db> {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: url });
  pool.on("error", (e) => console.error("[db] se perdió una conexión inactiva (se reabrirá sola):", e.message)); // sin esto, reiniciar PostgreSQL tumbaba el proceso
  await pool.query(schema());
  const wrap = (c: { query: (s: string, p?: unknown[]) => Promise<{ rows: any[] }> }): Omit<Db, "close"> => ({
    query: async (sql, params) => (await c.query(sql, params as any[])).rows,
    tx: async (fn) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const out = await fn({ ...wrap(client), close: async () => {} } as Db);
        await client.query("COMMIT");
        return out;
      } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
    },
  });
  return { ...wrap(pool), close: () => pool.end() } as Db;
}

/** Conexión única por PROCESO (no por módulo): Next empaqueta rutas y páginas por separado y, sin esto, cada una abriría su propio PGlite. */
const g = globalThis as unknown as { __ctoDb?: Promise<Db> };
export function getDb(): Promise<Db> {
  g.__ctoDb ??= process.env.DATABASE_URL
    ? createPgDb(process.env.DATABASE_URL)
    : createPgliteDb(path.join(process.cwd(), ".data", "pglite"));
  return g.__ctoDb;
}
