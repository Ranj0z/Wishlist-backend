import "dotenv/config";
// import { drizzle } from "drizzle-orm/node-postgres"
import { drizzle } from "drizzle-orm/neon-http"
// import { Client } from "pg";
import * as schema from "./schema"
import { neon } from "@neondatabase/serverless";


export const client = neon(process.env.DATABASE_URL!)

const db = drizzle(client, { schema, logger: false });
export default db;


