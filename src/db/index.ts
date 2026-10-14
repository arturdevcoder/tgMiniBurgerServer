import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

const sqlite = new Database("orders.sqlite");

// Auto-create table if not exists
sqlite.run(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_address TEXT NOT NULL,
    customer_comment TEXT,
    items_json TEXT NOT NULL,
    total_amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    admin_comment TEXT,
    estimated_minutes INTEGER DEFAULT 25,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

export const db = drizzle({ client: sqlite, schema });
export { sqlite };
