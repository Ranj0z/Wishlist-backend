import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Switched from `drizzle-orm/neon-http` to `drizzle-orm/node-postgres`: the
// checkout/wallet flows need real interactive transactions (reserve stock,
// branch on the result, insert/update, roll back on failure), which the
// HTTP-based neon-http driver can't do. `pg` connects to Neon over standard
// Postgres wire protocol — Neon supports this natively, no new provider
// needed, just the `pg` + `@types/pg` packages added to package.json.
//
// Requires DATABASE_URL to be Neon's *pooled* connection string
// (the one containing "-pooler" in the host) since this Pool holds
// persistent connections rather than one-shot HTTP requests.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Neon requires TLS; adjust if you manage your own CA bundle
});

const db = drizzle(pool, { schema, logger: false });
export default db;